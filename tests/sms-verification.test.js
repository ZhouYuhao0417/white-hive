import { test, expect, describe } from 'bun:test'
import {
  validatePhone,
  generateCode,
  createSmsVerificationStore,
  smsPurposes,
  assertIssue,
  assertVerify,
} from '../api/_lib/sms-verification.js'

describe('sms-verification · validatePhone', () => {
  test('accepts standard 11-digit', () => {
    expect(validatePhone('13812345678').ok).toBe(true)
  })
  test('strips +86 and spaces', () => {
    expect(validatePhone('+86 138 1234 5678')).toEqual({ ok: true, normalized: '13812345678' })
    expect(validatePhone('+8613812345678').normalized).toBe('13812345678')
  })
  test('rejects short / bad prefix', () => {
    expect(validatePhone('12812345678').ok).toBe(false)
    expect(validatePhone('138123').ok).toBe(false)
    expect(validatePhone('').ok).toBe(false)
  })
  test('rejects non-string', () => {
    expect(validatePhone(null).ok).toBe(false)
    expect(validatePhone({}).ok).toBe(false)
  })
  test('accepts number type', () => {
    expect(validatePhone(13812345678).ok).toBe(true)
  })
})

describe('sms-verification · generateCode', () => {
  test('default 6 digits', () => {
    const c = generateCode()
    expect(c).toMatch(/^\d{6}$/)
  })
  test('custom length 4-8', () => {
    expect(generateCode({ length: 4 })).toMatch(/^\d{4}$/)
    expect(generateCode({ length: 8 })).toMatch(/^\d{8}$/)
  })
  test('rejects bad length', () => {
    expect(() => generateCode({ length: 3 })).toThrow()
    expect(() => generateCode({ length: 9 })).toThrow()
  })
  test('produces varied output', () => {
    const set = new Set()
    for (let i = 0; i < 50; i++) set.add(generateCode())
    expect(set.size).toBeGreaterThan(30) // very unlikely to collide
  })
})

describe('sms-verification · issue', () => {
  test('first issue returns code + expiresAt', () => {
    const s = createSmsVerificationStore()
    const r = s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    expect(r.ok).toBe(true)
    expect(r.code).toMatch(/^\d{6}$/)
    expect(r.remainingToday).toBe(4)
  })

  test('second issue within 60s throttled', () => {
    const s = createSmsVerificationStore()
    s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const r = s.issue({ phone: '13812345678', purpose: 'signup', now: 1_030_000 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('throttled')
    expect(r.retryAfterSec).toBeGreaterThan(0)
  })

  test('after 60s another issue allowed', () => {
    const s = createSmsVerificationStore()
    s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const r = s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 + 61_000 })
    expect(r.ok).toBe(true)
  })

  test('5 per day cap', () => {
    const s = createSmsVerificationStore()
    let t = 1_000_000
    for (let i = 0; i < 5; i++) {
      s.issue({ phone: '13812345678', purpose: 'signup', now: t })
      t += 61_000
    }
    const r = s.issue({ phone: '13812345678', purpose: 'signup', now: t })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('daily_quota_exceeded')
  })

  test('different purposes counted separately', () => {
    const s = createSmsVerificationStore()
    const a = s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const b = s.issue({ phone: '13812345678', purpose: 'login', now: 1_000_000 })
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true) // different purpose key
  })

  test('rejects bad phone / purpose', () => {
    const s = createSmsVerificationStore()
    expect(s.issue({ phone: 'bogus', purpose: 'signup' }).reason).toBe('bad_phone')
    expect(s.issue({ phone: '13812345678', purpose: 'bogus' }).reason).toBe('bad_purpose')
  })
})

describe('sms-verification · verify', () => {
  test('correct code passes, then consumed', () => {
    const s = createSmsVerificationStore()
    const r = s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const v = s.verify({ phone: '13812345678', purpose: 'signup', code: r.code, now: 1_001_000 })
    expect(v.ok).toBe(true)
    // replay rejected
    const v2 = s.verify({ phone: '13812345678', purpose: 'signup', code: r.code, now: 1_002_000 })
    expect(v2.ok).toBe(false)
    expect(v2.reason).toBe('not_found')
  })

  test('wrong code → attemptsLeft', () => {
    const s = createSmsVerificationStore()
    s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const v = s.verify({ phone: '13812345678', purpose: 'signup', code: '000000', now: 1_001_000 })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('wrong_code')
    expect(v.attemptsLeft).toBe(4)
  })

  test('5 wrong attempts → too_many_attempts', () => {
    const s = createSmsVerificationStore()
    s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    for (let i = 0; i < 5; i++) {
      s.verify({ phone: '13812345678', purpose: 'signup', code: '000000', now: 1_001_000 + i })
    }
    const r = s.verify({ phone: '13812345678', purpose: 'signup', code: '000000', now: 1_002_000 })
    expect(r.reason).toBe('too_many_attempts')
  })

  test('expired code rejected', () => {
    const s = createSmsVerificationStore()
    const r = s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const v = s.verify({
      phone: '13812345678',
      purpose: 'signup',
      code: r.code,
      now: 1_000_000 + 10 * 60 * 1000, // 10 min later
    })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('expired')
  })

  test('malformed code rejected without touching state', () => {
    const s = createSmsVerificationStore()
    s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const v = s.verify({ phone: '13812345678', purpose: 'signup', code: 'abcdef', now: 1_001_000 })
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('wrong_code')
    // attempts counter NOT consumed — next real try still has 5 attempts
    const inspect = s.inspect({ phone: '13812345678', purpose: 'signup' })
    expect(inspect.attempts).toBe(0)
  })
})

describe('sms-verification · revoke / inspect / assert', () => {
  test('revoke wipes state', () => {
    const s = createSmsVerificationStore()
    s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    expect(s.revoke({ phone: '13812345678', purpose: 'signup' })).toBe(true)
    expect(s.inspect({ phone: '13812345678', purpose: 'signup' })).toBeNull()
  })
  test('inspect hides code', () => {
    const s = createSmsVerificationStore()
    s.issue({ phone: '13812345678', purpose: 'signup', now: 1_000_000 })
    const info = s.inspect({ phone: '13812345678', purpose: 'signup', now: 1_001_000 })
    expect(info).toMatchObject({ purpose: 'signup', phone: '13812345678', attempts: 0 })
    expect(info.code).toBeUndefined()
  })

  test('assertIssue throws on throttle', () => {
    expect(() => assertIssue({ ok: false, reason: 'throttled', retryAfterSec: 42 })).toThrow(
      /sms_throttled|42/,
    )
  })
  test('assertIssue passes through ok', () => {
    const r = assertIssue({ ok: true, code: '123456' })
    expect(r.code).toBe('123456')
  })
  test('assertVerify throws 410 on expired', () => {
    try {
      assertVerify({ ok: false, reason: 'expired' })
      throw new Error('should throw')
    } catch (e) {
      expect(e.status).toBe(410)
    }
  })
})

describe('sms-verification · enums', () => {
  test('smsPurposes frozen', () => {
    expect(smsPurposes).toContain('signup')
    expect(() => (smsPurposes[0] = 'x')).toThrow()
  })
})
