// AI brief review — 帮买家把需求写清楚。
//
// 给定买家填的标题/brief/分类/预算/时限，LLM 返回结构化反馈：
//   - score: 0-100，打分
//   - strengths: string[]  需求里写得好的点
//   - gaps: [{ key, label, reason }]  缺了什么，AIMatch 可以直接当 clarifying questions 用
//   - suggestedRewrite: string  一版改写后的 brief，帮卖家更容易读懂
//   - redFlags: string[]  诈骗 / 不合理预期 / 违法 / 脱平台 等警告
//
// 永远不抛错：DeepSeek 未配 / 失败 / JSON 坏 → 返回 { ok: false, reason }。
//
// 不碰任何 store 文件。

import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'

const systemPrompt = `你是 WhiteHive 的需求审稿助理。WhiteHive 是可信交易平台，买家多为个人 / 学生 / 初创团队，卖家多为青年创作者 / 自由职业者 / 学生。

你的任务：读完买家填的需求，帮他把需求写得更清楚、更容易被卖家接单，同时识别诈骗 / 脱平台 / 违法预期。

硬规则：
- 输出严格 JSON，键名 snake_case，不要包含 markdown 代码块。
- strengths / gaps / red_flags 每条 ≤ 40 字，中文，不空话。
- gaps 的 key 是半角英文 kebab-case 短词（如 "reference-style"、"target-audience"、"delivery-format"）。
- suggested_rewrite ≤ 240 字，第一人称口吻，保持买家原意不编造事实。
- score 越高代表越容易被卖家直接接单：信息完整、边界清楚、预期合理 → 高分。

输出格式：
{
  "score": 0-100,
  "summary": "一句话总结这个需求（≤ 40 字）",
  "strengths": ["..."],
  "gaps": [
    { "key": "reference-style", "label": "追问的问题文本", "reason": "为什么要补这个（≤ 30 字）" }
  ],
  "suggested_rewrite": "...",
  "red_flags": ["..."]
}`

function buildUserPrompt(input) {
  const budget = Number(input.budgetCents)
  return [
    `分类: ${input.category || '(买家未指定)'}`,
    `标题: ${input.title || '(未提供)'}`,
    `预算(CNY分): ${Number.isFinite(budget) && budget > 0 ? budget : '(未提供)'}`,
    `时限: ${input.deadline || '(未提供)'}`,
    `正文 brief:\n${input.brief || '(未提供)'}`,
    input.notes ? `补充备注: ${input.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function sanitizeStringArray(value, maxLen = 40, maxItems = 6) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => (item.length > maxLen ? item.slice(0, maxLen) : item))
}

function sanitizeGaps(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const key = String(item.key || item.id || '').trim().slice(0, 40) || 'detail'
      const label = String(item.label || item.question || '').trim().slice(0, 80)
      if (!label) return null
      const reason = String(item.reason || item.rationale || '').trim().slice(0, 80)
      return { key, label, reason }
    })
    .filter(Boolean)
    .slice(0, 5)
}

function clampScore(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(100, Math.max(0, Math.round(number)))
}

export function hasEnoughInput(input = {}) {
  const text = [input.title, input.brief, input.notes]
    .map((v) => String(v || '').trim())
    .join(' ')
  return text.length >= 8
}

export async function reviewBrief(input = {}) {
  if (!isDeepSeekConfigured()) {
    return { ok: false, reason: 'not_configured' }
  }

  if (!hasEnoughInput(input)) {
    return { ok: false, reason: 'insufficient_input' }
  }

  const result = await callDeepSeek({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 900,
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason || 'llm_call_failed', error: result.error }
  }

  const parsed = parseJsonFromLlm(result.text)
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'llm_bad_json', rawPreview: String(result.text || '').slice(0, 200) }
  }

  return {
    ok: true,
    score: clampScore(parsed.score),
    summary: String(parsed.summary || '').trim().slice(0, 80),
    strengths: sanitizeStringArray(parsed.strengths, 60, 5),
    gaps: sanitizeGaps(parsed.gaps),
    suggestedRewrite: String(parsed.suggested_rewrite || parsed.suggestedRewrite || '').trim().slice(0, 500),
    redFlags: sanitizeStringArray(parsed.red_flags || parsed.redFlags, 60, 4),
    model: result.model,
    usage: result.usage,
  }
}
