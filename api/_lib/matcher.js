import { createId, nowIso } from './ids.js'
import { HttpError } from './http.js'
import { listServices } from './store.js'
import { callDeepSeek, isDeepSeekConfigured, parseJsonFromLlm } from './deepseek.js'

/* ============================================================
   Rule-based matching — always runs as pre-filter and as fallback
   when DeepSeek is not configured or errors.
   ============================================================ */

const categorySignals = {
  web: [
    '官网',
    '落地页',
    '网站',
    '小程序',
    '点餐',
    '扫码',
    '菜单',
    '餐厅',
    '门店',
    '预约',
    '表单',
    '微信支付',
    '收银',
    '后台',
    'vercel',
    'react',
    '前端',
    '上线',
  ],
  design: ['设计', '品牌', '视觉', '海报', 'logo', 'ui', 'figma', '审美'],
  video: ['视频', '剪辑', '短视频', '字幕', '混剪', '脚本', 'b站', '抖音'],
  resume: ['简历', '求职', '面试', '作品集', '留学', '申请', '文书'],
  data: ['数据', '表格', '爬虫', '分析', 'dashboard', '报表', '自动化'],
  ai: ['ai', 'prompt', '智能体', 'agent', '自动化', '工作流', '大模型'],
  gaming: ['游戏', '代肝', '陪玩', '账号', '排位', '开黑', '装备'],
}

const categoryQuestionBank = {
  gaming: [
    {
      key: 'game_context',
      label: '具体是哪款游戏、区服/服务器和账号平台？',
      reason: '不同游戏和区服决定卖家是否能接单。',
    },
    {
      key: 'gaming_goal',
      label: '这次要代肝到什么目标？',
      reason: '明确段位、任务或资源数量，方便报价验收。',
    },
    {
      key: 'gaming_safety',
      label: '账号交接和安全边界有什么要求？',
      reason: '先说清登录方式、禁用操作和截图留痕。',
    },
    {
      key: 'gaming_proof',
      label: '完成后用什么截图或记录验收？',
      reason: '验收标准越清楚，纠纷越少。',
    },
    {
      key: 'gaming_schedule',
      label: '希望服务者在哪些时间段操作？',
      reason: '避免撞上你自己在线或重要活动。',
    },
  ],
  web: [
    {
      key: 'page_scope',
      label: '需要哪些页面和核心功能？',
      reason: '页面和功能范围会直接影响报价与周期。',
    },
    {
      key: 'conversion_goal',
      label: '最希望访问者在页面上完成什么动作？',
      reason: '先明确转化目标，页面设计才不会跑偏。',
    },
    {
      key: 'assets_ready',
      label: '文案、图片、Logo、域名现在准备到什么程度？',
      reason: '素材是否齐全会影响上线速度。',
    },
    {
      key: 'web_integrations',
      label: '是否要接入表单、支付、登录或后台管理？',
      reason: '外部接口会影响技术方案和验收方式。',
    },
    {
      key: 'style_reference',
      label: '有没有参考网站或不想要的风格？',
      reason: '参考能帮助卖家快速判断视觉方向。',
    },
  ],
  design: [
    {
      key: 'design_usage',
      label: '这套设计主要会用在哪里？',
      reason: '使用场景决定尺寸、风格和交付格式。',
    },
    {
      key: 'brand_keywords',
      label: '你希望别人看到后想到哪 3 个关键词？',
      reason: '关键词能把抽象审美转成明确方向。',
    },
    {
      key: 'design_assets',
      label: '已有 Logo、字体、色彩或品牌素材吗？',
      reason: '现有资产会影响是否需要从零设计。',
    },
    {
      key: 'design_formats',
      label: '最终需要哪些文件格式和尺寸？',
      reason: '交付格式写清楚，后续使用才不返工。',
    },
  ],
  video: [
    {
      key: 'video_materials',
      label: '素材现在有哪些，是否需要卖家帮你补素材？',
      reason: '素材完整度决定剪辑工作量。',
    },
    {
      key: 'video_platform',
      label: '视频主要发在哪个平台，目标时长是多少？',
      reason: '平台和时长会影响节奏、字幕和画幅。',
    },
    {
      key: 'video_style',
      label: '想要什么剪辑风格或参考账号？',
      reason: '风格参考能减少来回试错。',
    },
    {
      key: 'video_deliverables',
      label: '需要封面、字幕、片头或多平台版本吗？',
      reason: '附加交付物会影响报价和验收。',
    },
  ],
  resume: [
    {
      key: 'target_context',
      label: '这份材料要投递/展示给谁看？',
      reason: '目标对象决定叙事重点。',
    },
    {
      key: 'source_materials',
      label: '你已有简历、作品、经历素材到什么程度？',
      reason: '素材越完整，卖家越能快速重构。',
    },
    {
      key: 'resume_language',
      label: '需要中文、英文，还是多版本适配？',
      reason: '语言版本会影响工作量。',
    },
    {
      key: 'proof_points',
      label: '最想突出哪几段经历或成果？',
      reason: '亮点先定好，材料更容易打动人。',
    },
  ],
  data: [
    {
      key: 'data_source',
      label: '数据现在在哪里，格式是什么？',
      reason: '数据来源决定清洗和接入难度。',
    },
    {
      key: 'data_decision',
      label: '你希望这份图表/看板帮你做什么判断？',
      reason: '先定决策问题，图表才有重点。',
    },
    {
      key: 'data_output',
      label: '最终要静态报告、交互看板，还是可复用模板？',
      reason: '交付形态会影响技术方案。',
    },
    {
      key: 'data_update',
      label: '数据需要一次性交付，还是后续持续更新？',
      reason: '更新频率决定是否要自动化。',
    },
  ],
  ai: [
    {
      key: 'workflow_steps',
      label: '你想把哪几步工作交给 AI/自动化？',
      reason: '拆清步骤才能判断适合脚本还是工作流。',
    },
    {
      key: 'current_tools',
      label: '现在用哪些工具或平台处理这件事？',
      reason: '现有工具决定接入方式。',
    },
    {
      key: 'ai_input_output',
      label: '每次输入什么，期望 AI 输出什么格式？',
      reason: '输入输出越清楚，调试成本越低。',
    },
    {
      key: 'data_privacy',
      label: '里面有没有账号、客户资料或敏感数据？',
      reason: '敏感数据需要提前设计安全边界。',
    },
  ],
}

const genericQuestionBank = [
  {
    key: 'desired_outcome',
    label: '你最想让卖家帮你解决哪一个核心问题？',
    reason: '先抓住核心问题，匹配不会被表面描述带偏。',
  },
  {
    key: 'deliverable_shape',
    label: '最终你希望收到什么形式的交付物？',
    reason: '交付形态决定卖家类型和报价方式。',
  },
  {
    key: 'acceptance_standard',
    label: '什么结果出现时，你会觉得这单已经达标？',
    reason: '验收标准前置能减少纠纷。',
  },
  {
    key: 'hard_constraints',
    label: '有没有不能碰的限制、禁区或特殊要求？',
    reason: '边界越早说清，合作越稳。',
  },
]

const intentProfiles = [
  {
    key: 'restaurant_ordering_app',
    category: 'web',
    detect(text) {
      return (
        hasAny(text, ['餐厅点餐', '点餐小程序', '扫码点餐']) ||
        (hasAny(text, ['餐厅', '饭店', '餐饮', '奶茶', '咖啡', '门店']) &&
          hasAny(text, ['点餐', '菜单', '下单', '扫码', '外卖', '自提', '小程序']))
      )
    },
    questions: [
      {
        key: 'restaurant_service_mode',
        label: '这套餐饮小程序主要做堂食扫码点餐、外卖自提，还是两者都要？',
        reason: '服务模式决定页面流程和订单状态。',
      },
      {
        key: 'restaurant_menu_scope',
        label: '菜单大概有多少类/多少菜品，是否有规格、加料、库存或套餐？',
        reason: '菜单复杂度会直接影响报价。',
      },
      {
        key: 'restaurant_payment_integrations',
        label: '需要接微信支付、会员优惠、打印小票或现有收银/POS 吗？',
        reason: '外部接入决定技术难度和资质要求。',
      },
      {
        key: 'restaurant_staff_backend',
        label: '店员后台需要处理哪些动作：接单、出餐提醒、改价、退款还是核销？',
        reason: '后台权限和流程要提前定清楚。',
      },
      {
        key: 'restaurant_launch_assets',
        label: '现在已有小程序账号、营业执照、菜单图片和门店信息吗？',
        reason: '上线资料会影响能否按期发布。',
      },
    ],
  },
  {
    key: 'wechat_mini_program',
    category: 'web',
    detect(text) {
      return hasAny(text, ['小程序', '微信小程序']) && !hasAny(text, ['餐厅', '饭店', '点餐', '菜单'])
    },
    questions: [
      {
        key: 'mini_program_roles',
        label: '这个小程序有哪些用户角色，分别要完成什么动作？',
        reason: '角色边界决定功能拆分。',
      },
      {
        key: 'mini_program_core_flow',
        label: '用户从进入小程序到完成目标，最核心的 3 步流程是什么？',
        reason: '先抓主流程，避免功能发散。',
      },
      {
        key: 'mini_program_integrations',
        label: '需要接微信登录、支付、订阅消息、地图或后台管理吗？',
        reason: '微信能力接入会影响周期和资质。',
      },
      {
        key: 'mini_program_launch_assets',
        label: '小程序账号、主体资质、Logo、文案和图片现在准备到哪一步？',
        reason: '资料缺口会影响上线排期。',
      },
    ],
  },
]

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

function hasAny(text, words) {
  const normalized = normalize(text)
  return words.some((word) => normalized.includes(normalize(word)))
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

function inferCategory(input, matches, signals) {
  const explicit = normalize(input.category)
  if (explicit && explicit !== 'any') return explicit

  const intent = inferIntent(input)
  if (intent?.category) return intent.category

  const categories = Object.keys(categorySignals)
  const signaled = categories.find((category) => signals.includes(category))
  if (signaled) return signaled

  const confidentMatch = matches.find(
    (match) => categories.includes(match.service?.category) && Number(match.score) >= 58,
  )
  return confidentMatch?.service?.category || 'unknown'
}

function questionKey(question) {
  return String(question?.key || question?.label || '').trim()
}

function pushQuestion(questions, question) {
  if (!question?.label) return
  if (questions.some((item) => questionKey(item) === questionKey(question))) return
  questions.push(question)
}

function inferIntent(input) {
  const text = demandText(input)
  return intentProfiles.find((profile) => profile.detect(text)) || null
}

function isGenericClarifyingQuestion(question) {
  const key = questionKey(question)
  const label = normalize(question?.label)
  if (genericQuestionBank.some((item) => item.key === key || normalize(item.label) === label)) {
    return true
  }
  return /核心问题|交付物|达标|特殊要求|还有什么|补充/.test(label)
}

function mergeClarifyingQuestions(llmQuestions, ruleQuestions) {
  if (!Array.isArray(llmQuestions) || llmQuestions.length === 0) return ruleQuestions
  if (!Array.isArray(ruleQuestions) || ruleQuestions.length === 0) return llmQuestions.slice(0, 4)

  const hasSpecificRuleQuestions = ruleQuestions.some((question) => !isGenericClarifyingQuestion(question))
  if (!hasSpecificRuleQuestions) return llmQuestions.slice(0, 4)

  const specificLlmQuestions = llmQuestions.filter((question) => !isGenericClarifyingQuestion(question))
  if (specificLlmQuestions.length >= 2) {
    const merged = []
    specificLlmQuestions.forEach((question) => pushQuestion(merged, question))
    ruleQuestions.forEach((question) => pushQuestion(merged, question))
    return merged.slice(0, 4)
  }

  const merged = []
  ruleQuestions.forEach((question) => pushQuestion(merged, question))
  specificLlmQuestions.forEach((question) => pushQuestion(merged, question))
  llmQuestions.forEach((question) => pushQuestion(merged, question))

  return merged.slice(0, 4)
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

function questionsFor(input, matches, signals = extractSignals(demandText(input))) {
  const questions = []
  const category = inferCategory(input, matches, signals)
  const intent = inferIntent(input)

  if (!numberOrUndefined(input.budgetCents)) {
    pushQuestion(questions, {
      key: 'budget',
      label: '你的预算上限大概是多少？',
      reason: '预算会影响能否匹配到起步价合适的服务。',
    })
  }

  if (!input.deadline) {
    pushQuestion(questions, {
      key: 'deadline',
      label: '你希望多久内完成？',
      reason: '时限会影响卖家的档期和交付拆分方式。',
    })
  }

  if (intent?.questions?.length) {
    intent.questions.forEach((question) => pushQuestion(questions, question))
  }

  const categoryQuestions = categoryQuestionBank[category] || genericQuestionBank
  categoryQuestions.forEach((question) => pushQuestion(questions, question))

  if (!categoryQuestionBank[category] && (!input.brief || String(input.brief).trim().length < 16)) {
    pushQuestion(questions, {
      key: 'need_detail',
      label: '能不能再补一句你真正想解决的场景？',
      reason: '场景越具体，匹配越不容易跑偏。',
    })
  }

  if (matches.some((match) => match.fit === 'weak')) {
    const scopeQuestion = {
      gaming: {
        key: 'gaming_trial',
        label: '如果目标比较大，能接受先试单一小段进度吗？',
        reason: '试单能降低账号和效果风险。',
      },
      web: {
        key: 'web_mvp_scope',
        label: '如果预算或周期紧，哪些功能必须首版上线？',
        reason: '先区分必做和可后置，成交更容易。',
      },
    }[category] || {
      key: 'scope_tradeoff',
      label: '如果预算或周期不完全匹配，你最愿意压缩哪一块？',
      reason: '提前说清取舍，卖家更容易给方案。',
    }
    pushQuestion(questions, scopeQuestion)
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
3. 像真实交易顾问一样，先判断项目类型、使用对象、核心流程、已有材料、上线/交付依赖，再生成 2-4 条「回答后会改变卖家匹配、报价、周期或验收方式」的追问

严格规则：
- 只能使用候选服务列表里提供的 id。绝不编造服务。
- 买家已经填写过的字段（预算、时限、分类、主要目标）不要再追问。
- reasons / warnings 每条 ≤ 40 字，中文，避免空话如「非常合适」。
- 不要靠单个关键词套固定表单。必须综合描述、预算、时限、分类、已答内容和候选服务能力判断缺口。
- 追问 label 要具体、能直接抄答，而不是「你还有什么想法」这种开放题。
- 禁止泛泛追问「核心问题」「交付物形式」「什么算达标」「有没有特殊要求」，除非买家描述几乎为空。
- 追问必须贴合真实交易语境。比如：
  - 餐厅点餐小程序：问堂食/外卖/自提模式、菜单规格与菜品数量、微信支付/会员/打印/POS、店员后台动作、上线资料。
  - 游戏代肝：问游戏名/区服/目标/账号安全/验收截图。
  - 官网落地页：问页面结构、转化动作、素材准备、表单/支付/后台接入、参考风格。
- 每个问题只问一个关键缺口，避免把多个无关问题塞在一起。
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

function buildLlmUserPrompt(input, candidates, ruleQuestionHints = []) {
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
  const hintText = ruleQuestionHints.length
    ? ruleQuestionHints
        .map((question) => `  - ${question.label}（${question.reason || '会影响匹配'}）`)
        .join('\n')
    : ''

  return `买家需求:
${buyer}

候选服务 (已按规则预筛，${candidates.length} 条):
${servicesJson}

规则层初步发现的缺口线索（仅作参考，不要照抄；如果你能从上下文判断出更关键的问题，请重写）:
${hintText || '  - 暂无'}

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

  const signals = extractSignals(demandText(input))
  const ruleQuestionHints = questionsFor(input, ruleMatches, signals).slice(0, 4)
  const userPrompt = buildLlmUserPrompt(input, candidates, ruleQuestionHints)

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

  const ruleClarifyingQuestions = questionsFor(input, finalMatches, signals)
  const clarifyingQuestions =
    llm.ok && llm.clarifyingQuestions.length > 0
      ? mergeClarifyingQuestions(llm.clarifyingQuestions, ruleClarifyingQuestions)
      : ruleClarifyingQuestions

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
