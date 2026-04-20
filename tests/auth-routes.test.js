import { test, expect, describe, beforeEach } from 'bun:test'
import api from '../api/index.js'
import { resetMemoryStore, clearProductionEnv } from './helpers.js'

function jsonResponse(response) {
  return response.json()
}

describe('api · auth route hardening', () => {
  beforeEach(() => {
    resetMemoryStore()
    clearProductionEnv()
    delete process.env.WHITEHIVE_ALLOW_DEMO_SESSION
    delete process.env.WHITEHIVE_ALLOW_PROVIDER_BRIDGE
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
})
