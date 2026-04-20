import { test, expect, describe, beforeEach } from 'bun:test'
import api from '../api/index.js'
import { resetMemoryStore, clearProductionEnv, uniqueEmail } from './helpers.js'

function jsonResponse(response) {
  return response.json()
}

describe('api · auth route hardening', () => {
  beforeEach(() => {
    resetMemoryStore()
    clearProductionEnv()
    delete process.env.WHITEHIVE_ALLOW_DEMO_SESSION
    delete process.env.WHITEHIVE_ALLOW_PROVIDER_BRIDGE
    delete process.env.WHITEHIVE_ADMIN_EMAILS
  })

  test('GET /api/auth/session without bearer token returns anonymous session', async () => {
    const response = await api.fetch(new Request('https://whitehive.test/api/auth/session'))
    const payload = await jsonResponse(response)

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.user).toBeNull()
    expect(payload.data.session.mode).toBe('anonymous')
    expect(payload.data.session.token).toBeNull()
  })

  test('POST /api/auth/provider is disabled unless explicitly opted into', async () => {
    const response = await api.fetch(
      new Request('https://whitehive.test/api/auth/provider', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'github',
          providerUserId: 'attacker-controlled-id',
        }),
      }),
    )
    const payload = await jsonResponse(response)

    expect(response.status).toBe(410)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('provider_bridge_disabled')
  })

  test('seller service submissions stay private until admin review', async () => {
    const sellerEmail = uniqueEmail('service-seller')
    const signupResponse = await api.fetch(
      new Request('https://whitehive.test/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email: sellerEmail,
          password: 'testpass123',
          displayName: '服务卖家',
          role: 'seller',
        }),
      }),
    )
    const signupPayload = await jsonResponse(signupResponse)
    const sellerToken = signupPayload.data.session.token

    const createResponse = await api.fetch(
      new Request('https://whitehive.test/api/services', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          title: '真实审核服务',
          category: 'web',
          summary: '提交后应先进入服务审核队列。',
          priceCents: 100000,
          deliveryDays: 5,
          status: 'published',
        }),
      }),
    )
    const createPayload = await jsonResponse(createResponse)
    expect(createResponse.status).toBe(200)
    expect(createPayload.data.status).toBe('pending_review')

    const publicResponse = await api.fetch(new Request('https://whitehive.test/api/services?status=published'))
    const publicPayload = await jsonResponse(publicResponse)
    expect(publicPayload.data.find((item) => item.id === createPayload.data.id)).toBeFalsy()

    const ownResponse = await api.fetch(
      new Request(`https://whitehive.test/api/services?status=all&sellerId=${createPayload.data.sellerId}`, {
        headers: { authorization: `Bearer ${sellerToken}` },
      }),
    )
    const ownPayload = await jsonResponse(ownResponse)
    expect(ownPayload.data.find((item) => item.id === createPayload.data.id)).toBeTruthy()

    const adminEmail = uniqueEmail('service-admin')
    process.env.WHITEHIVE_ADMIN_EMAILS = adminEmail
    const adminResponse = await api.fetch(
      new Request('https://whitehive.test/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email: adminEmail,
          password: 'testpass123',
          displayName: '平台管理员',
          role: 'seller',
        }),
      }),
    )
    const adminPayload = await jsonResponse(adminResponse)

    const rejectResponse = await api.fetch(
      new Request(`https://whitehive.test/api/services?id=${createPayload.data.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminPayload.data.session.token}`,
        },
        body: JSON.stringify({
          status: 'rejected',
          reviewNote: '请补充交付范围。',
        }),
      }),
    )
    const rejectPayload = await jsonResponse(rejectResponse)
    expect(rejectResponse.status).toBe(200)
    expect(rejectPayload.data.status).toBe('rejected')

    const notificationsResponse = await api.fetch(
      new Request('https://whitehive.test/api/notifications', {
        headers: { authorization: `Bearer ${sellerToken}` },
      }),
    )
    const notificationsPayload = await jsonResponse(notificationsResponse)
    expect(notificationsResponse.status).toBe(200)
    expect(notificationsPayload.data[0].type).toBe('service.rejected')
    expect(notificationsPayload.data[0].body).toContain('请补充交付范围')

    const resubmitResponse = await api.fetch(
      new Request(`https://whitehive.test/api/services?id=${createPayload.data.id}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          title: '真实审核服务修正版',
          summary: '补充了清晰的交付范围和验收边界。',
          priceCents: 120000,
          deliveryDays: 6,
          tags: ['官网', '交付说明'],
        }),
      }),
    )
    const resubmitPayload = await jsonResponse(resubmitResponse)
    expect(resubmitResponse.status).toBe(200)
    expect(resubmitPayload.data.status).toBe('pending_review')
    expect(resubmitPayload.data.reviewNote).toBe('')
    expect(resubmitPayload.data.title).toBe('真实审核服务修正版')

    const reviewResponse = await api.fetch(
      new Request(`https://whitehive.test/api/services?id=${createPayload.data.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminPayload.data.session.token}`,
        },
        body: JSON.stringify({
          status: 'published',
          reviewNote: '审核通过。',
        }),
      }),
    )
    const reviewPayload = await jsonResponse(reviewResponse)
    expect(reviewResponse.status).toBe(200)
    expect(reviewPayload.data.status).toBe('published')

    const publicAfterResponse = await api.fetch(new Request('https://whitehive.test/api/services?status=published'))
    const publicAfterPayload = await jsonResponse(publicAfterResponse)
    expect(publicAfterPayload.data.find((item) => item.id === createPayload.data.id)).toBeTruthy()
  })
})
