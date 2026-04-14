// 所有假数据集中在这里，后续接入后端只需替换数据源
// color 用 hex，让每个分类 / 支柱有独立色调，区分度更高

export const services = [
  {
    slug: 'web',
    title: '网页搭建与落地页',
    icon: 'browser',
    color: '#38BDF8', // sky
    tagline: '把一个想法，变成一个能被访问的网站。',
    audience: ['初创团队', '个人品牌', '活动主办'],
    deliverables: [
      '响应式官网 / 落地页',
      '从域名到部署的完整上线',
      '基础 SEO 与性能优化',
      '后续可维护的代码结构',
    ],
    example: '为一个独立游戏工作室搭一个首页和预约试玩落地页。',
  },
  {
    slug: 'design',
    title: '设计包装与视觉表达',
    icon: 'palette',
    color: '#F472B6', // rose
    tagline: '让产品和内容，拥有一套说得通的视觉语言。',
    audience: ['小微团队', '品牌主', '内容创作者'],
    deliverables: [
      'Logo 与基础 VI',
      '社交媒体封面与图集',
      '活动 / 发布会物料',
      '前后一致的视觉系统',
    ],
    example: '给一个学生社团做完整的品牌视觉和一套宣传物料。',
  },
  {
    slug: 'resume',
    title: '简历 / 作品集 / PPT 优化',
    icon: 'document',
    color: '#34D399', // emerald
    tagline: '把你的经历和想法，讲成一件能被看懂的事。',
    audience: ['求职者', '学生', '创业者', '演讲者'],
    deliverables: [
      '结构化的简历与作品集',
      '产品级的 Deck 或路演 PPT',
      '叙事逻辑与视觉梳理',
      '多版本适配（中英 / 长短）',
    ],
    example: '帮一位应届博士梳理海外求职的完整申请材料。',
  },
  {
    slug: 'data',
    title: '数据可视化与展示',
    icon: 'chart',
    color: '#A78BFA', // violet
    tagline: '让数据，变成真正能被读懂的洞察。',
    audience: ['研究者', '运营', '产品经理'],
    deliverables: [
      '图表与静态可视化',
      '交互式看板',
      '能讲故事的数据报告',
      '可复用的数据模板',
    ],
    example: '把一份用户调研数据做成可交互的洞察看板。',
  },
  {
    slug: 'video',
    title: '视频剪辑与内容包装',
    icon: 'play',
    color: '#FB923C', // orange
    tagline: '把素材，变成可以被传播的内容。',
    audience: ['自媒体', '品牌方', '教育机构'],
    deliverables: [
      '短视频 / 长视频剪辑',
      '封面 / 字幕 / 转场设计',
      '栏目包装与片头',
      '多平台适配版本',
    ],
    example: '给一档教学栏目做一整套片头和封面系统。',
  },
  {
    slug: 'ai',
    title: 'AI 工具应用与轻自动化',
    icon: 'spark',
    color: '#A3E635', // lime
    tagline: '把 AI 的能力，真正嵌进你的工作流里。',
    audience: ['团队', '效率爱好者', '研究者'],
    deliverables: [
      'Prompt 工程与调优',
      '轻量的自动化工作流',
      'API 调用脚本',
      '可复用的 AI 模板',
    ],
    example: '给一个内容团队搭一条从选题到排版的 AI 流水线。',
  },
  {
    slug: 'gaming',
    title: '游戏代肝与陪练',
    icon: 'gamepad',
    color: '#F87171', // red
    tagline: '把重复的肝，交给信得过的人。',
    audience: ['上班族玩家', '学生玩家', '想上分的玩家'],
    deliverables: [
      '日常任务 / 副本代打',
      '段位冲分 / 通关陪练',
      '账号安全承诺与托管',
      '全程可追溯的服务记录',
    ],
    example: '为一位上班族代完成每周日常任务，按进度结算。',
  },
]

// Pain / Solution 一一配对：顺序就是配对顺序
export const pairs = [
  {
    pain: {
      title: '服务不好比较',
      desc: '描述含糊、价格不透明，买家很难判断谁更合适。',
    },
    solution: {
      title: '结构化的服务卡片',
      desc: '每个服务都用同一套字段描述：交付物、范围、时长、边界。',
    },
  },
  {
    pain: {
      title: '需求只能靠聊',
      desc: '微信上反复确认、截图对齐，边界含糊，容易返工。',
    },
    solution: {
      title: '结构化的需求表单',
      desc: '买家不是发消息，而是填一份系统能读懂的需求。',
    },
  },
  {
    pain: {
      title: '交付没法验收',
      desc: '没有统一的交付标准，"满意" 和 "不满意" 全凭感觉。',
    },
    solution: {
      title: '可验收的交付物',
      desc: '交付前就写清楚：格式、数量、完成标准，验收有据可依。',
    },
  },
  {
    pain: {
      title: '资金缺少保障',
      desc: '私下转账风险高，出了问题双方都没有追索路径。',
    },
    solution: {
      title: '平台资金托管',
      desc: '款项进入平台侧流转，按阶段释放，纠纷时可以回溯。',
    },
  },
  {
    pain: {
      title: '版权与安全模糊',
      desc: '原创归属、API Key、素材授权，长期缺少系统化保护。',
    },
    solution: {
      title: '前置的版权与安全',
      desc: '原创声明、Key 保险箱、合规边界，都在交易开始前就建立。',
    },
  },
]

export const trustPillars = [
  {
    key: 'dispute',
    title: '交易纠纷防控',
    color: '#38BDF8',
    desc: '用结构化需求、分阶段交付和平台仲裁，把纠纷的概率和成本一起压下去。',
    points: ['需求边界在开工前固化', '阶段节点全程留痕', '平台介入仲裁流程'],
    icon: 'shield',
  },
  {
    key: 'escrow',
    title: '资金托管逻辑',
    color: '#34D399',
    desc: '款项先进平台托管账户，按里程碑一步步释放，避免 "先付先跑"。',
    points: ['下单即托管', '按阶段释放', '纠纷可冻结并复核'],
    icon: 'vault',
  },
  {
    key: 'copyright',
    title: '版权保护与原创声明',
    color: '#FBBF24',
    desc: '交付物生成时就绑定原创声明，让版权主张和侵权追溯都有地方下手。',
    points: ['交付即声明', '作者主权清晰', '侵权路径可查'],
    icon: 'copyright',
  },
  {
    key: 'api',
    title: 'API 密钥安全',
    color: '#F472B6',
    desc: 'AI 服务里最常见的 Key 泄漏，用平台侧代理与隔离来兜底。',
    points: ['Key 不落在交付物里', '代理调用与配额', '按次使用可审计'],
    icon: 'key',
  },
  {
    key: 'chain',
    title: '区块链可信存证',
    color: '#A78BFA',
    desc: '关键节点的交付哈希上链留痕，为事后争议留一份中立的凭据。',
    points: ['关键节点留痕', '哈希可校验', '第三方可验证'],
    icon: 'chain',
  },
  {
    key: 'legal',
    title: '合法合规边界',
    color: '#A3E635',
    desc: '哪些能做、哪些不能做，写在明面上，主动把灰色地带挡在门外。',
    points: ['禁售清单透明', '内容安全审查', '合规红线清晰'],
    icon: 'legal',
  },
]

export const steps = [
  { k: '01', title: '浏览服务', desc: '从结构化的分类里找到想要的服务卡片。' },
  { k: '02', title: '提交需求', desc: '用表单而不是聊天，把需求一次性说清楚。' },
  { k: '03', title: '确认边界', desc: '开工前双方就对齐：做什么、不做什么。' },
  { k: '04', title: '开始制作', desc: '款项进入托管，卖家正式进入制作阶段。' },
  { k: '05', title: '提交交付', desc: '按约定的格式提交，平台记录时间与哈希。' },
  { k: '06', title: '修改 / 验收', desc: '有限轮次内修改，达标后完成验收。' },
  { k: '07', title: '完成评价', desc: '结算、归档、留痕，双方留下可信评价。' },
]

export const useCases = [
  {
    tag: '学生 / 求职',
    title: '把作品集变成一次面试机会',
    desc: '一位设计方向的应届生，在 WhiteHive 请同校学长帮忙优化作品集结构，最终拿到了目标公司的面试。',
  },
  {
    tag: '初创团队',
    title: '把一个想法变成能被访问的站点',
    desc: '一个三人初创团队，通过 WhiteHive 在两周内上线了首版官网和预约落地页，用来跑第一轮用户访谈。',
  },
  {
    tag: '研究 / 数据',
    title: '把调研数据变成能被讲清的洞察',
    desc: '一位社科方向的研究者，通过 WhiteHive 把一份调研数据做成了可交互的可视化报告，直接用在了会议展示上。',
  },
]
