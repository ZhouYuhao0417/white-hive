import { test, expect, describe } from 'bun:test'
import {
  signPayload,
  verifyPayload,
  parseSignatureHeader,
  generateWebhookSecret,
  timingSafeEqualHex,
} from '../api/_lib/webhook-signature.js'

const secret = 'whsec_test_abcdefghijklmnop'
const body = '{"event":"order.released","id":"ord_1"}'

describe('webhook-signature · sign + verify happy path', () => {
  test('round-trip verifies', async () => {
    const nowMs = 1_700_000_000_000
    const header = await signPayload({ body, secret, now: nowMs })
    const r = await verifyPayload({ body, secret, header, now: nowMs + 10_000 })
    expect(r.valid).toBe(true)
  })

  test('sign format t=,v1=', async () => {
    const h = await signPayload({ body, secret, timestamp: 1_700_000_000 })
    expect(h).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/)
  })
})

describe('webhook-signature · rejection cases', () => {
  test('expired outside tolerance', async () => {
    const nowMs = 1_700_000_000_000
    const header = await signPayload({ body, secret, now: nowMs })
    const r = await verifyPayload({
      body,
      secret,
      header,
      now: nowMs + 10 * 60 * 1000, // 10 min later, default tol = 5 min
    })
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('expired')
  })

  test('tampered body → signature_mismatch', async () => {
    const nowMs = 1_700_000_000_000
    const header = await signPayload({ body, secret, now: nowMs })
    const r = await verifyPayload({
      body: body + 'tamper',
      secret,
      header,
      now: nowMs + 5_000,
    })
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('signature_mismatch')
  })

  test('wrong secret → signature_mismatch', async () => {
    const nowMs = 1_700_000_000_000
    const header = await signPayload({ body, secret, now: nowMs })
    const r = await verifyPayload({ body, secret: 'whsec_other', header, now: nowMs + 5_000 })
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('signature_mismatch')
  })

  test('bad header', async () => {
    const r = await verifyPayload({ body, secret, header: 'garbage', now: Date.now() })
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('bad_header')
  })

  test('bad input', async () => {
    const r = await verifyPayload({ body: null, secret, header: 't=1,v1=abc' })
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('bad_input')
  })
})

describe('webhook-signature · parseSignatureHeader', () => {
  test('parses t + v1', () => {
    const p = parseSignatureHeader('t=123, v1=abc123')
    expect(p).toEqual({ timestamp: 123, signatures: { v1: 'abc123' } })
  })
  test('accepts multiple versions', () => {
    const p = parseSignatureHeader('t=9, v1=aa, v2=bb')
    expect(p.signatures).toEqual({ v1: 'aa', v2: 'bb' })
  })
  test('null on missing parts', () => {
    expect(parseSignatureHeader('')).toBeNull()
    expect(parseSignatureHeader('v1=abc')).toBeNull()
    expect(parseSignatureHeader('t=abc,v1=x')).toBeNull() // non-numeric timestamp
    expect(parseSignatureHeader(null)).toBeNull()
  })
})

describe('webhook-signature · helpers', () => {
  test('generateWebhookSecret format', () => {
    const s = generateWebhookSecret()
    expect(s.startsWith('whsec_')).toBe(true)
    expect(s.length).toBeGreaterThan(32)
  })
  test('secrets differ between calls', () => {
    const a = generateWebhookSecret()
    const b = generateWebhookSecret()
    expect(a).not.toBe(b)
  })
  test('timingSafeEqualHex', () => {
    expect(timingSafeEqualHex('abc', 'abc')).toBe(true)
    expect(timingSafeEqualHex('abc', 'abd')).toBe(false)
    expect(timingSafeEqualHex('abc', 'abcd')).toBe(false)
    expect(timingSafeEqualHex(null, 'abc')).toBe(false)
  })
})

describe('webhook-signature · throws on bad input', () => {
  test('signPayload missing secret', async () => {
    await expect(signPayload({ body, secret: '', now: 0 })).rejects.toThrow()
  })
  test('signPayload non-string body', async () => {
    await expect(signPayload({ body: 123, secret })).rejects.toThrow()
  })
})
