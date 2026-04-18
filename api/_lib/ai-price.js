// AI pricing advice — 给卖家的服务定价建议。
//
// 输入：分类、标题、描述、交付周期、经验水平、可选的 comparableServices[]。
// 输出：{ suggestedMinCents, suggestedMaxCents, reasoning, tiers: [{name, priceCents, deliveryDays, includes}], tagSuggestions }
//
// 目标是帮新卖家做第一个服务 listing 的时候不"瞎报价"，给一个合理区间 + 分档建议。
//
// 永远不抛错。

import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'

const systemPrompt = `你是 WhiteHive 的服务定价顾问。WhiteHive 卖家多是青年创作者 / 自由职业者 / 学生，买家多是个人或初创团队。定价风格偏实在，不走"工作室"高端路线，但也不能贱卖。

你的任务：给卖家一个服务定价区间 + 分档建议 + 标签建议，帮他在 Sell 页发布服务。

硬规则：
- 输出严格 JSON，键名 snake_case，不要 markdown 代码块。
- 所有金额用 CNY 分（整数，比如 30000 代表 300 元）。
- 不要给荒谬值：最低不低于 5000 分（50 元），最高不高于 5000000 分（5 万元）——如果需求超出这个区间，仍然按该区间返回并用 reasoning 说明"超出 WhiteHive 典型价位"。
- tiers 固定 3 档：basic / standard / premium，每档 ≤ 4 条 includes。
- reasoning ≤ 180 字，中文，说清"为什么是这个区间"。
- tag_suggestions 返回 4-8 条中文短标签。

输出格式：
{
  "suggested_min_cents": 30000,
  "suggested_max_cents": 280000,
  "reasoning": "...",
  "tiers": [
    { "name": "basic", "price_cents": 30000, "delivery_days": 5, "includes": ["..."] },
    { "name": "standard", "price_cents": 100000, "delivery_days": 7, "includes": ["..."] },
    { "name": "premium", "price_cents": 280000, "delivery_days": 14, "includes": ["..."] }
  ],
  "tag_suggestions": ["..."]
}`

function buildUserPrompt(input) {
  const comps = Array.isArray(input.comparableServices)
    ? input.comparableServices
        .slice(0, 6)
        .map((svc) => {
          const cents = Number(svc.priceCents)
          return `- ${svc.title || '(untitled)'} | ${svc.category || '?'} | ${Number.isFinite(cents) ? cents + '分' : '?价'} | ${svc.deliveryDays || '?'}天`
        })
        .join('\n')
    : ''

  return [
    `分类: ${input.category || '(未指定)'}`,
    `标题: ${input.title || '(未提供)'}`,
    `描述: ${input.summary || input.description || '(未提供)'}`,
    `交付周期(天): ${input.deliveryDays || '(未提供)'}`,
    input.sellerExperience ? `卖家经验: ${input.sellerExperience}` : '',
    input.targetBudgetCents ? `卖家心理价位(CNY分): ${input.targetBudgetCents}` : '',
    comps ? `平台内可对比服务:\n${comps}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function clampCents(value, min = 5000, max = 5000000) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.round(Math.min(max, Math.max(min, number)))
}

function sanitizeTiers(value) {
  if (!Array.isArray(value)) return []
  const allowedNames = ['basic', 'standard', 'premium']
  return value
    .map((tier) => {
      if (!tier || typeof tier !== 'object') return null
      const rawName = String(tier.name || '').trim().toLowerCase()
      const name = allowedNames.includes(rawName) ? rawName : 'standard'
      const priceCents = clampCents(tier.price_cents ?? tier.priceCents)
      const deliveryDays = Number(tier.delivery_days ?? tier.deliveryDays)
      const includes = Array.isArray(tier.includes)
        ? tier.includes
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 4)
            .map((item) => (item.length > 50 ? item.slice(0, 50) : item))
        : []
      if (priceCents == null) return null
      return {
        name,
        priceCents,
        deliveryDays: Number.isFinite(deliveryDays) && deliveryDays > 0 ? Math.round(deliveryDays) : 7,
        includes,
      }
    })
    .filter(Boolean)
    .slice(0, 3)
}

function sanitizeTags(value) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .map((v) => v.slice(0, 16)),
    ),
  ).slice(0, 8)
}

export async function suggestPricing(input = {}) {
  if (!isDeepSeekConfigured()) {
    return { ok: false, reason: 'not_configured' }
  }

  if (!input.category || !(input.title || input.summary)) {
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

  const min = clampCents(parsed.suggested_min_cents ?? parsed.suggestedMinCents)
  const max = clampCents(parsed.suggested_max_cents ?? parsed.suggestedMaxCents)
  if (min == null || max == null || min > max) {
    return { ok: false, reason: 'llm_bad_range' }
  }

  return {
    ok: true,
    suggestedMinCents: min,
    suggestedMaxCents: max,
    reasoning: String(parsed.reasoning || '').trim().slice(0, 400),
    tiers: sanitizeTiers(parsed.tiers),
    tagSuggestions: sanitizeTags(parsed.tag_suggestions || parsed.tagSuggestions),
    model: result.model,
    usage: result.usage,
  }
}
