// AI listing polish — 卖家服务 listing 的文案润色。
//
// 输入：卖家自己写的粗糙 title/summary/tags。
// 输出：{ title, summary, tags[], whyBuy[], scopeIncluded[], scopeExcluded[] }
//
// "scope excluded" 专门用来降低纠纷 —— 明确告诉买家"不包含什么"，
// 减少后面 OrderChat 里吵架的概率。
//
// 永远不抛错。

import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'

const systemPrompt = `你是 WhiteHive 的服务 listing 编辑。帮卖家把"我会做网站，2000"润色成能直接发布的服务页面。

硬规则：
- 输出严格 JSON，键名 snake_case，不要 markdown 代码块。
- 保持卖家原意，不要编造其不具备的能力 / 工具 / 案例。
- title ≤ 24 字，中文，动词 + 具体交付物，例如"从零帮你上线创业项目官网"。
- summary 80-140 字，中文，一段话。
- tags: 4-8 个中文短标签。
- why_buy: 3-5 条，每条 ≤ 30 字，说明"买家为什么选这个卖家"。
- scope_included: 3-6 条，具体交付物。
- scope_excluded: 2-4 条，**明确告诉买家"不包含什么"**，用来降低纠纷。例如"不包含后期内容更新"、"不包含域名购买"。

输出格式：
{
  "title": "...",
  "summary": "...",
  "tags": ["..."],
  "why_buy": ["..."],
  "scope_included": ["..."],
  "scope_excluded": ["..."]
}`

function buildUserPrompt(input) {
  return [
    `分类: ${input.category || '(未指定)'}`,
    `卖家原始标题: ${input.title || '(未提供)'}`,
    `卖家原始描述: ${input.summary || input.description || '(未提供)'}`,
    input.tags && Array.isArray(input.tags) && input.tags.length
      ? `卖家原始标签: ${input.tags.slice(0, 10).join(', ')}`
      : '',
    input.deliveryDays ? `交付周期(天): ${input.deliveryDays}` : '',
    input.priceCents ? `定价(CNY分): ${input.priceCents}` : '',
    input.sellerBio ? `卖家自我介绍: ${String(input.sellerBio).slice(0, 300)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function takeString(value, maxLen) {
  const s = String(value || '').trim()
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

function takeStringArray(value, maxLen, maxItems) {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => takeString(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems)
}

export async function polishListing(input = {}) {
  if (!isDeepSeekConfigured()) {
    return { ok: false, reason: 'not_configured' }
  }

  if (!input.category || !(input.title || input.summary || input.description)) {
    return { ok: false, reason: 'insufficient_input' }
  }

  const result = await callDeepSeek({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    jsonMode: true,
    temperature: 0.4,
    maxTokens: 900,
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason || 'llm_call_failed', error: result.error }
  }

  const parsed = parseJsonFromLlm(result.text)
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'llm_bad_json', rawPreview: String(result.text || '').slice(0, 200) }
  }

  const title = takeString(parsed.title, 40)
  const summary = takeString(parsed.summary, 220)

  if (!title || !summary) {
    return { ok: false, reason: 'llm_missing_core_fields' }
  }

  return {
    ok: true,
    title,
    summary,
    tags: Array.from(new Set(takeStringArray(parsed.tags, 16, 8))),
    whyBuy: takeStringArray(parsed.why_buy || parsed.whyBuy, 40, 5),
    scopeIncluded: takeStringArray(parsed.scope_included || parsed.scopeIncluded, 50, 6),
    scopeExcluded: takeStringArray(parsed.scope_excluded || parsed.scopeExcluded, 50, 4),
    model: result.model,
    usage: result.usage,
  }
}
