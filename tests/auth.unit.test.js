import { test, expect, describe } from 'bun:test'
import {
  normalizeEmail,
  normalizeRole,
  normalizeAuthProvider,
  validateEmail,
  validatePassword,
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashToken,
  isSyntheticAuthEmail,
  createEmailVerificationCode,
  validateEmailVerificationCode,
  providerEmail,
  sanitizeProviderAuthInput,
  sanitizeProfileInput,
} from '../api/_lib/auth.js'
import { HttpError } from '../api/_lib/http.js'

describe('auth · normalize + validate', () => {
  test('normalizeEmail lowercases and trims', () => {
    expect(normalizeEmail('  Foo@EXAMPLE.com  ')).toBe('foo@example.com')
    expect(normalizeEmail(null)).toBe('')
  })

  test('normalizeRole clamps to buyer | seller', () => {
    expect(normalizeRole('seller')).toBe('seller')
    expect(normalizeRole('BUYER')).toBe('buyer')
    expect(normalizeRole('admin')).toBe('buyer') // admin is NOT a valid registration role
    expect(normalizeRole(undefined)).toBe('buyer')
  })

  test('normalizeAuthProvider accepts supported providers and rejects others', () => {
    expect(normalizeAuthProvider('github')).toBe('github')
    expect(normalizeAuthProvider('PHONE')).toBe('phone')
    expect(() => normalizeAuthProvider('google')).toThrow(HttpError)
    expect(() => normalizeAuthProvider('')).toThrow(HttpError)
  })

  test('validateEmail rejects invalid shapes', () => {
    expect(validateEmail('a@b.co')).toBe('a@b.co')
    expect(() => validateEmail('not-an-email')).toThrow(HttpError)
    expect(() => validateEmail('a@b')).toThrow(HttpError)
  })

  test('validatePassword enforces min 8 chars', () => {
    expect(validatePassword('12345678')).toBe('12345678')
    expect(() => validatePassword('1234567')).toThrow(HttpError)
    expect(() => validatePassword('')).toThrow(HttpError)
  })
})

describe('auth · password hashing', () => {
  test('hashPassword returns scrypt$salt$hash format', () => {
    const stored = hashPassword('correct-horse-battery')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(stored.split('$').length).toBe(3)
  })

  test('verifyPassword is timing-safe and correct', () => {
    const stored = hashPassword('correct-horse-battery')
    expect(verifyPassword('correct-horse-battery', stored)).toBe(true)
    expect(verifyPassword('wrong-password-try', stored)).toBe(false)
  })

  test('verifyPassword rejects malformed stored hash', () => {
    expect(verifyPassword('anything', '')).toBe(false)
    expect(verifyPassword('anything', 'not-a-hash')).toBe(false)
    expect(verifyPassword('anything', 'scrypt$onlyonepart')).toBe(false)
  })
})

describe('auth · tokens + codes', () => {
  test('createSessionToken returns a 43+ char base64url token', () => {
    const token = createSessionToken()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThanOrEqual(43) // 32 bytes → base64url = 43 chars
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true)
  })

  test('hashToken is deterministic SHA-256 hex', () => {
    const h1 = hashToken('abc')
    const h2 = hashToken('abc')
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(h1)).toBe(true)
    expect(hashToken('abd')).not.toBe(h1)
  })

  test('createEmailVerificationCode returns a 6-digit numeric string', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = createEmailVerificationCode()
      expect(/^\d{6}$/.test(code)).toBe(true)
    }
  })

  test('validateEmailVerificationCode enforces 6 digits', () => {
    expect(validateEmailVerificationCode('123456')).toBe('123456')
    expect(() => validateEmailVerificationCode('12345')).toThrow(HttpError)
    expect(() => validateEmailVerificationCode('abcdef')).toThrow(HttpError)
    expect(() => validateEmailVerificationCode('')).toThrow(HttpError)
  })
})

describe('auth · provider helpers', () => {
  test('providerEmail is stable per provider+id and looks like an email', () => {
    const a = providerEmail('github', 'user123')
    const b = providerEmail('github', 'user123')
    const c = providerEmail('github', 'user456')
    const d = providerEmail('qq', 'user123')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
    expect(/@auth\.whitehive\.local$/.test(a)).toBe(true)
    expect(isSyntheticAuthEmail(a)).toBe(true)
    expect(isSyntheticAuthEmail('user@whitehive.cn')).toBe(false)
  })

  test('sanitizeProviderAuthInput fills defaults and limits lengths', () => {
    const result = sanitizeProviderAuthInput({
      provider: 'wechat',
      providerUserId: 'wx-x'.repeat(50),
      displayName: '测'.repeat(60),
      role: 'seller',
    })
    expect(result.provider).toBe('wechat')
    expect(result.providerLabel).toBe('微信')
    expect(result.role).toBe('seller')
    expect(result.displayName.length).toBeLessThanOrEqual(40)
    expect(result.providerUserId.length).toBeLessThanOrEqual(80)
    expect(result.bio).toBe('')
  })

  test('sanitizeProviderAuthInput requires a real provider user id', () => {
    expect(() => sanitizeProviderAuthInput({ provider: 'github' })).toThrow(HttpError)
  })
})

describe('auth · profile sanitization', () => {
  test('sanitizeProfileInput derives name from email prefix when missing', () => {
    const profile = sanitizeProfileInput({}, 'student@test.com', 'buyer')
    expect(profile.displayName).toBe('student')
    expect(profile.role).toBe('buyer')
  })

  test('sanitizeProfileInput enforces role whitelist', () => {
    const profile = sanitizeProfileInput({ role: 'admin' }, 'a@b.co', 'buyer')
    expect(profile.role).toBe('buyer') // admin stripped
  })

  test('sanitizeProfileInput accepts https avatar URL', () => {
    const profile = sanitizeProfileInput(
      { avatarUrl: 'https://cdn.example.com/me.png' },
      'a@b.co',
    )
    expect(profile.avatarUrl).toBe('https://cdn.example.com/me.png')
  })

  test('sanitizeProfileInput rejects non-https, non-data avatar URL', () => {
    expect(() =>
      sanitizeProfileInput({ avatarUrl: 'javascript:alert(1)' }, 'a@b.co'),
    ).toThrow(HttpError)
    expect(() =>
      sanitizeProfileInput({ avatarUrl: 'http://insecure.example.com/me.png' }, 'a@b.co'),
    ).toThrow(HttpError)
  })
})
