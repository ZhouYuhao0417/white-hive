import { createId, nowIso } from './ids.js'
import {
  seedMessages,
  seedOrders,
  seedPayments,
  seedServices,
  seedUsers,
  seedVerificationRequests,
} from './seed.js'
import { HttpError } from './http.js'

// Fallback adapter for local demos and deployments without DATABASE_URL.

const orderStatuses = ['submitted', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled']
const serviceStatuses = ['draft', 'published', 'paused', 'archived']
const paymentStatuses = ['mock_pending', 'mock_paid', 'mock_released', 'mock_refunded', 'mock_failed']
const verificationStatuses = ['unverified', 'pending', 'verified', 'rejected']
const verificationRequestStatuses = ['pending', 'approved', 'rejected']

const orderStatusLabels = {
  submitted: '待卖家接单',
  accepted: '卖家已接单',
  in_progress: '制作中',
  delivered: '等待买家验收',
  completed: '订单已完成',
  cancelled: '订单已取消',
}

const orderStatusTransitions = {
  submitted: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['delivered', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createMemoryState() {
  return {
    users: clone(seedUsers),
    services: clone(seedServices),
    orders: clone(seedOrders),
    payments: clone(seedPayments),
    verificationRequests: clone(seedVerificationRequests),
    messages: clone(seedMessages),
  }
}

function getState() {
  if (!globalThis.__whitehiveMvpStore) {
    globalThis.__whitehiveMvpStore = createMemoryState()
  }
  return globalThis.__whitehiveMvpStore
}

export function storeInfo() {
  return {
    driver: process.env.DATABASE_URL ? 'database-pending' : 'memory',
    persistent: false,
    note: process.env.DATABASE_URL
      ? 'DATABASE_URL 已存在，但当前 MVP 仍使用内存适配器；下一步接 Postgres。'
      : '未配置 DATABASE_URL，当前使用内存种子数据，适合演示和接口联调。',
    capabilities: ['orders', 'messages', 'mock_payments', 'verification_requests'],
  }
}

export function getDemoUser() {
  const user = getState().users.find((item) => item.id === 'usr_demo_buyer')
  return clone(publicUser(user))
}

export function upsertDemoSession({ email, mode }) {
  const state = getState()
  const normalizedEmail = String(email || '').trim().toLowerCase()

  if (!normalizedEmail.includes('@')) {
    throw new HttpError(400, 'invalid_email', '请输入有效邮箱。')
  }

  let user = state.users.find((item) => item.email === normalizedEmail)

  if (!user) {
    user = {
      id: createId('usr'),
      email: normalizedEmail,
      displayName: normalizedEmail.split('@')[0],
      role: mode === 'seller' ? 'seller' : 'buyer',
      verificationStatus: 'unverified',
      createdAt: nowIso(),
    }
    state.users.push(user)
  }

  return clone({
    user: publicUser(user),
    session: {
      token: `demo_${user.id}`,
      expiresAt: null,
      mode: 'demo',
    },
  })
}

export function listServices({ category, status = 'published' } = {}) {
  const services = getState().services
    .filter((service) => (category ? service.category === category : true))
    .filter((service) => (status ? service.status === status : true))
    .map((service) => withSeller(service))

  return clone(services)
}

export function getService(id) {
  const service = getState().services.find((item) => item.id === id)
  if (!service) {
    throw new HttpError(404, 'service_not_found', '没有找到这个服务。')
  }
  return clone(withSeller(service))
}

export function createService(input) {
  const state = getState()

  if (!input.title || !input.category || !input.summary) {
    throw new HttpError(400, 'missing_fields', '服务标题、分类和简介不能为空。')
  }

  const priceCents = Number(input.priceCents || 0)
  const deliveryDays = Number(input.deliveryDays || 7)

  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw new HttpError(400, 'invalid_price', '服务价格必须大于 0。')
  }

  if (!Number.isFinite(deliveryDays) || deliveryDays <= 0) {
    throw new HttpError(400, 'invalid_delivery_days', '交付周期必须大于 0。')
  }

  const sellerId = input.sellerId || 'usr_demo_seller'
  ensureUser(sellerId)

  const service = {
    id: createId('svc'),
    sellerId,
    category: String(input.category).trim(),
    title: String(input.title).trim(),
    summary: String(input.summary).trim(),
    priceCents,
    currency: input.currency || 'CNY',
    deliveryDays,
    status: serviceStatuses.includes(input.status) ? input.status : 'draft',
    tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 8) : [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  state.services.unshift(service)
  return clone(withSeller(service))
}

export function listOrders({ userId, status } = {}) {
  const orders = getState().orders
    .filter((order) => (userId ? order.buyerId === userId || order.sellerId === userId : true))
    .filter((order) => (status ? order.status === status : true))
    .map((order) => withOrderRelations(order))

  return clone(orders)
}

export function getOrder(id) {
  const order = findOrder(id)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }
  return clone(withOrderRelations(order))
}

export function createOrder(input) {
  const state = getState()
  const service =
    state.services.find((item) => item.id === input.serviceId) ||
    state.services.find((item) => item.category === input.category && item.status === 'published') ||
    state.services.find((item) => item.status === 'published')

  if (!service) {
    throw new HttpError(400, 'invalid_service', '暂时没有可下单服务。')
  }

  if (!input.brief) {
    throw new HttpError(400, 'missing_brief', '请填写需求简介。')
  }

  const buyerId = input.buyerId || 'usr_demo_buyer'
  ensureUser(buyerId)
  ensureUser(service.sellerId)

  const budgetCents = Number(input.budgetCents || service.priceCents)
  if (!Number.isFinite(budgetCents) || budgetCents <= 0) {
    throw new HttpError(400, 'invalid_budget', '订单预算必须大于 0。')
  }

  const order = {
    id: createId('ord'),
    serviceId: service.id,
    buyerId,
    sellerId: service.sellerId,
    title: input.title || service.title,
    brief: String(input.brief).trim(),
    budgetCents,
    currency: input.currency || service.currency || 'CNY',
    status: 'submitted',
    paymentStatus: 'mock_pending',
    verificationRequired: Boolean(input.verificationRequired),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  state.orders.unshift(order)
  state.messages.push({
    id: createId('msg'),
    orderId: order.id,
    senderId: order.buyerId,
    body: `买家提交了需求：${order.brief}`,
    createdAt: nowIso(),
  })

  return clone(withOrderRelations(order))
}

export function updateOrder(id, input) {
  const order = findOrder(id)

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  if (input.status !== undefined) {
    if (!orderStatuses.includes(input.status)) {
      throw new HttpError(400, 'invalid_status', '订单状态不合法。', { allowed: orderStatuses })
    }

    if (input.status !== order.status) {
      const allowedNextStatuses = orderStatusTransitions[order.status] || []
      if (!allowedNextStatuses.includes(input.status)) {
        throw new HttpError(409, 'invalid_status_transition', '订单不能跳过当前流程节点。', {
          current: order.status,
          allowed: allowedNextStatuses,
        })
      }

      order.status = input.status
      appendSystemMessage(order.id, `订单状态更新为：${orderStatusLabels[order.status] || order.status}`)

      if (order.status === 'completed') {
        releaseEscrowForOrder(order)
      }

      if (order.status === 'cancelled') {
        refundEscrowForOrder(order)
      }
    }
  }

  if (input.paymentStatus !== undefined) {
    if (!paymentStatuses.includes(input.paymentStatus)) {
      throw new HttpError(400, 'invalid_payment_status', '付款状态不合法。', { allowed: paymentStatuses })
    }
    order.paymentStatus = input.paymentStatus
  }

  order.updatedAt = nowIso()
  return clone(withOrderRelations(order))
}

export function listPayments({ orderId, status } = {}) {
  const payments = getState().payments
    .filter((payment) => (orderId ? payment.orderId === orderId : true))
    .filter((payment) => (status ? payment.status === status : true))
    .map((payment) => withPaymentRelations(payment))

  return clone(payments)
}

export function getPayment(id) {
  const payment = getState().payments.find((item) => item.id === id)
  if (!payment) {
    throw new HttpError(404, 'payment_not_found', '没有找到这笔付款。')
  }
  return clone(withPaymentRelations(payment))
}

export function createPayment(input) {
  const state = getState()
  const order = findOrder(input.orderId)

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到要付款的订单。')
  }

  if (order.status === 'cancelled') {
    throw new HttpError(409, 'order_cancelled', '订单已取消，不能继续付款。')
  }

  const existing = latestPaymentForOrder(order.id)
  if (existing && ['held', 'released'].includes(existing.escrowStatus)) {
    return clone(withPaymentRelations(existing))
  }

  const amountCents = Number(input.amountCents || order.budgetCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new HttpError(400, 'invalid_amount', '付款金额必须大于 0。')
  }

  const createdAt = nowIso()
  const payment = {
    id: createId('pay'),
    orderId: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    amountCents,
    currency: input.currency || order.currency || 'CNY',
    provider: 'mock',
    method: input.method || 'alipay_mock',
    status: 'succeeded',
    escrowStatus: 'held',
    createdAt,
    updatedAt: createdAt,
    confirmedAt: createdAt,
    releasedAt: null,
    refundedAt: null,
  }

  state.payments.unshift(payment)
  order.paymentStatus = 'mock_paid'
  order.updatedAt = createdAt
  appendSystemMessage(order.id, '买家已完成模拟付款，资金进入 WhiteHive 托管。')

  return clone(withPaymentRelations(payment))
}

export function listMessages(orderId) {
  if (!orderId) {
    throw new HttpError(400, 'missing_order_id', '缺少订单 ID。')
  }

  if (!findOrder(orderId)) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  const messages = getState().messages
    .filter((message) => message.orderId === orderId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((message) => withMessageRelations(message))

  return clone(messages)
}

export function createMessage(input) {
  const state = getState()
  const order = findOrder(input.orderId)
  const text = String(input.body || '').trim()

  if (!input.orderId || !text) {
    throw new HttpError(400, 'missing_fields', '订单 ID 和消息内容不能为空。')
  }

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  if (text.length > 1000) {
    throw new HttpError(400, 'message_too_long', '单条留言最多 1000 个字符。')
  }

  const senderId = input.senderId || order.buyerId
  ensureUser(senderId)

  const message = {
    id: createId('msg'),
    orderId: order.id,
    senderId,
    body: text,
    createdAt: nowIso(),
  }

  state.messages.push(message)
  return clone(withMessageRelations(message))
}

export function getVerificationProfile(userId = 'usr_demo_seller') {
  const user = ensureUser(userId)
  const requests = getState().verificationRequests
    .filter((request) => request.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return clone({
    user: publicUser(user),
    latestRequest: requests[0] ? sanitizeVerificationRequest(requests[0]) : null,
    history: requests.map(sanitizeVerificationRequest).slice(0, 10),
  })
}

export function submitVerification(input) {
  const state = getState()
  const user = ensureUser(input.userId || 'usr_demo_seller')
  const realName = String(input.realName || '').trim()
  const contactEmail = String(input.contactEmail || user.email || '').trim().toLowerCase()
  const idNumberLast4 = String(input.idNumberLast4 || '').replace(/[^\dXx]/g, '').slice(-4)

  if (realName.length < 2) {
    throw new HttpError(400, 'invalid_real_name', '请填写真实姓名或主体名称。')
  }

  if (idNumberLast4 && idNumberLast4.length !== 4) {
    throw new HttpError(400, 'invalid_id_number', '证件号码只需要提交后 4 位用于演示校验。')
  }

  if (!contactEmail.includes('@')) {
    throw new HttpError(400, 'invalid_contact_email', '请填写有效联系邮箱。')
  }

  const createdAt = nowIso()
  const request = {
    id: createId('ver'),
    userId: user.id,
    realName,
    role: input.role || user.role,
    idNumberLast4,
    contactEmail,
    status: 'pending',
    reviewerNote: '',
    createdAt,
    updatedAt: createdAt,
  }

  state.verificationRequests.unshift(request)
  user.verificationStatus = 'pending'

  return clone({
    user: publicUser(user),
    request: sanitizeVerificationRequest(request),
  })
}

export function reviewVerification(id, input) {
  const state = getState()
  const request = state.verificationRequests.find((item) => item.id === id)

  if (!request) {
    throw new HttpError(404, 'verification_not_found', '没有找到这条实名认证申请。')
  }

  if (!verificationRequestStatuses.includes(input.status)) {
    throw new HttpError(400, 'invalid_verification_status', '实名认证审核状态不合法。', {
      allowed: verificationRequestStatuses,
    })
  }

  request.status = input.status
  request.reviewerNote = String(input.reviewerNote || '').trim()
  request.updatedAt = nowIso()

  const user = state.users.find((item) => item.id === request.userId)
  if (user) {
    user.verificationStatus =
      request.status === 'approved' ? 'verified' : request.status === 'rejected' ? 'rejected' : 'pending'
  }

  return clone({
    user: user ? publicUser(user) : null,
    request: sanitizeVerificationRequest(request),
  })
}

function findOrder(id) {
  return getState().orders.find((item) => item.id === id)
}

function ensureUser(id) {
  const user = getState().users.find((item) => item.id === id)
  if (!user) {
    throw new HttpError(404, 'user_not_found', '没有找到这个用户。')
  }
  return user
}

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    verificationStatus: verificationStatuses.includes(user.verificationStatus)
      ? user.verificationStatus
      : 'unverified',
    createdAt: user.createdAt,
  }
}

function appendSystemMessage(orderId, body) {
  getState().messages.push({
    id: createId('msg'),
    orderId,
    senderId: 'usr_system',
    body,
    createdAt: nowIso(),
  })
}

function latestPaymentForOrder(orderId) {
  return getState().payments
    .filter((payment) => payment.orderId === orderId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
}

function releaseEscrowForOrder(order) {
  const payment = latestPaymentForOrder(order.id)
  if (!payment || payment.escrowStatus !== 'held') return

  const releasedAt = nowIso()
  payment.escrowStatus = 'released'
  payment.updatedAt = releasedAt
  payment.releasedAt = releasedAt
  order.paymentStatus = 'mock_released'
  appendSystemMessage(order.id, '买家已确认验收，模拟托管款已释放给卖家。')
}

function refundEscrowForOrder(order) {
  const payment = latestPaymentForOrder(order.id)
  if (!payment || payment.escrowStatus !== 'held') return

  const refundedAt = nowIso()
  payment.escrowStatus = 'refunded'
  payment.updatedAt = refundedAt
  payment.refundedAt = refundedAt
  order.paymentStatus = 'mock_refunded'
  appendSystemMessage(order.id, '订单已取消，模拟托管款已退回买家。')
}

function withSeller(service) {
  const seller = getState().users.find((user) => user.id === service.sellerId)
  return {
    ...service,
    seller: seller
      ? {
          id: seller.id,
          displayName: seller.displayName,
          role: seller.role,
          verificationStatus: seller.verificationStatus,
        }
      : null,
  }
}

function withOrderRelations(order) {
  const state = getState()
  const service = state.services.find((item) => item.id === order.serviceId)
  const buyer = state.users.find((item) => item.id === order.buyerId)
  const seller = state.users.find((item) => item.id === order.sellerId)
  const messages = state.messages.filter((item) => item.orderId === order.id)
  const payment = latestPaymentForOrder(order.id)

  return {
    ...order,
    service: service ? { id: service.id, title: service.title, category: service.category } : null,
    buyer: buyer ? publicUser(buyer) : null,
    seller: seller ? publicUser(seller) : null,
    payment: payment ? summarizePayment(payment) : null,
    messageCount: messages.length,
  }
}

function withPaymentRelations(payment) {
  const order = findOrder(payment.orderId)
  return {
    ...payment,
    order: order
      ? {
          id: order.id,
          title: order.title,
          status: order.status,
          paymentStatus: order.paymentStatus,
        }
      : null,
  }
}

function summarizePayment(payment) {
  return {
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    provider: payment.provider,
    method: payment.method,
    status: payment.status,
    escrowStatus: payment.escrowStatus,
    createdAt: payment.createdAt,
    confirmedAt: payment.confirmedAt,
    releasedAt: payment.releasedAt,
    refundedAt: payment.refundedAt,
  }
}

function withMessageRelations(message) {
  const sender = getState().users.find((user) => user.id === message.senderId)
  return {
    ...message,
    sender: sender
      ? {
          id: sender.id,
          displayName: sender.displayName,
          role: sender.role,
        }
      : null,
  }
}

function sanitizeVerificationRequest(request) {
  return {
    id: request.id,
    userId: request.userId,
    realName: request.realName,
    role: request.role,
    idNumberLast4: request.idNumberLast4,
    contactEmail: request.contactEmail,
    status: request.status,
    reviewerNote: request.reviewerNote,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}
