import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { HttpError } from './http.js'

const sessionDays = 30
const emailVerificationMinutes = 20

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function normalizeRole(role) {
  return role === 'seller' ? 'seller' : 'buyer'
}

export function validateEmail(email) {
  const normalized = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new HttpError(400, 'invalid_email', '请输入有效邮箱。')
  }
  return normalized
}

export function validatePassword(password) {
  const value = String(password || '')
  if (value.length < 8) {
    throw new HttpError(400, 'weak_password', '密码至少需要 8 位。')
  }
  return value
}

export function hashPassword(password) {
  const value = validatePassword(password)
  const salt = randomBytes(16).toString('base64url')
  const hash = scryptSync(value, salt, 32).toString('base64url')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password, storedHash) {
  const value = String(password || '')
  const parts = String(storedHash || '').split('$')

  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false
  }

  const [, salt, expectedHash] = parts
  const expected = Buffer.from(expectedHash, 'base64url')
  const actual = scryptSync(value, salt, expected.length)

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex')
}

export function sessionExpiresAt() {
  const expiresAt = new Date()
  expiresAt.setUTCDate(expiresAt.getUTCDate() + sessionDays)
  return expiresAt.toISOString()
}

export function createEmailVerificationCode() {
  return String(randomInt(100000, 1000000))
}

export function validateEmailVerificationCode(code) {
  const value = String(code || '').trim()
  if (!/^\d{6}$/.test(value)) {
    throw new HttpError(400, 'invalid_email_code', '请输入 6 位邮箱验证码。')
  }
  return value
}

export function emailVerificationExpiresAt() {
  const expiresAt = new Date()
  expiresAt.setUTCMinutes(expiresAt.getUTCMinutes() + emailVerificationMinutes)
  return expiresAt.toISOString()
}

export function sanitizeProfileInput(input = {}, fallbackEmail = '', fallbackRole = 'buyer') {
  const emailPrefix = normalizeEmail(fallbackEmail).split('@')[0] || 'WhiteHive 用户'
  const roleInput = input.role || input.mode
  return {
    displayName: limitText(input.displayName || emailPrefix, 40),
    role: roleInput ? normalizeRole(roleInput) : normalizeRole(fallbackRole),
    phone: limitText(input.phone, 40),
    schoolOrCompany: limitText(input.schoolOrCompany, 80),
    city: limitText(input.city, 40),
    bio: limitText(input.bio, 240),
  }
}

function limitText(value, maxLength) {
  const text = String(value || '').trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}
