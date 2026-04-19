// 每个分类一份独立的商品数据 + 独立的展示模板 + 独立的筛选器。
// layout: gallery | docs | dashboard | workflow | list
// 这样每个分类的详情页视觉与信息密度都不同,避免"一模一样"。

export const categoryDetails = {
  /* ============================================================
     网页搭建与落地页 —— Gallery 视觉大图
     ============================================================ */
  web: {
    slug: 'web',
    title: '网页搭建与落地页',
    tagline: '从一个想法到一个能被访问的网站,最快 72 小时。',
    color: '#7FD3FF',
    layout: 'gallery',
    metrics: [
      { label: '在售作品', value: '142' },
      { label: '活跃创作者', value: '38' },
      { label: '平均交付', value: '5.2 天' },
      { label: '过往验收率', value: '97%' },
    ],
    filters: ['全部', '落地页', '官网', '作品集站', '活动站'],
    listings: [],
  },

  /* ============================================================
     设计包装 —— Masonry 视觉作品墙
     ============================================================ */
  design: {
    slug: 'design',
    title: '设计包装与视觉表达',
    tagline: '让每一个品牌都有一套自己的视觉语言。',
    color: '#A5B4FC',
    layout: 'gallery',
    metrics: [
      { label: '在售作品', value: '218' },
      { label: '活跃创作者', value: '62' },
      { label: '平均交付', value: '4.6 天' },
      { label: '复购率', value: '41%' },
    ],
    filters: ['全部', 'Logo & VI', '社交图集', '活动物料', '品牌系统'],
    listings: [],
  },

  /* ============================================================
     简历 / 作品集 / PPT —— Docs 文档列表
     ============================================================ */
  resume: {
    slug: 'resume',
    title: '简历 / 作品集 / PPT 优化',
    tagline: '把你的经历和想法,讲成一件能被看懂的事。',
    color: '#5EEAD4',
    layout: 'docs',
    metrics: [
      { label: '在售作品', value: '96' },
      { label: '活跃创作者', value: '47' },
      { label: '平均交付', value: '3.1 天' },
      { label: '学员去向', value: 'FAANG / 藤校' },
    ],
    filters: ['全部', '求职简历', '留学材料', '作品集', '路演 PPT'],
    listings: [],
  },

  /* ============================================================
     数据可视化 —— Dashboard 大特写
     ============================================================ */
  data: {
    slug: 'data',
    title: '数据可视化与展示',
    tagline: '让数据,变成真正能被读懂的洞察。',
    color: '#A5B4FC',
    layout: 'dashboard',
    metrics: [
      { label: '在售看板', value: '54' },
      { label: '活跃创作者', value: '29' },
      { label: '平均交付', value: '6.4 天' },
      { label: '平均数据点', value: '12K+' },
    ],
    filters: ['全部', '交互看板', '静态图集', '报告', '数据清洗'],
    listings: [],
  },

  /* ============================================================
     视频剪辑 —— Gallery 视频墙
     ============================================================ */
  video: {
    slug: 'video',
    title: '视频剪辑与内容包装',
    tagline: '把素材,变成可以被传播的内容。',
    color: '#7FD3FF',
    layout: 'gallery',
    metrics: [
      { label: '在售作品', value: '186' },
      { label: '活跃创作者', value: '54' },
      { label: '平均交付', value: '4.8 天' },
      { label: '短视频占比', value: '62%' },
    ],
    filters: ['全部', '短视频', '长视频', '片头包装', '字幕特效'],
    listings: [],
  },

  /* ============================================================
     AI 工具应用 —— Workflow 工作流
     ============================================================ */
  ai: {
    slug: 'ai',
    title: 'AI 工具应用与轻自动化',
    tagline: '把 AI 的能力,嵌进你的真实工作流里。',
    color: '#A5B4FC',
    layout: 'workflow',
    metrics: [
      { label: '在售工作流', value: '73' },
      { label: '活跃创作者', value: '41' },
      { label: '平均交付', value: '3.5 天' },
      { label: '月均调用', value: '2.8M' },
    ],
    filters: ['全部', '内容流水线', '数据处理', '客服/问答', 'Prompt 定制'],
    listings: [],
  },

  /* ============================================================
     游戏护航 —— List 服务列表
     ============================================================ */
  gaming: {
    slug: 'gaming',
    title: '游戏护航，代肝',
    tagline: '不想肝、冲不上、打不过？交给能打的人就行。',
    color: '#5EEAD4',
    layout: 'list',
    metrics: [
      { label: '在售服务', value: '312' },
      { label: '活跃服务者', value: '128' },
      { label: '平均响应', value: '< 8 分钟' },
      { label: '账号安全', value: '100% 承保' },
    ],
    filters: ['全部', '日常代肝', '段位冲分', '副本通关', '陪练教学'],
    listings: [],
  },
}

export const allListings = Object.values(categoryDetails)
