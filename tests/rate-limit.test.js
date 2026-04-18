import { test, expect, describe } from 'bun:test'
import { createLimiter, rateLimitHeaders } from '../api/_lib/rate-limit.js'

describe('rate-limit · tokenBucket', () => {
  test('allows up to capacity', () => {
    const L = createLimiter()
    const results = []
    for (let i = 0; i < 5; i++) {
      results.push(L.tokenBucket('k', { capacity: 5, refillPerSec: 1, now: 1_000_000 }))
    }
    expect(results.every((r) => r.allowed)).toBe(true)
    expect(results[4].remaining).toBe(0)
  })

  test('denies the 6th in same instant', () => {
    const L = createLimiter()
    for (let i = 0; i < 5; i++) {
      L.tokenBucket('k', { capacity: 5, refillPerSec: 1, now: 1_000_000 })
    }
    const r = L.tokenBucket('k', { capacity: 5, refillPerSec: 1, now: 1_000_000 })
    expect(r.allowed).toBe(false)
    expect(r.retryAfterSec).toBeGreaterThanOrEqual(1)
  })

  test('refills over time', () => {
    const L = createLimiter()
    for (let i = 0; i < 5; i++) {
      L.tokenBucket('k', { capacity: 5, refillPerSec: 1, now: 1_000_000 })
    }
    // 1 second later → +1 token available
    const r = L.tokenBucket('k', { capacity: 5, refillPerSec: 1, now: 1_001_000 })
    expect(r.allowed).toBe(true)
  })

  test('isolates keys', () => {
    const L = createLimiter()
    for (let i = 0; i < 5; i++) {
      L.tokenBucket('a', { capacity: 5, refillPerSec: 1, now: 1_000_000 })
    }
    const rB = L.tokenBucket('b', { capacity: 5, refillPerSec: 1, now: 1_000_000 })
    expect(rB.allowed).toBe(true)
  })

  test('throws on bad args', () => {
    const L = createLimiter()
    expect(() => L.tokenBucket('', { capacity: 5, refillPerSec: 1 })).toThrow()
    expect(() => L.tokenBucket('k', { capacity: 0, refillPerSec: 1 })).toThrow()
    expect(() => L.tokenBucket('k', { capacity: 5, refillPerSec: 0 })).toThrow()
  })
})

describe('rate-limit · slidingWindow', () => {
  test('allows up to limit inside window', () => {
    const L = createLimiter()
    const base = 2_000_000
    const r1 = L.slidingWindow('k', { limit: 3, windowMs: 60_000, now: base })
    const r2 = L.slidingWindow('k', { limit: 3, windowMs: 60_000, now: base + 100 })
    const r3 = L.slidingWindow('k', { limit: 3, windowMs: 60_000, now: base + 200 })
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  test('denies when limit hit, allows again after window', () => {
    const L = createLimiter()
    const base = 2_000_000
    for (let i = 0; i < 3; i++) {
      L.slidingWindow('k', { limit: 3, windowMs: 60_000, now: base + i })
    }
    const denied = L.slidingWindow('k', {
      limit: 3,
      windowMs: 60_000,
      now: base + 1000,
    })
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1)

    const later = L.slidingWindow('k', {
      limit: 3,
      windowMs: 60_000,
      now: base + 61_000,
    })
    expect(later.allowed).toBe(true)
  })

  test('throws on bad args', () => {
    const L = createLimiter()
    expect(() => L.slidingWindow('k', { limit: 0, windowMs: 1000 })).toThrow()
    expect(() => L.slidingWindow('k', { limit: 2, windowMs: 0 })).toThrow()
  })
})

describe('rate-limit · reset', () => {
  test('reset clears both buckets for key', () => {
    const L = createLimiter()
    for (let i = 0; i < 5; i++) {
      L.tokenBucket('k', { capacity: 5, refillPerSec: 1, now: 1_000_000 })
    }
    L.reset('k')
    const r = L.tokenBucket('k', { capacity: 5, refillPerSec: 1, now: 1_000_000 })
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
  })
})

describe('rate-limit · rateLimitHeaders', () => {
  test('allowed → no retry-after', () => {
    const h = rateLimitHeaders({ allowed: true, remaining: 4, capacity: 10 })
    expect(h['retry-after']).toBeUndefined()
    expect(h['x-ratelimit-remaining']).toBe('4')
  })
  test('denied → retry-after present', () => {
    const h = rateLimitHeaders({ allowed: false, remaining: 0, retryAfterSec: 7, limit: 5 })
    expect(h['retry-after']).toBe('7')
    expect(h['x-ratelimit-limit']).toBe('5')
  })
})
