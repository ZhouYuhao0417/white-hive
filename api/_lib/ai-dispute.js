// AI dispute summary — 纠纷发生时，把聊天记录 + 订单上下文压成一份给管理员看的结构化摘要。
//
// 输入：order 基本信息 + messages 数组 + 双方立场（可选）。
// 输出：{
//   timeline: [{ at, who, what }],
//   buyerPosition: string,
//   sellerPosition: string,
//   factualDisputes: string[],
//   agreedFacts: string[],
//   recommendedAction: "refund_buyer" | "release_seller" | "split" | "request_more_evidence",
//   recommendedActionReason: string,
//   confidence: "low" | "medium" | "high"
// }
//
// 永远不抛错。

import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'

const systemPrompt = `你是 WhiteHive 的纠纷审理助理。你看双方的聊天记录 + 订单信息，帮管理员快速理解纠纷本质，给出处理建议。

硬规则：
- 输出严格 JSON，键名 snake_case，不要 markdown 代码块。
- 保持中立。不要用"显然"、"毫无疑问"这种带倾向的词。
- factual_disputes 只列双方说法互相矛盾的事实点；agreed_facts 只列双方都认可的。
- recommended_action 必须从固定 4 项中选：refund_buyer（全退买家）、release_seller（放款给卖家）、split（部分退款 / 折中）、request_more_evidence（证据不足，先补材料）。
- 如果聊天记录明显不足以判断，confidence 必须是 "low"，recommended_action 必须是 "request_more_evidence"。
- timeline 最多 10 条，按时间升序，每条 what ≤ 40 字。
- recommended_action_reason ≤ 120 字，说明为什么这么判。

输出格式：
{
  "summary": "一句话总结纠纷（≤ 60 字）",
  "timeline": [
    { "at": "2026-04-16T10:00:00Z", "who": "buyer|seller|system", "what": "..." }
  ],
  "buyer_position": "买家的核心诉求（≤ 100 字）",
  "seller_position": "卖家的核心诉求（≤ 100 字）",
  "factual_disputes": ["..."],
  "agreed_facts": ["..."],
  "recommended_action": "refund_buyer | release_seller | split | request_more_evidence",
  "recommended_action_reason": "...",
  "confidence": "low | medium | high"
}`

function compactMessage(message) {
  return {
    at: message.createdAt || message.at || null,
    role:
      message.senderRole ||
      (message.senderId && message.senderId.includes('buyer')
        ? 'buyer'
        : message.senderId && message.senderId.includes('seller')
          ? 'seller'
          : 'system'),
    body: String(message.body || message.text || '').slice(0, 500),
  }
}

function buildUserPrompt({ order, messages, buyerClaim, sellerClaim }) {
  const orderBlock = [
    `订单号: ${order?.id || '(未知)'}`,
    `状态: ${order?.status || '?'}`,
    `付款状态: ${order?.paymentStatus || '?'}`,
    `金额(CNY分): ${order?.budgetCents || '?'}`,
    `服务标题: ${order?.title || '(无)'}`,
    `需求 brief: ${(order?.brief || '').slice(0, 300)}`,
  ].join('\n')

  const messagesBlock = Array.isArray(messages)
    ? JSON.stringify(messages.slice(-40).map(compactMessage), null, 0)
    : '[]'

  return [
    `订单信息:\n${orderBlock}`,
    buyerClaim ? `买家主张:\n${String(buyerClaim).slice(0, 500)}` : '',
    sellerClaim ? `卖家主张:\n${String(sellerClaim).slice(0, 500)}` : '',
    `聊天记录(最近 40 条):\n${messagesBlock}`,
    '请按系统指令返回 JSON。',
  ]
    .filter(Boolean)
    .join('\n\n')
}

const allowedActions = new Set(['refund_buyer', 'release_seller', 'split', 'request_more_evidence'])
const allowedConfidence = new Set(['low', 'medium', 'high'])

function sanitizeTimeline(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const at = String(item.at || '').slice(0, 40)
      const who = String(item.who || '').slice(0, 20)
      const what = String(item.what || '').trim().slice(0, 80)
      if (!what) return null
      return { at, who, what }
    })
    .filter(Boolean)
    .slice(0, 10)
}

function sanitizeStringArray(value, maxLen = 80, maxItems = 6) {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((v) => (v.length > maxLen ? v.slice(0, maxLen) : v))
}

export async function summarizeDispute(input = {}) {
  if (!isDeepSeekConfigured()) {
    return { ok: false, reason: 'not_configured' }
  }

  if (!input.order || !Array.isArray(input.messages) || input.messages.length === 0) {
    return { ok: false, reason: 'insufficient_input' }
  }

  const result = await callDeepSeek({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 1400,
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason || 'llm_call_failed', error: result.error }
  }

  const parsed = parseJsonFromLlm(result.text)
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'llm_bad_json', rawPreview: String(result.text || '').slice(0, 200) }
  }

  const action = String(parsed.recommended_action || parsed.recommendedAction || '').trim()
  const confidence = String(parsed.confidence || '').trim().toLowerCase()

  return {
    ok: true,
    summary: String(parsed.summary || '').trim().slice(0, 120),
    timeline: sanitizeTimeline(parsed.timeline),
    buyerPosition: String(parsed.buyer_position || parsed.buyerPosition || '').trim().slice(0, 200),
    sellerPosition: String(parsed.seller_position || parsed.sellerPosition || '').trim().slice(0, 200),
    factualDisputes: sanitizeStringArray(parsed.factual_disputes || parsed.factualDisputes, 120, 6),
    agreedFacts: sanitizeStringArray(parsed.agreed_facts || parsed.agreedFacts, 120, 6),
    recommendedAction: allowedActions.has(action) ? action : 'request_more_evidence',
    recommendedActionReason: String(
      parsed.recommended_action_reason || parsed.recommendedActionReason || '',
    )
      .trim()
      .slice(0, 240),
    confidence: allowedConfidence.has(confidence) ? confidence : 'low',
    model: result.model,
    usage: result.usage,
  }
}
