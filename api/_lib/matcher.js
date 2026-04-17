import { createId, nowIso } from './ids.js'
import { HttpError } from './http.js'
import { listServices } from './store.js'
import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'

/* ============================================================
   Rule-based matching — always runs as pre-filter and as fallback
   when DeepSeek is not configured or errors.
   ============================================================ */

const categorySignals = {
  web: ['官网', '落地页', '网站', '预约', '表单', 'vercel', 'react', '前端', '上线'],
  design: ['设计', '品牌', '视觉', '海报', 'logo', 'ui', 'figma', '审美'],
  video: ['视频', '剪辑', '短视频', '字幕', '混剪', '脚本', 'b站', '抖音'],
  resume: ['简历', '求职', '面试', '作品集', '留学', '申请', '文书'],
  data: ['数据', '表格', '爬虫', '分析', 'dashboard', '报表', '自动化'],
  ai: ['ai', 'prompt', '智能体', 'agent', '自动化', '工作流', '大模型'],
  gaming: ['游戏', '代肝', '陪玩', '账号', '排位', '开黑', '装备'],
}

const commonSignals = [
  '创业',
  '比赛',
  '路演',
  '小红书',
  '微信',
  '支付',
  '登录',
  '实名认证',
  '聊天',
  '移动端',
  '响应式',
  '安全',
  '可信',
  '托管',
]

const deadlineDays = [
  [/今天|当天|24\s*h|1\s*天/, 1],
  [/3\s*天|三天|3天/, 3],
  [/一周|1\s*周|7\s*天|7天/, 7],
  [/两周|2\s*周|14\s*天|14天/, 14],
  [/一个月|1\s*个月|30\s*天|30天/, 30],
]

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function numberOrUndefined(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function parseLimit(value) {
  const number = Number(value || 5)
  if (!Number.isFinite(number)) return 5
  return clamp(Math.round(number), 1, 10)
}

function parseDeadlineDays(deadline) {
  const text = normalize(deadline)
  if (!text) return undefined

  const matched = deadlineDays.find(([pattern]) => pattern.test(text))
  return matched?.[1]
}

function demandText(input) {
  const answers = input.answers && typeof input.answers === 'object' ? Object.values(input.answers) : []
  return [
    input.title,
    input.brief,
    input.goal,
    input.notes,
    input.deadline,
    input.category,
    ...answers,
  ]
    .map(normalize)
    .filter(Boolean)
    .join(' ')
}

function extractSignals(text) {
  const normalized = normalize(text)
  const signals = new Set()

  commonSignals.forEach((signal) => {
    if (normalized.includes(normalize(signal))) {
      signals.add(signal)
    }
  })

  Object.entries(categorySignals).forEach(([category, words]) => {
    words.forEach((signal) => {
      if (normalized.includes(normalize(signal))) {
        signals.add(signal)
        signals.add(category)
      }
    })
  })

  const alphaTokens = normalized.match(/[a-z0-9][a-z0-9-]{1,}/g) || []
  alphaTokens.slice(0, 16).forEach((token) => signals.add(token))

  return Array.from(signals).slice(0, 28)
}

function serviceText(service) {
  return normalize([
    service.category,
    service.title,
    service.summary,
    ...(service.tags || []),
    service.seller?.displayName,
  ].join(' '))
}

function categoryReason(category) {
  const labels = {
    web: '官网/落地页',
    design: '视觉设计',
    video: '视频内容',
    resume: '简历文书',
    data: '数据自动化',
    ai: 'AI 工作流',
    gaming: '游戏服务',
  }
  return labels[category] || category
}

function scoreService(service, input, signals) {
  const reasons = []
  const warnings = []
  const text = serviceText(service)
  let score = 18

  const category = normalize(input.category)
  if (category && category !== 'any') {
    if (service.category === category) {
      score += 30
      reasons.push(`分类直接匹配：${categoryReason(service.category)}`)
    } else if (signals.includes(service.category)) {
      score += 14
      reasons.push(`需求文本提到了相邻分类：${categoryReason(service.category)}`)
    } else {
      score -= 8
      warnings.push('分类不是买家首选，需要进一步确认边界。')
    }
  } else if (signals.includes(service.category)) {
    score += 18
    reasons.push(`规则从描述中识别出 ${categoryReason(service.category)} 方向。`)
  } else {
    score += 5
  }

  let keywordHits = 0
  signals.forEach((signal) => {
    if (text.includes(normalize(signal))) {
      keywordHits += 1
    }
  })

  if (keywordHits > 0) {
    const keywordScore = Math.min(24, keywordHits * 4)
    score += keywordScore
    reasons.push(`关键词命中 ${keywordHits} 个。`)
  }

  const budgetCents = numberOrUndefined(input.budgetCents)
  if (budgetCents) {
    const ratio = Number(service.priceCents || 0) / budgetCents
    if (ratio <= 1) {
      score += 20
      reasons.push('预算覆盖该服务起步价。')
    } else if (ratio <= 1.2) {
      score += 12
      warnings.push('服务起步价略高于预算，可尝试缩小范围。')
    } else if (ratio <= 1.5) {
      score += 5
      warnings.push('预算偏紧，需要卖家确认是否可拆分交付。')
    } else {
      score -= 12
      warnings.push('服务价格明显高于预算。')
    }
  } else {
    score += 4
    warnings.push('缺少预算，匹配结果只能先按服务相关度排序。')
  }

  const days = parseDeadlineDays(input.deadline)
  if (days && service.deliveryDays) {
    if (service.deliveryDays <= days) {
      score += 10
      reasons.push('交付周期满足时限。')
    } else if (service.deliveryDays <= days * 1.5) {
      score += 4
      warnings.push('交付周期略紧，需要卖家确认档期。')
    } else {
      score -= 8
      warnings.push('交付周期可能无法满足时限。')
    }
  }

  if (service.seller?.verificationStatus === 'verified') {
    score += 6
    reasons.push('卖家已实名认证。')
  } else if (service.seller?.verificationStatus === 'pending') {
    score += 2
    warnings.push('卖家实名认证仍在审核中。')
  }

  const finalScore = clamp(Math.round(score), 0, 100)
  return {
    service,
    score: finalScore,
    fit: finalScore >= 78 ? 'strong' : finalScore >= 58 ? 'possible' : 'weak',
    reasons: reasons.slice(0, 4),
    warnings: warnings.slice(0, 3),
  }
}

function questionsFor(input, matches) {
  const questions = []

  if (!numberOrUndefined(input.budgetCents)) {
    questions.push({
      key: 'budget',
      label: '你的预算上限大概是多少？',
      reason: '预算会影响能否匹配到起步价合适的服务。',
    })
  }

  if (!input.deadline) {
    questions.push({
      key: 'deadline',
      label: '你希望多久内完成？',
      reason: '时限会影响卖家的档期和交付拆分方式。',
    })
  }

  if (!input.brief || String(input.brief).trim().length < 16) {
    questions.push({
      key: 'brief',
      label: '你能再补充一下具体交付物吗？',
      reason: '越清楚的交付物，越容易减少交易纠纷。',
    })
  }

  if (matches.some((match) => match.fit === 'weak')) {
    questions.push({
      key: 'scope',
      label: '你能接受先做一个较小版本吗？',
      reason: '当预算、周期或分类不完全匹配时，拆分 MVP 更容易成交。',
    })
  }

  return questions.slice(0, 4)
}

function confidenceFrom(matches, input) {
  if (matches.length === 0) return 'low'
  const best = matches[0].score
  const hasBudget = Boolean(numberOrUndefined(input.budgetCents))
  const hasBrief = Boolean(input.brief && String(input.brief).trim().length >= 16)

  if (best >= 78 && hasBudget && hasBrief) return 'high'
  if (best >= 58) return 'medium'
  return 'low'
}

/* ============================================================
   LLM layer — DeepSeek-powered enrichment
   ============================================================ */

const llmSystemPrompt = `你是 WhiteHive 的 AI 匹配助理。WhiteHive 是一个可信交易平台，连接青年创作者、自由职业者、学生卖家，与个人买家。你的任务：

1. 理解买家结构化需求 + 自由文本描述
2. 从给定候选服务中挑选最匹配的 3-5 个，给出自然语言的匹配理由和警告
3. 根据买家已经给出的信息，生成 2-4 条「还缺什么我们才能帮你选得更准」的追问

严格规则：
- 只能使用候选服务列表里提供的 id。绝不编造服务。
- 买家已经填写过的字段（预算、时限、分类、主要目标）不要再追问。
- reasons / warnings 每条 ≤ 40 字，中文，避免空话如「非常合适」。
- 追问 label 要具体、能直接抄答，而不是「你还有什么想法」这种开放题。
- 输出严格 JSON，键名使用 snake_case，不要包含 markdown 代码块。

输出格式：
{
  "intent": {
    "category_guess": "web|design|video|resume|data|ai|gaming|unknown",
    "budget_clarity": "clear|rough|missing",
    "deadline_clarity": "clear|rough|missing",
    "summary": "一句话总结买家要的是什么（≤ 60 字）"
  },
  "clarifying_questions": [
    { "key": "reference", "label": "问题文本", "reason": "为什么问这个（≤ 30 字）" }
  ],
  "rankings": [
    {
      "id": "svc_xxx",
      "score": 0-100,
      "fit": "strong|possible|weak",
      "reasons": ["..."],
      "warnings": ["..."]
    }
  ]
}`

function compactServiceForLlm(service) {
  return {
    id: service.id,
    category: service.category,
    title: service.title,
    summary: (service.summary || '').slice(0, 200),
    tags: (service.tags || []).slice(0, 6),
    priceCents: service.priceCents || null,
    deliveryDays: service.deliveryDays || null,
    seller: service.seller
      ? {
          displayName: service.seller.displayName || null,
          verificationStatus: service.seller.verificationStatus || null,
          role: service.seller.role || null,
        }
      : null,
  }
}

function buildLlmUserPrompt(input, candidates) {
  const budget = numberOrUndefined(input.budgetCents)
  const answersEntries =
    input.answers && typeof input.answers === 'object'
      ? Object.entries(input.answers)
          .map(([k, v]) => `  - ${k}: ${String(v || '').slice(0, 200)}`)
          .join('\n')
      : ''

  const buyer = [
    `分类: ${input.category || '(买家未指定)'}`,
    `预算(CNY分): ${budget ? budget : '(未提供)'}`,
    `时限: ${input.deadline || '(未提供)'}`,
    `主要目标/标题: ${input.title || input.goal || '(未提供)'}`,
    `描述/brief: ${input.brief || '(未提供)'}`,
    input.notes ? `补充备注: ${input.notes}` : '',
    answersEntries ? `追问答案:\n${answersEntries}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const servicesJson = JSON.stringify(candidates.map(compactServiceForLlm), null, 0)

  return `买家需求:
${buyer}

候选服务 (已按规则预筛，${candidates.length} 条):
${servicesJson}

请按系统指令返回 JSON。`
}

function clampScore(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return clamp(Math.round(number), 0, 100)
}

function sanitizeStringArray(value, maxLen = 40, maxItems = 4) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => (item.length > maxLen ? item.slice(0, maxLen) : item))
}

function sanitizeClarifyingQuestions(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const key = String(item.key || item.id || '').trim().slice(0, 32) || 'detail'
      const label = String(item.label || item.question || '').trim().slice(0, 80)
      if (!label) return null
      const reason = String(item.reason || item.rationale || '').trim().slice(0, 80)
      return { key, label, reason }
    })
    .filter(Boolean)
    .slice(0, 4)
}

function fitFrom(score, fallback) {
  if (score >= 78) return 'strong'
  if (score >= 58) return 'possible'
  if (score > 0) return 'weak'
  return fallback || 'weak'
}

function mergeLlmRankings(llmRankings, ruleMatches, limit) {
  if (!Array.isArray(llmRankings) || llmRankings.length === 0) {
    return ruleMatches.slice(0, limit)
  }

  const ruleById = new Map(ruleMatches.map((match) => [match.service.id, match]))
  const merged = []

  for (const ranking of llmRankings) {
    if (!ranking || typeof ranking !== 'object') continue
    const id = String(ranking.id || '').trim()
    const ruleMatch = ruleById.get(id)
    if (!ruleMatch) continue

    const llmScore = clampScore(ranking.score)
    const finalScore = llmScore > 0 ? llmScore : ruleMatch.score
    const llmReasons = sanitizeStringArray(ranking.reasons, 60, 4)
    const llmWarnings = sanitizeStringArray(ranking.warnings, 60, 3)

    merged.push({
      service: ruleMatch.service,
      score: finalScore,
      fit: typeof ranking.fit === 'string' ? ranking.fit : fitFrom(finalScore, ruleMatch.fit),
      reasons: llmReasons.length > 0 ? llmReasons : ruleMatch.reasons,
      warnings: llmWarnings.length > 0 ? llmWarnings : ruleMatch.warnings,
    })

    if (merged.length >= limit) break
  }

  // Top up from rule matches if LLM returned fewer than limit
  if (merged.length < limit) {
    const usedIds = new Set(merged.map((m) => m.service.id))
    for (const match of ruleMatches) {
      if (usedIds.has(match.service.id)) continue
      merged.push(match)
      if (merged.length >= limit) break
    }
  }

  return merged.sort((a, b) => b.score - a.score)
}

async function runLlmEnrichment(input, ruleMatches, preFilterSize) {
  if (!isDeepSeekConfigured()) {
    return { ok: false, reason: 'not_configured' }
  }

  const candidates = ruleMatches.slice(0, preFilterSize).map((match) => match.service)
  if (candidates.length === 0) {
    return { ok: false, reason: 'no_candidates' }
  }

  const userPrompt = buildLlmUserPrompt(input, candidates)

  const result = await callDeepSeek({
    messages: [
      { role: 'system', content: llmSystemPrompt },
      { role: 'user', content: userPrompt },
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
    return { ok: false, reason: 'llm_bad_json', rawPreview: result.text.slice(0, 200) }
  }

  return {
    ok: true,
    intent: parsed.intent && typeof parsed.intent === 'object' ? parsed.intent : null,
    clarifyingQuestions: sanitizeClarifyingQuestions(parsed.clarifying_questions || parsed.clarifyingQuestions),
    rankings: Array.isArray(parsed.rankings) ? parsed.rankings : [],
    usage: result.usage,
    model: result.model,
  }
}

/* ============================================================
   Public API — preserves legacy shape
   ============================================================ */

export async function createMatch(input = {}) {
  const limit = parseLimit(input.limit)
  const text = demandText(input)

  if (!text && !input.category) {
    throw new HttpError(400, 'missing_match_input', '请至少提供需求描述或分类。')
  }

  const signals = extractSignals(text)
  const services = await listServices({ status: 'published' })

  // Rule-based scoring always runs first as pre-filter and safety net.
  const ruleRanked = services
    .map((service) => scoreService(service, input, signals))
    .sort((a, b) => b.score - a.score)

  const preFilterSize = Math.min(ruleRanked.length, Math.max(limit * 3, 12))
  const ruleTop = ruleRanked.slice(0, preFilterSize)

  // Attempt LLM enrichment; on any failure we gracefully fall back to rule output.
  const llm = await runLlmEnrichment(input, ruleTop, preFilterSize)

  const finalMatches = llm.ok
    ? mergeLlmRankings(llm.rankings, ruleTop, limit)
    : ruleTop.slice(0, limit)

  const clarifyingQuestions =
    llm.ok && llm.clarifyingQuestions.length > 0
      ? llm.clarifyingQuestions
      : questionsFor(input, finalMatches)

  const top = finalMatches[0]

  return {
    id: createId('mat'),
    engine: llm.ok ? 'whitehive-deepseek-v1' : 'whitehive-rule-match-v1',
    engineDetails: {
      llmUsed: llm.ok,
      llmReason: llm.ok ? null : llm.reason || null,
      llmModel: llm.ok ? llm.model : null,
      llmUsage: llm.ok ? llm.usage : null,
      preFilterSize,
      totalCandidates: services.length,
    },
    createdAt: nowIso(),
    query: {
      category: input.category || null,
      budgetCents: numberOrUndefined(input.budgetCents) || null,
      deadline: input.deadline || null,
      signals,
      llmIntent: llm.ok ? llm.intent : null,
    },
    confidence: confidenceFrom(finalMatches, input),
    matches: finalMatches,
    clarifyingQuestions,
    suggestedOrderDraft: top
      ? {
          serviceId: top.service.id,
          category: top.service.category,
          title: input.title || input.goal || top.service.title,
          brief: input.brief || input.notes || `我想咨询：${top.service.title}`,
          budgetCents: numberOrUndefined(input.budgetCents) || top.service.priceCents,
        }
      : null,
  }
}
