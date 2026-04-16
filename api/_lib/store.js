import { createId, nowIso } from './ids.js'
import { seedMessages, seedOrders, seedServices, seedUsers } from './seed.js'
import { HttpError } from './http.js'

const orderStatuses = ['submitted', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled']
const serviceStatuses = ['draft', 'published', 'paused', 'archived']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createMemoryState() {
  return {
    users: clone(seedUsers),
    services: clone(seedServices),
    orders: clone(seedOrders),
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
  }
}

export function getDemoUser() {
  return clone(getState().users[0])
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
    user,
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

  const service = {
    id: createId('svc'),
    sellerId: input.sellerId || 'usr_demo_seller',
    category: input.category,
    title: String(input.title).trim(),
    summary: String(input.summary).trim(),
    priceCents,
    currency: input.currency || 'CNY',
    deliveryDays,
    status: serviceStatuses.includes(input.status) ? input.status : 'draft',
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 8) : [],
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
  const order = getState().orders.find((item) => item.id === id)
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

  const order = {
    id: createId('ord'),
    serviceId: service.id,
    buyerId: input.buyerId || 'usr_demo_buyer',
    sellerId: service.sellerId,
    title: input.title || service.title,
    brief: String(input.brief).trim(),
    budgetCents: Number(input.budgetCents || service.priceCents),
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
  const state = getState()
  const order = state.orders.find((item) => item.id === id)

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  if (input.status !== undefined) {
    if (!orderStatuses.includes(input.status)) {
      throw new HttpError(400, 'invalid_status', '订单状态不合法。', { allowed: orderStatuses })
    }
    order.status = input.status
  }

  if (input.paymentStatus !== undefined) {
    order.paymentStatus = input.paymentStatus
  }

  order.updatedAt = nowIso()
  return clone(withOrderRelations(order))
}

export function listMessages(orderId) {
  if (!orderId) {
    throw new HttpError(400, 'missing_order_id', '缺少订单 ID。')
  }
  return clone(getState().messages.filter((message) => message.orderId === orderId))
}

export function createMessage(input) {
  if (!input.orderId || !input.body) {
    throw new HttpError(400, 'missing_fields', '订单 ID 和消息内容不能为空。')
  }

  const message = {
    id: createId('msg'),
    orderId: input.orderId,
    senderId: input.senderId || 'usr_demo_buyer',
    body: String(input.body).trim(),
    createdAt: nowIso(),
  }

  getState().messages.push(message)
  return clone(message)
}

function withSeller(service) {
  const seller = getState().users.find((user) => user.id === service.sellerId)
  return {
    ...service,
    seller: seller
      ? {
          id: seller.id,
          displayName: seller.displayName,
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

  return {
    ...order,
    service: service ? { id: service.id, title: service.title, category: service.category } : null,
    buyer: buyer ? { id: buyer.id, displayName: buyer.displayName } : null,
    seller: seller ? { id: seller.id, displayName: seller.displayName } : null,
    messageCount: messages.length,
  }
}
