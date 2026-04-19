// CDUT · 成都理工大学服务专区 mock data
// 独立于 /local 本地服务，仅面向成都理工大学在校同学提供的线下微服务。
// 所有数据只用于前端展示原型；真实接入时会走 /api/services?campus=cdut 这类端点。

export const cdutCampus = {
  slug: 'cdut',
  name: '成都理工大学',
  nameEn: 'CDUT',
  tagline: '本校同学, 线下见面, 平台托管。',
  desc: '专门给成都理工大学在校同学做的小额线下服务撮合。跑腿、代拍、代取都走 WhiteHive 托管, 见面核销即结款, 不加微信、不走私聊。',
  // 可选的校区 tag，让同学知道服务者离自己近不近
  zones: ['东区 · 宿舍', '北区 · 图书馆', '西区 · 体育场', '砚湖 / 食堂', '校外 3km 内'],
  metrics: [
    { label: '在校服务者', value: '86+' },
    { label: '本月接单', value: '412' },
    { label: '平均响应', value: '< 12 分钟' },
    { label: '完成率', value: '98.7%' },
  ],
}

export const cdutCategories = [
  {
    key: 'parcel',
    icon: 'route',
    label: '快递代取',
    color: '#7FD3FF',
    priceFrom: 3,
    priceUnit: '单',
    desc: '宿舍 / 图书馆 / 实验楼, 顺手带到你手上。',
    meta: '承诺 30 分钟内取件',
    scenes: ['菜鸟驿站', '快递柜', '校内丰巢', '顺丰 / 京东自营'],
  },
  {
    key: 'food',
    icon: 'spark',
    label: '外卖代取',
    color: '#A5B4FC',
    priceFrom: 4,
    priceUnit: '单',
    desc: '下课不赶趟? 校外取餐 / 食堂打包都行。',
    meta: '午晚高峰也能抢到单',
    scenes: ['食堂打包', '校外外卖柜', '瑞幸 / 星巴克', '茶饮店'],
  },
  {
    key: 'photo',
    icon: 'palette',
    label: '校园约拍',
    color: '#5EEAD4',
    priceFrom: 120,
    priceUnit: '场',
    desc: '证件照 / 社团活动跟拍, 在校摄影爱好者接单。',
    meta: '设备自带, 可指定机位',
    scenes: ['证件照', '活动跟拍', '日常人像'],
  },
  {
    key: 'class',
    icon: 'document',
    label: '代课签到',
    color: '#C7D2FE',
    priceFrom: 30,
    priceUnit: '节',
    desc: '帮你上课 / 签到 / 点名应答, 大课小课都能接。',
    meta: '仅代签与听课, 不代答题考试',
    scenes: ['人脸签到', '纸质点名', '线下大课', '研讨课'],
  },
  {
    key: 'online-course',
    icon: 'play',
    label: '刷课 / 网课代学',
    color: '#FBBF77',
    priceFrom: 15,
    priceUnit: '小时',
    desc: '网课学时、章节任务、章节测验, 一并挂完。',
    meta: '仅代刷学时, 不代考核',
    scenes: ['超星学习通', '中国大学 MOOC', '智慧树', '校内教务网课'],
  },
  {
    key: 'errand',
    icon: 'route',
    label: '代校园跑',
    color: '#F8A5D1',
    priceFrom: 8,
    priceUnit: '单',
    desc: '交材料 / 排队办手续 / 代领东西, 校内跑一趟就行。',
    meta: '同校区内, 一般 20 分钟内到',
    scenes: ['教务大厅', '图书馆借还', '社团注册', '办公楼交表'],
  },
]

export const cdutTrustPoints = [
  {
    icon: 'shield',
    title: '学生身份核验（CDUT 在校生）',
    desc: '所有服务者都通过 .edu 邮箱 + 一卡通验证, 确认是成都理工在校生, 不是随便来的。',
    color: '#7FD3FF',
  },
  {
    icon: 'vault',
    title: '平台托管结款',
    desc: '下单即托管, 见面核销 / 扫码确认收到服务, 钱才到服务者账上; 没见到就秒退。',
    color: '#A5B4FC',
  },
  {
    icon: 'route',
    title: '同校就近接单',
    desc: '按校区 + 楼栋就近派单, 同一栋楼的优先。服务者位置走校内坐标, 不暴露宿舍门牌。',
    color: '#5EEAD4',
  },
]
