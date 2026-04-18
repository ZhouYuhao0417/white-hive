import { test, expect, describe } from 'bun:test'
import {
  validateKey,
  createIdempotencyCache,
  runIdempotent,
} from '../api/_lib/idempotency.js'

describe('idempotency · validateKey', () => {
  test('accepts UUID-like formats', () => {
    expect(validateKey('3f1e5a91-2c8b-4c16-9c7d-9aeb4d6e11aa').ok).toBe(true)
    expect(validateKey('order:usr_1:abc123DEF').ok).toBe(true)
  })
  test('rejects too short / bad chars', () => {
    expect(validateKey('short').ok).toBe(false)
    expect(validateKey('has space in it more').ok).toBe(false)
    expect(validateKey('').ok).toBe(false)
    expect(validateKey(123).ok).toBe(false)
  })
  test('rejects oversized key', () => {
    expect(validateKey('a'.repeat(129)).ok).toBe(false)
  })
})

describe('idempotency · cache state machine', () => {
  test('fresh → in_flight → completed', () => {
    const c = createIdempotencyCache({ ttlMs: 10_000 })
    const key = 'key1-abcdefgh'
    expect(c.inspect(key, { now: 1000 }).state).toBe('fresh')
    const b = c.begin(key, { now: 1000 })
    expect(b.started).toBe(true)
    expect(c.inspect(key, { now: 1001 }).state).toBe('in_flight')
    c.complete(key, { id: 'ord_1' }, { now: 1002 })
    const done = c.inspect(key, { now: 1003 })
    expect(done.state).toBe('completed')
    expect(done.result.id).toBe('ord_1')
  })

  test('second begin on in_flight key returns started:false', () => {
    const c = createIdempotencyCache({ ttlMs: 10_000 })
    const key = 'key2-abcdefgh'
    c.begin(key, { now: 1000 })
    const second = c.begin(key, { now: 1001 })
    expect(second.started).toBe(false)
    expect(second.existing.state).toBe('in_flight')
  })

  test('second begin on completed key returns started:false + result', () => {
    const c = createIdempotencyCache({ ttlMs: 10_000 })
    const key = 'key3-abcdefgh'
    c.begin(key, { now: 1000 })
    c.complete(key, { ok: true }, { now: 1001 })
    const second = c.begin(key, { now: 1002 })
    expect(second.started).toBe(false)
    expect(second.existing.state).toBe('completed')
    expect(second.existing.result.ok).toBe(true)
  })

  test('expired keys become fresh again', () => {
    const c = createIdempotencyCache({ ttlMs: 100 })
    const key = 'key4-abcdefgh'
    c.begin(key, { now: 1000 })
    c.complete(key, { x: 1 }, { now: 1001 })
    // now jump past ttl
    const after = c.inspect(key, { now: 2000 })
    expect(after.state).toBe('expired')
    const begin2 = c.begin(key, { now: 2001 })
    expect(begin2.started).toBe(true)
  })

  test('fail() releases the key', () => {
    const c = createIdempotencyCache({ ttlMs: 10_000 })
    const key = 'key5-abcdefgh'
    c.begin(key, { now: 1000 })
    c.fail(key)
    const again = c.begin(key, { now: 1001 })
    expect(again.started).toBe(true)
  })
})

describe('idempotency · runIdempotent', () => {
  test('runs handler once, replays on second call', async () => {
    const c = createIdempotencyCache({ ttlMs: 10_000 })
    let calls = 0
    const handler = async () => {
      calls += 1
      return { id: 'x', calls }
    }

    const a = await runIdempotent(c, { key: 'run1-abcdefgh', handler, now: 1000 })
    const b = await runIdempotent(c, { key: 'run1-abcdefgh', handler, now: 1001 })
    expect(calls).toBe(1)
    expect(a.replayed).toBe(false)
    expect(b.replayed).toBe(true)
    expect(b.result.id).toBe('x')
  })

  test('handler throw releases the key', async () => {
    const c = createIdempotencyCache({ ttlMs: 10_000 })
    let calls = 0
    const handler = async () => {
      calls += 1
      if (calls === 1) throw new Error('boom')
      return { id: 'ok' }
    }

    await expect(
      runIdempotent(c, { key: 'run2-abcdefgh', handler, now: 1000 }),
    ).rejects.toThrow('boom')

    const ok = await runIdempotent(c, { key: 'run2-abcdefgh', handler, now: 1001 })
    expect(calls).toBe(2)
    expect(ok.replayed).toBe(false)
    expect(ok.result.id).toBe('ok')
  })
})
