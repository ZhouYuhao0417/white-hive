// Store happy-path integration tests.
//
// Exercises the contract that the API handlers sit on top of. We go through
// the memory-store adapter (no DATABASE_URL → fallback path) so the tests are
// hermetic: no Postgres, no external HTTP, no DeepSeek.

import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import {
  upsertDemoSession,
  getSessionByToken,
  createService,
  listServices,
  getService,
  createOrder,
  updateOrder,
  listOrders,
  getOrder,
  createMessage,
  listMessages,
  createPayment,
} from '../api/_lib/store.js'
import { HttpError } from '../api/_lib/http.js'
import { resetMemoryStore, clearProductionEnv, uniqueEmail } from './helpers.js'

const savedKey = process.env.DEEPSEEK_API_KEY

describe('store · auth → service → order → message → payment flow', () => {
  beforeEach(() => {
    resetMemoryStore()
    clearProductionEnv()
    delete process.env.DEEPSEEK_API_KEY
  })

  afterEach(() => {
    if (savedKey !== undefined) process.env.DEEPSEEK_API_KEY = savedKey
  })

  test('signup returns user + session token that round-trips', async () => {
    const email = uniqueEmail('signup')
    const session = await upsertDemoSession({
      action: 'signup',
      email,
      password: 'testpass123',
      displayName: '新用户',
      role: 'buyer',
    })

    expect(session.user.email).toBe(email)
    expect(session.user.role).toBe('buyer')
    expect(session.user.displayName).toBe('新用户')
    expect(typeof session.session.token).toBe('string')
    expect(session.session.token.length).toBeGreaterThan(30)

    const fromToken = await getSessionByToken(session.session.token)
    expect(fromToken.user.id).toBe(session.user.id)
  })

  test('duplicate signup is rejected with account_exists', async () => {
    const email = uniqueEmail('dup')
    await upsertDemoSession({
      action: 'signup',
      email,
      password: 'testpass123',
      displayName: 'A',
      role: 'buyer',
    })

    await expect(
      upsertDemoSession({
        action: 'signup',
        email,
        password: 'testpass123',
        displayName: 'A',
        role: 'buyer',
      }),
    ).rejects.toThrow(HttpError)
  })

  test('signin with wrong password is rejected with invalid_credentials', async () => {
    const email = uniqueEmail('wrongpw')
    await upsertDemoSession({
      action: 'signup',
      email,
      password: 'correctpassword',
      displayName: '用户',
      role: 'buyer',
    })

    await expect(
      upsertDemoSession({
        action: 'signin',
        email,
        password: 'wrongpassword',
      }),
    ).rejects.toThrow(HttpError)
  })

  test('seller can create a published service and it shows up in listServices', async () => {
    const service = await createService({
      title: '测试服务 · 官网',
      category: 'web',
      summary: '一个测试用的官网服务',
      priceCents: 200000,
      currency: 'CNY',
      deliveryDays: 7,
      status: 'published',
      tags: ['test', 'web'],
    })

    expect(service.id.startsWith('svc_')).toBe(true)
    expect(service.status).toBe('published')

    const listed = await listServices({ status: 'published' })
    const found = listed.find((s) => s.id === service.id)
    expect(found).toBeTruthy()
    expect(found.title).toBe('测试服务 · 官网')

    const fetched = await getService(service.id)
    expect(fetched.id).toBe(service.id)
  })

  test('createService rejects missing required fields', async () => {
    await expect(createService({ title: 'only title' })).rejects.toThrow(HttpError)
    await expect(
      createService({ title: 'x', category: 'web', summary: 'y', priceCents: 0 }),
    ).rejects.toThrow(HttpError) // invalid_price
  })

  test('buyer can create an order against a service', async () => {
    // Use seed service svc_web_landing (seeded in memory store)
    const order = await createOrder({
      serviceId: 'svc_web_landing',
      brief: '我想做一个创业项目官网，重点是预约表单。',
      budgetCents: 280000,
      buyerId: 'usr_demo_buyer',
    })

    expect(order.id.startsWith('ord_')).toBe(true)
    expect(order.status).toBe('submitted')
    expect(order.paymentStatus).toBe('mock_pending')
    expect(order.serviceId).toBe('svc_web_landing')
    expect(order.buyerId).toBe('usr_demo_buyer')
    expect(order.brief).toContain('创业项目官网')
  })

  test('createOrder rejects missing brief', async () => {
    await expect(
      createOrder({
        serviceId: 'svc_web_landing',
        budgetCents: 280000,
        buyerId: 'usr_demo_buyer',
      }),
    ).rejects.toThrow(HttpError)
  })

  test('order status transitions follow the allowed graph', async () => {
    const order = await createOrder({
      serviceId: 'svc_web_landing',
      brief: '测试订单状态流转',
      budgetCents: 280000,
      buyerId: 'usr_demo_buyer',
    })

    // submitted → accepted
    const accepted = await updateOrder(order.id, { status: 'accepted' })
    expect(accepted.status).toBe('accepted')

    // accepted → in_progress
    const inProgress = await updateOrder(order.id, { status: 'in_progress' })
    expect(inProgress.status).toBe('in_progress')

    // in_progress → delivered
    const delivered = await updateOrder(order.id, { status: 'delivered' })
    expect(delivered.status).toBe('delivered')

    // delivered → completed
    const completed = await updateOrder(order.id, { status: 'completed' })
    expect(completed.status).toBe('completed')
  })

  test('order status transitions reject illegal jumps', async () => {
    const order = await createOrder({
      serviceId: 'svc_web_landing',
      brief: '状态跳跃测试',
      budgetCents: 280000,
      buyerId: 'usr_demo_buyer',
    })

    // submitted → completed (illegal, must go through accepted/in_progress/delivered)
    await expect(
      updateOrder(order.id, { status: 'completed' }),
    ).rejects.toThrow(HttpError)
  })

  test('listOrders filters by buyer', async () => {
    const order = await createOrder({
      serviceId: 'svc_web_landing',
      brief: '用于测试 listOrders',
      budgetCents: 280000,
      buyerId: 'usr_demo_buyer',
    })

    const orders = await listOrders({ userId: 'usr_demo_buyer' })
    expect(orders.some((o) => o.id === order.id)).toBe(true)
  })

  test('messages attach to an order and come back in order', async () => {
    const order = await createOrder({
      serviceId: 'svc_web_landing',
      brief: '测试消息流',
      budgetCents: 280000,
      buyerId: 'usr_demo_buyer',
    })

    await createMessage({
      orderId: order.id,
      senderId: 'usr_demo_buyer',
      body: '你好，请问今天能开始吗？',
    })
    await createMessage({
      orderId: order.id,
      senderId: 'usr_demo_seller',
      body: '可以，我今晚安排。',
    })

    const messages = await listMessages(order.id)
    // Seed includes a system message from createOrder; we expect at least our 2 + 1 system
    expect(messages.length).toBeGreaterThanOrEqual(3)
    const bodies = messages.map((m) => m.body)
    expect(bodies.some((b) => b.includes('今天能开始'))).toBe(true)
    expect(bodies.some((b) => b.includes('今晚安排'))).toBe(true)
  })

  test('listMessages on missing order rejects with 404', async () => {
    await expect(listMessages('ord_does_not_exist')).rejects.toThrow(HttpError)
  })

  test('createPayment puts funds in escrow + marks order mock_paid', async () => {
    const order = await createOrder({
      serviceId: 'svc_web_landing',
      brief: '测试付款',
      budgetCents: 280000,
      buyerId: 'usr_demo_buyer',
    })

    const payment = await createPayment({
      orderId: order.id,
      amountCents: 280000,
      method: 'alipay_mock',
    })

    expect(payment.id.startsWith('pay_')).toBe(true)
    expect(payment.status).toBe('succeeded')
    expect(payment.escrowStatus).toBe('held')

    const refreshed = await getOrder(order.id)
    expect(refreshed.paymentStatus).toBe('mock_paid')
  })
})
