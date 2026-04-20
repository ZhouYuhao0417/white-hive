// Store happy-path integration tests.
//
// Exercises the contract that the API handlers sit on top of. We go through
// the memory-store adapter (no DATABASE_URL → fallback path) so the tests are
// hermetic: no Postgres, no external HTTP, no DeepSeek.

import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import {
  upsertDemoSession,
  getSessionByToken,
  requestPhoneLogin,
  confirmPhoneLogin,
  requestPhoneVerification,
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
  listVerificationRequests,
  reviewService,
  reviewVerification,
  submitVerification,
} from '../api/_lib/store.js'
import { hashToken } from '../api/_lib/auth.js'
import { HttpError } from '../api/_lib/http.js'
import { resetMemoryStore, clearProductionEnv, uniqueEmail } from './helpers.js'

const savedKey = process.env.DEEPSEEK_API_KEY
const savedNodeEnv = process.env.NODE_ENV
const savedVercelEnv = process.env.VERCEL_ENV

describe('store · auth → service → order → message → payment flow', () => {
  beforeEach(() => {
    resetMemoryStore()
    clearProductionEnv()
    delete process.env.DEEPSEEK_API_KEY
  })

  afterEach(() => {
    if (savedKey !== undefined) process.env.DEEPSEEK_API_KEY = savedKey
    if (savedNodeEnv !== undefined) process.env.NODE_ENV = savedNodeEnv
    else delete process.env.NODE_ENV
    if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv
    else delete process.env.VERCEL_ENV
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

  test('verified phone cannot be requested by a different account', async () => {
    const phone = '13812345678'
    const owner = await upsertDemoSession({
      action: 'signup',
      email: uniqueEmail('phone-owner'),
      password: 'testpass123',
      displayName: '手机号主人',
      role: 'buyer',
      phone,
    })
    const other = await upsertDemoSession({
      action: 'signup',
      email: uniqueEmail('phone-other'),
      password: 'testpass123',
      displayName: '另一个用户',
      role: 'buyer',
    })

    const state = globalThis.__whitehiveMvpStore
    const ownerRecord = state.users.find((user) => user.id === owner.user.id)
    ownerRecord.phone = phone
    ownerRecord.phoneVerifiedAt = new Date().toISOString()

    const repeat = await requestPhoneVerification(owner.session.token, { phone })
    expect(repeat.phoneVerification.status).toBe('verified')

    await expect(
      requestPhoneVerification(other.session.token, { phone }),
    ).rejects.toThrow(HttpError)
  })

  test('phone verification is non-blocking when sms transport is not configured', async () => {
    const phone = '13912345678'
    const session = await upsertDemoSession({
      action: 'signup',
      email: uniqueEmail('phone-unavailable'),
      password: 'testpass123',
      displayName: '短信待开通用户',
      role: 'buyer',
      phone,
    })

    const result = await requestPhoneVerification(session.session.token, { phone })

    expect(result.phoneVerification.status).toBe('unavailable')
    expect(result.phoneVerification.delivery.provider).toBe('not_configured')
    expect(globalThis.__whitehiveMvpStore.phoneVerificationTokens).toHaveLength(0)
  })

  test('phone login creates a verified phone account after SMS code confirmation', async () => {
    process.env.WHITEHIVE_SMS_MOCK = '1'
    const phone = '13712345678'

    const requested = await requestPhoneLogin({ phone, role: 'seller' })

    expect(requested.phoneLogin.status).toBe('pending')
    expect(requested.phoneLogin.delivery.provider).toBe('mock')
    const state = globalThis.__whitehiveMvpStore
    expect(state.phoneLoginTokens).toHaveLength(1)
    state.phoneLoginTokens[0].codeHash = hashToken('123456')

    const session = await confirmPhoneLogin({ phone, code: '123456', role: 'seller' })

    expect(session.user.phone).toBe(phone)
    expect(session.user.phoneVerified).toBe(true)
    expect(session.user.email).toBe('')
    expect(session.user.emailVerified).toBe(false)
    expect(session.user.authProvider).toBe('phone')
    expect(session.user.role).toBe('seller')
    expect(session.session.token).toBeTruthy()

    const restored = await getSessionByToken(session.session.token)
    expect(restored.user.id).toBe(session.user.id)
  })

  test('admin review queue lists campus verification requests and updates status', async () => {
    const session = await upsertDemoSession({
      action: 'signup',
      email: uniqueEmail('cdut-verify'),
      password: 'testpass123',
      displayName: 'CDUT 用户',
      role: 'seller',
    })

    const submitted = await submitVerification({
      userId: session.user.id,
      realName: '成都理工同学',
      role: '成都理工在校生',
      verificationType: 'campus',
      studentId: '20260419001',
      schoolOrCompany: '成都理工大学',
      city: '成都',
    })

    const pending = await listVerificationRequests({ status: 'pending' })
    const found = pending.find((item) => item.id === submitted.request.id)
    expect(found).toBeTruthy()
    expect(found.verificationType).toBe('campus')
    expect(found.studentId).toBe('20260419001')
    expect(found.user.email).toBe(session.user.email)

    const reviewed = await reviewVerification(submitted.request.id, {
      status: 'approved',
      reviewerNote: 'CDUT 校园认证人工审核通过。',
    })

    expect(reviewed.request.status).toBe('approved')
    expect(reviewed.user.verificationStatus).toBe('verified')
  })

  test('campus verification is seller-only and gates CDUT service publishing', async () => {
    const buyer = await upsertDemoSession({
      action: 'signup',
      email: uniqueEmail('cdut-buyer'),
      password: 'testpass123',
      displayName: 'CDUT 买家',
      role: 'buyer',
    })

    await expect(
      submitVerification({
        userId: buyer.user.id,
        realName: '买家同学',
        verificationType: 'campus',
        studentId: '20260419002',
      }),
    ).rejects.toThrow(HttpError)

    const seller = await upsertDemoSession({
      action: 'signup',
      email: uniqueEmail('cdut-seller'),
      password: 'testpass123',
      displayName: 'CDUT 卖家',
      role: 'seller',
    })

    await expect(
      createService({
        sellerId: seller.user.id,
        title: 'CDUT 校园代取快递',
        category: 'cdut/parcel',
        summary: '帮成都理工同学代取校园快递。',
        priceCents: 500,
        deliveryDays: 1,
        status: 'published',
      }),
    ).rejects.toThrow(HttpError)

    const submitted = await submitVerification({
      userId: seller.user.id,
      realName: '卖家同学',
      verificationType: 'campus',
      studentId: '20260419003',
    })
    await reviewVerification(submitted.request.id, { status: 'approved' })

    const service = await createService({
      sellerId: seller.user.id,
      title: 'CDUT 校园代取快递',
      category: 'cdut/parcel',
      summary: '帮成都理工同学代取校园快递。',
      priceCents: 500,
      deliveryDays: 1,
      status: 'published',
    })
    expect(service.category).toBe('cdut/parcel')
    expect(service.status).toBe('pending_review')
    const approvedService = await reviewService(service.id, { status: 'published', reviewNote: '校园服务审核通过。' })
    expect(approvedService.status).toBe('published')

    const order = await createOrder({
      serviceId: approvedService.id,
      buyerId: buyer.user.id,
      brief: '我在成都理工，想请同学代取一个快递。',
      budgetCents: 500,
    })
    expect(order.buyerId).toBe(buyer.user.id)
    expect(order.sellerId).toBe(seller.user.id)
    expect(order.paymentStatus).toBe('direct_settlement')
    await expect(
      createPayment({
        orderId: order.id,
        amountCents: 500,
        method: 'alipay_mock',
      }),
    ).rejects.toThrow(HttpError)
  })

  test('seller submitted service requires review before it is public', async () => {
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
    expect(service.status).toBe('pending_review')

    const publicBeforeReview = await listServices({ status: 'published' })
    expect(publicBeforeReview.find((s) => s.id === service.id)).toBeFalsy()

    const pending = await listServices({ status: 'pending_review' })
    expect(pending.find((s) => s.id === service.id)).toBeTruthy()

    const approved = await reviewService(service.id, { status: 'published', reviewNote: '服务信息清晰。' })
    expect(approved.status).toBe('published')

    const publicAfterReview = await listServices({ status: 'published' })
    const found = publicAfterReview.find((s) => s.id === service.id)
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
    expect(order.paymentStatus).toBe('payment_pending')
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

  test('production payment refuses mock escrow when no real gateway is connected', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.WHITEHIVE_PAYMENT_MOCK

    const order = await createOrder({
      serviceId: 'svc_web_landing',
      brief: '测试生产环境真实付款闸门',
      budgetCents: 280000,
      buyerId: 'usr_demo_buyer',
    })

    await expect(
      createPayment({
        orderId: order.id,
        amountCents: 280000,
        method: 'alipay_mock',
      }),
    ).rejects.toThrow(HttpError)
  })
})
