// WhiteHive Local · 本地服务 mock data
// 仅用于前端原型展示，不走后端接口

export const localCategories = [
  {
    key: 'tutor',
    icon: 'document',
    label: '家教辅导',
    desc: '一对一线下家教 · 大学生辅导中小学 · 艺考陪考',
    priceRange: '¥80–¥240/小时',
    distance: '一般 3km 内',
    needsIdentity: true,
    allowOnlineFirst: true,
    accent: '#BEE6FF',
  },
  {
    key: 'campus-skill',
    icon: 'gamepad',
    label: '校园技能互助',
    desc: 'PS/Word 教学 · 乐器陪练 · 健身带练 · 语言角',
    priceRange: '¥50–¥180/次',
    distance: '同校园 / 同城',
    needsIdentity: false,
    allowOnlineFirst: true,
    accent: '#A5B4FC',
  },
  {
    key: 'photo',
    icon: 'palette',
    label: '摄影陪拍',
    desc: '街拍 · 校园毕业照 · 约拍 · 证件照上门',
    priceRange: '¥180–¥680/场',
    distance: '同城上门',
    needsIdentity: true,
    allowOnlineFirst: true,
    accent: '#7FD3FF',
  },
  {
    key: 'device',
    icon: 'wand',
    label: '设备调试',
    desc: '电脑装机 · 路由器调试 · 打印机上门 · 智能家居',
    priceRange: '¥80–¥300/次',
    distance: '3–10km 内上门',
    needsIdentity: true,
    allowOnlineFirst: true,
    accent: '#5EEAD4',
  },
  {
    key: 'errand',
    icon: 'route',
    label: '同城跑腿',
    desc: '代取件 · 校园代跑 · 宠物喂养 · 排队代办',
    priceRange: '¥15–¥80/单',
    distance: '1–8km',
    needsIdentity: true,
    allowOnlineFirst: false,
    accent: '#FBBF77',
  },
  {
    key: 'training',
    icon: 'spark',
    label: '线下陪练 / 训练',
    desc: '英语口语陪练 · 面试模拟 · 运动陪练 · 舞蹈搭子',
    priceRange: '¥60–¥220/次',
    distance: '同城见面',
    needsIdentity: false,
    allowOnlineFirst: true,
    accent: '#F8A5D1',
  },
]

export const trustTips = [
  {
    icon: 'shield',
    title: '首次见面请选公共场所',
    desc: '首次线下面谈建议约在咖啡馆、校园自习室、图书馆等人流较多的公共空间，避免去对方私人住所。',
  },
  {
    icon: 'user',
    title: '未成年人服务需监护人知情',
    desc: '涉及未成年人的家教、陪练、陪拍等服务，需监护人授权，并通过平台留痕沟通，不支持私下现金交易。',
  },
  {
    icon: 'vault',
    title: '平台只显示模糊位置',
    desc: 'WhiteHive Local 只展示到区 / 校园粒度，不暴露精确地址。具体见面地点由双方在订单内约定。',
  },
  {
    icon: 'chain',
    title: '交易前先在平台留痕沟通',
    desc: '所有沟通、需求确认、改单建议在 WhiteHive 内完成，便于出现争议时可回溯。',
  },
  {
    icon: 'key',
    title: '后续接入实名认证与订单托管',
    desc: '正式订单将通过平台托管支付、确认履约后释放，未验证服务者只能出现在浏览区，不能接单。',
  },
]

export const routeCards = [
  {
    key: 'route-trust',
    tag: 'ROUTE A',
    title: '近距离沟通，信任更低门槛',
    accent: '#BEE6FF',
    desc: '服务者和客户身处同城甚至同校园，可以在下单前线下面谈一次，确认需求、样片、风格，远比线上对话更可靠。适合客单价偏高、需要面聊的服务。',
    scenes: [
      '大学生家教，家长想先见一面了解',
      '毕业跟拍，要面对面确认风格 / 服装',
      '婚庆、活动摄影、线下演出协助',
      '1v1 教练 / 陪练，要确认气场合拍',
    ],
    trust: [
      '平台展示实名 / 学生认证 badge',
      '沟通留痕 + 见面地点记录',
      '双向评价，低信任度自动下线',
    ],
  },
  {
    key: 'route-must',
    tag: 'ROUTE B',
    title: '线下是必需品，只能本地履约',
    accent: '#5EEAD4',
    desc: '有些服务天然必须线下发生，线上无法替代：家教、陪读、设备上门、同城代办。我们为这类服务提供更严格的身份核验与订单托管。',
    scenes: [
      '中小学家教、艺考陪考、作业辅导',
      '电脑 / 打印机 / 路由器上门调试',
      '宠物上门喂养 · 植物照料',
      '同城跑腿 · 代排队 · 代取件',
    ],
    trust: [
      '强制实名 + 人脸核验',
      '未成年人场景需监护人确认',
      '订单托管：服务完成后再结算',
    ],
  },
]
