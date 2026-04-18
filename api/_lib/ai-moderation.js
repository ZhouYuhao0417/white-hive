// AI message moderation — 在 OrderChat 发消息前快速过一遍：
//   - 脱平台引流（微信号、QQ、Telegram、外部支付链接）
//   - 付款诈骗（要求提前转账、跳过托管）
//   - 辱骂 / 威胁
//   - 个人信息泄漏（真实姓名、身份证、家庭住址）
//
// 有两层策略：
// 1) rule-based quickCheck() —— 正则快筛，**同步、零成本**，任何环境都跑
// 2) moderateMessage() —— 规则命中或明显可疑时再走 LLM 复核（异步）
//
// API 入口应该先调 quickCheck()；真实部署可以只用快筛，LLM 复核留给后台异步扫描。
// quickCheck() 永远不抛错；moderateMessage() 永远不抛错。

import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'

const rules = [
  {
    id: 'offplatform-wechat',
    category: 'offplatform',
    severity: 'high',
    label: '疑似脱平台（微信号）',
    // wechat id: alnum + _ - 6~20 chars, often prefixed by "微信" "vx" "v："
    pattern: /(微信|weixin|vx|wechat|加\s*v)[\s:：]*[a-z0-9_-]{5,20}/i,
  },
  {
    id: 'offplatform-qq',
    category: 'offplatform',
    severity: 'high',
    label: '疑似脱平台（QQ 号）',
    pattern: /(qq|扣扣|企鹅)(?:\s*(?:号|是|联系|加|加我|：|:|=))*\s*[1-9]\d{4,10}/i,
  },
  {
    id: 'offplatform-phone',
    category: 'offplatform',
    severity: 'medium',
    label: '疑似脱平台（手机号）',
    pattern: /(?<![\d-])1[3-9]\d{9}(?![\d-])/,
  },
  {
    id: 'offplatform-link',
    category: 'offplatform',
    severity: 'medium',
    label: '疑似外部支付 / 聊天链接',
    pattern: /(alipay\.com\/t\/|qr\.alipay\.com|wx\.tenpay|paypal\.me|t\.me\/|telegram\.me)/i,
  },
  {
    id: 'scam-upfront',
    category: 'scam',
    severity: 'high',
    label: '疑似要求跳过托管',
    pattern: /(先\s*(转|打|付))|私下(付|转|打款)|不走(平台|托管)|直接(转|打)给我/,
  },
  {
    id: 'abuse',
    category: 'abuse',
    severity: 'medium',
    label: '疑似辱骂 / 威胁',
    pattern: /(傻逼|sb\b|去死|滚\b|草你|fuck\s*you|废物|骗子)/i,
  },
  {
    id: 'pii-id',
    category: 'pii',
    severity: 'high',
    label: '疑似身份证号',
    pattern: /[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/,
  },
  {
    id: 'pii-bankcard',
    category: 'pii',
    severity: 'medium',
    label: '疑似银行卡号',
    pattern: /(?<!\d)(\d{16,19})(?!\d)/,
  },
]

export function quickCheck(text) {
  const body = String(text || '')
  if (!body.trim()) {
    return { ok: true, flagged: false, hits: [], severity: 'none' }
  }

  const hits = []
  for (const rule of rules) {
    if (rule.pattern.test(body)) {
      hits.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        label: rule.label,
      })
    }
  }

  const severity = hits.some((h) => h.severity === 'high')
    ? 'high'
    : hits.some((h) => h.severity === 'medium')
      ? 'medium'
      : hits.length > 0
        ? 'low'
        : 'none'

  return {
    ok: true,
    flagged: hits.length > 0,
    hits,
    severity,
  }
}

const systemPrompt = `你是 WhiteHive 的消息合规助理。WhiteHive 是可信交易平台，订单聊天必须走站内，不允许脱平台交易 / 诈骗 / 辱骂 / 泄漏敏感个人信息。

硬规则：
- 输出严格 JSON，键名 snake_case，不要 markdown 代码块。
- allow 为 true 代表消息可以发送；false 代表应该拦截。
- 中性消息（正常问需求、改稿、确认收货）一律 allow=true。
- 模糊地带偏保守：比如消息里出现疑似微信号但语境是"以后我们只在站内聊"，仍然 allow=true。
- reasons 每条 ≤ 40 字，中文。

输出格式：
{
  "allow": true,
  "severity": "none|low|medium|high",
  "categories": ["offplatform|scam|abuse|pii|spam"],
  "reasons": ["..."],
  "suggested_rewrite": "如果不允许，给一个可以直接发出的改写版本（≤ 120 字），否则 null"
}`

function buildUserPrompt(body, hits) {
  return [
    `待审核消息:\n"""\n${String(body || '').slice(0, 800)}\n"""`,
    hits && hits.length
      ? `规则层已命中的疑似点:\n${hits.map((h) => `- ${h.label} (${h.category}/${h.severity})`).join('\n')}`
      : '规则层未命中，但请你再独立判断一次。',
    '请按系统指令返回 JSON。',
  ].join('\n\n')
}

const allowedCategories = new Set(['offplatform', 'scam', 'abuse', 'pii', 'spam'])
const allowedSeverity = new Set(['none', 'low', 'medium', 'high'])

export async function moderateMessage(input = {}) {
  const body = String(input.body || '').trim()
  const quick = quickCheck(body)

  if (!body) {
    return { ok: false, reason: 'empty_input' }
  }

  if (!isDeepSeekConfigured()) {
    // Without LLM, we still return a useful result based on rules alone.
    return {
      ok: true,
      source: 'rules',
      allow: quick.severity !== 'high',
      severity: quick.severity,
      categories: Array.from(new Set(quick.hits.map((h) => h.category))),
      reasons: quick.hits.map((h) => h.label),
      suggestedRewrite: null,
      ruleHits: quick.hits,
    }
  }

  const result = await callDeepSeek({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(body, quick.hits) },
    ],
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 500,
  })

  if (!result.ok) {
    // Graceful fallback to rule decision
    return {
      ok: true,
      source: 'rules-fallback',
      allow: quick.severity !== 'high',
      severity: quick.severity,
      categories: Array.from(new Set(quick.hits.map((h) => h.category))),
      reasons: quick.hits.map((h) => h.label),
      suggestedRewrite: null,
      ruleHits: quick.hits,
      llmReason: result.reason,
    }
  }

  const parsed = parseJsonFromLlm(result.text)
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: true,
      source: 'rules-fallback',
      allow: quick.severity !== 'high',
      severity: quick.severity,
      categories: Array.from(new Set(quick.hits.map((h) => h.category))),
      reasons: quick.hits.map((h) => h.label),
      suggestedRewrite: null,
      ruleHits: quick.hits,
      llmReason: 'llm_bad_json',
    }
  }

  const severity = String(parsed.severity || '').toLowerCase()
  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.map((c) => String(c).toLowerCase()).filter((c) => allowedCategories.has(c))
    : []

  return {
    ok: true,
    source: 'llm',
    allow: parsed.allow !== false,
    severity: allowedSeverity.has(severity) ? severity : quick.severity,
    categories: Array.from(new Set(categories)),
    reasons: Array.isArray(parsed.reasons)
      ? parsed.reasons
          .map((r) => String(r || '').trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 4)
      : [],
    suggestedRewrite:
      parsed.suggested_rewrite || parsed.suggestedRewrite
        ? String(parsed.suggested_rewrite || parsed.suggestedRewrite).trim().slice(0, 240)
        : null,
    ruleHits: quick.hits,
    model: result.model,
    usage: result.usage,
  }
}
