import { nowIso } from './ids.js'

const createdAt = '2026-04-16T00:00:00.000Z'

export const seedUsers = [
  {
    id: 'usr_system',
    email: 'system@whitehive.cn',
    displayName: 'WhiteHive 系统',
    role: 'admin',
    verificationStatus: 'verified',
    createdAt,
  },
  {
    id: 'usr_demo_buyer',
    email: 'buyer@whitehive.cn',
    displayName: '演示买家',
    role: 'buyer',
    verificationStatus: 'unverified',
    createdAt,
  },
  {
    id: 'usr_demo_seller',
    email: 'seller@whitehive.cn',
    displayName: '蜂巢创作者',
    role: 'seller',
    verificationStatus: 'pending',
    createdAt,
  },
]

export const seedServices = [
  {
    id: 'svc_web_landing',
    sellerId: 'usr_demo_seller',
    category: 'web',
    title: '创业项目官网与预约落地页',
    summary: '从品牌首屏到上线部署，交付一套可访问、可修改的官网页面。',
    priceCents: 280000,
    currency: 'CNY',
    deliveryDays: 7,
    status: 'published',
    tags: ['官网', 'Vercel', '响应式'],
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'svc_ai_workflow',
    sellerId: 'usr_demo_seller',
    category: 'ai',
    title: 'AI 内容生产轻自动化流程',
    summary: '把选题、资料整理、初稿和发布清单串成一个可复用工作流。',
    priceCents: 180000,
    currency: 'CNY',
    deliveryDays: 5,
    status: 'published',
    tags: ['AI', '自动化', 'Prompt'],
    createdAt,
    updatedAt: createdAt,
  },
]

export const seedOrders = [
  {
    id: 'ord_demo_001',
    serviceId: 'svc_web_landing',
    buyerId: 'usr_demo_buyer',
    sellerId: 'usr_demo_seller',
    title: '为 WhiteHive 做一版比赛展示落地页',
    brief: '需要一版能用于路演和用户访谈的官网，重点讲清交易闭环与可信机制。',
    budgetCents: 300000,
    currency: 'CNY',
    status: 'submitted',
    paymentStatus: 'mock_pending',
    verificationRequired: false,
    createdAt,
    updatedAt: createdAt,
  },
]

export const seedPayments = []

export const seedVerificationRequests = [
  {
    id: 'ver_demo_seller',
    userId: 'usr_demo_seller',
    realName: '蜂巢创作者',
    role: 'seller',
    idNumberLast4: '2026',
    contactEmail: 'seller@whitehive.cn',
    status: 'pending',
    reviewerNote: '',
    createdAt,
    updatedAt: createdAt,
  },
]

export const seedMessages = [
  {
    id: 'msg_demo_001',
    orderId: 'ord_demo_001',
    senderId: 'usr_demo_buyer',
    body: '我希望首页更像可信交易平台，不只是作品集展示。',
    createdAt,
  },
  {
    id: 'msg_demo_002',
    orderId: 'ord_demo_001',
    senderId: 'usr_demo_seller',
    body: '收到，我会先整理首屏定位、服务流程和可信机制三块内容。',
    createdAt: nowIso(),
  },
]
