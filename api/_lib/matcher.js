import { createId, nowIso } from './ids.js'
import { HttpError } from './http.js'
import { listServices } from './store.js'

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
    reasons.push(`AI 从描述中识别出 ${categoryReason(service.category)} 方向。`)
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

export async function createMatch(input = {}) {
  const limit = parseLimit(input.limit)
  const text = demandText(input)

  if (!text && !input.category) {
    throw new HttpError(400, 'missing_match_input', '请至少提供需求描述或分类。')
  }

  const signals = extractSignals(text)
  const services = await listServices({ status: 'published' })
  const matches = services
    .map((service) => scoreService(service, input, signals))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const top = matches[0]

  return {
    id: createId('mat'),
    engine: 'whitehive-rule-match-v1',
    createdAt: nowIso(),
    query: {
      category: input.category || null,
      budgetCents: numberOrUndefined(input.budgetCents) || null,
      deadline: input.deadline || null,
      signals,
    },
    confidence: confidenceFrom(matches, input),
    matches,
    clarifyingQuestions: questionsFor(input, matches),
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
