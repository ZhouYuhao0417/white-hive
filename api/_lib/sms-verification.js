// SMS verification · 手机短信验证码（纯逻辑）
//
// 这里只管：
//   1) 生成 6 位数字验证码 (安全随机, 非 Math.random)
//   2) 校验手机号格式（中国大陆 11 位 1[3-9]xxxxxxxxx）
//   3) 管一个短信验证码的 in-memory state：issuedAt / expiresAt / attempts
//   4) 限频: 同一手机号 60s 内只能发一次, 24h 内最多 5 次
//   5) 校验: 最多输错 5 次, 过期不接受
//
// 发送真正的短信由 Codex 的 transport 层做 (待建 api/_lib/sms.js, 类似 email.js)。
// 这里只做决策 "应不应该发" 与 "验证码对不对"。
//
// 用法:
//   const store = createSmsVerificationStore()
//   const { code, issue } = store.issue({ phone, purpose: 'signup' })
//   // → Codex: await sendSms(phone, `您的白蜂网验证码: ${code}, 5 分钟内有效。`)
//   store.verify({ phone, purpose: 'signup', code: '123456' }) // { ok, reason? }

import { HttpError } from './http.js'

const CN_PHONE_RE = /^1[3-9]\d{9}$/
const CODE_TTL_MS = 5 * 60 * 1000 // 5 min
const MIN_RESEND_MS = 60 * 1000 // 60s
const MAX_PER_DAY = 5
const MAX_VERIFY_ATTEMPTS = 5
const DAY_MS = 24 * 60 * 60 * 1000

export const smsPurposes = Object.freeze(['signup', 'login', 'bind_phone', 'reset_password'])

/**
 * 手机号格式校验。返回 { ok, reason?, normalized? }。不抛。
 *   normalized = 去掉 +86 / 空格 / -
 */
export function validatePhone(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return { ok: false, reason: 'not_string' }
  }
  const s = String(raw).replace(/[\s\-()]/g, '').replace(/^\+?86/, '')
  if (!CN_PHONE_RE.test(s)) {
    return { ok: false, reason: 'bad_format' }
  }
  return { ok: true, normalized: s }
}

/**
 * 产出一个 6 位数字验证码 (密码学安全)。
 * 不暴露构造细节, Codex 只要把它拼进短信文案。
 */
export function generateCode({ length = 6 } = {}) {
  if (!Number.isInteger(length) || length < 4 || length > 8) {
    throw new RangeError('code length must be 4-8')
  }
  const max = 10 ** length
  let n
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    // uniform pick 0..max-1
    const arr = new Uint32Array(1)
    // 拒绝采样避免模偏
    const limit = Math.floor(0xffffffff / max) * max
    do {
      crypto.getRandomValues(arr)
    } while (arr[0] >= limit)
    n = arr[0] % max
  } else {
    n = Math.floor(Math.random() * max)
  }
  return n.toString().padStart(length, '0')
}

/**
 * phone + purpose 组合的 key。
 */
function stateKey(phone, purpose) {
  return `${purpose}:${phone}`
}

/**
 * 创建一个短信验证码管理器。默认 in-memory Map, 可注入 store。
 *
 *   const store = createSmsVerificationStore({
 *     store: customStoreWithGetSetDelete,
 *   })
 */
export function createSmsVerificationStore(opts = {}) {
  const backing = opts.store || new Map()
  const api = {
    get: (k) => (typeof backing.get === 'function' ? backing.get(k) : backing[k]),
    set: (k, v) => (typeof backing.set === 'function' ? backing.set(k, v) : (backing[k] = v)),
    delete: (k) =>
      typeof backing.delete === 'function' ? backing.delete(k) : delete backing[k],
  }

  /**
   * 决定"现在能不能发给这个手机号", 不实际发短信。
   *   { ok: true, code, expiresAt, issuedAt }  —— 调用方拿 code 去发短信
   *   { ok: false, reason, retryAfterSec? }
   *     reason ∈ 'bad_phone' | 'bad_purpose' | 'throttled' | 'daily_quota_exceeded'
   */
  function issue({ phone, purpose, now, codeLength }) {
    const v = validatePhone(phone)
    if (!v.ok) return { ok: false, reason: 'bad_phone' }
    if (!smsPurposes.includes(purpose)) return { ok: false, reason: 'bad_purpose' }
    const t = now ?? Date.now()
    const key = stateKey(v.normalized, purpose)
    const prev = api.get(key)

    // 限频 —— 上次发送 < 60s 前拒绝
    if (prev && prev.issuedAt && t - prev.issuedAt < MIN_RESEND_MS) {
      const retryAfterSec = Math.ceil((MIN_RESEND_MS - (t - prev.issuedAt)) / 1000)
      return { ok: false, reason: 'throttled', retryAfterSec }
    }

    // 24h 窗口配额
    const today = prev?.day === dayBucket(t) ? prev.dailyCount || 0 : 0
    if (today >= MAX_PER_DAY) {
      return { ok: false, reason: 'daily_quota_exceeded' }
    }

    const code = generateCode({ length: codeLength || 6 })
    const record = {
      code,
      purpose,
      phone: v.normalized,
      issuedAt: t,
      expiresAt: t + CODE_TTL_MS,
      attempts: 0,
      day: dayBucket(t),
      dailyCount: today + 1,
    }
    api.set(key, record)
    return {
      ok: true,
      code,
      expiresAt: new Date(record.expiresAt).toISOString(),
      issuedAt: new Date(record.issuedAt).toISOString(),
      remainingToday: MAX_PER_DAY - record.dailyCount,
    }
  }

  /**
   * 校验用户输入的验证码。成功即消费 (一次性 code)。
   *   { ok: true }
   *   { ok: false, reason, attemptsLeft? }
   *     reason ∈ 'bad_phone' | 'not_found' | 'expired' | 'too_many_attempts' | 'wrong_code'
   */
  function verify({ phone, purpose, code, now }) {
    const v = validatePhone(phone)
    if (!v.ok) return { ok: false, reason: 'bad_phone' }
    if (!smsPurposes.includes(purpose)) return { ok: false, reason: 'bad_purpose' }
    if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
      return { ok: false, reason: 'wrong_code' }
    }
    const key = stateKey(v.normalized, purpose)
    const rec = api.get(key)
    if (!rec) return { ok: false, reason: 'not_found' }
    const t = now ?? Date.now()
    if (t > rec.expiresAt) {
      api.delete(key)
      return { ok: false, reason: 'expired' }
    }
    if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
      return { ok: false, reason: 'too_many_attempts' }
    }
    // 常数时间比较 (短 code 就 str compare, 长度相等)
    if (!timingSafeEqual(rec.code, code)) {
      rec.attempts += 1
      api.set(key, rec)
      return {
        ok: false,
        reason: 'wrong_code',
        attemptsLeft: Math.max(0, MAX_VERIFY_ATTEMPTS - rec.attempts),
      }
    }
    api.delete(key) // 验证过一次就消费掉, 避免重放
    return { ok: true }
  }

  /**
   * 把这对 phone+purpose 的 code 作废, 例如用户点"重新发送"之前。
   */
  function revoke({ phone, purpose }) {
    const v = validatePhone(phone)
    if (!v.ok) return false
    if (!smsPurposes.includes(purpose)) return false
    return api.delete(stateKey(v.normalized, purpose))
  }

  /**
   * 给当前状态一个只读快照 (调试 / 管理端用, 不暴露 code)。
   */
  function inspect({ phone, purpose, now }) {
    const v = validatePhone(phone)
    if (!v.ok) return null
    const rec = api.get(stateKey(v.normalized, purpose))
    if (!rec) return null
    const t = now ?? Date.now()
    return {
      purpose,
      phone: rec.phone,
      issuedAt: new Date(rec.issuedAt).toISOString(),
      expiresAt: new Date(rec.expiresAt).toISOString(),
      expired: t > rec.expiresAt,
      attempts: rec.attempts,
      attemptsLeft: Math.max(0, MAX_VERIFY_ATTEMPTS - rec.attempts),
      dailyCount: rec.dailyCount,
    }
  }

  return { issue, verify, revoke, inspect, _store: backing }
}

/**
 * 强校验版 —— issue 结果非法时抛 HttpError 429 / 400。给 Codex 在 handler 里直接 await。
 */
export function assertIssue(result) {
  if (result.ok) return result
  const reason = result.reason
  if (reason === 'throttled') {
    throw new HttpError(
      429,
      'sms_throttled',
      `请求太快了, 请 ${result.retryAfterSec || 60} 秒后再试。`,
      { retryAfterSec: result.retryAfterSec },
    )
  }
  if (reason === 'daily_quota_exceeded') {
    throw new HttpError(429, 'sms_quota_exceeded', '今天发的验证码已达上限, 请明天再试。')
  }
  if (reason === 'bad_phone') {
    throw new HttpError(400, 'invalid_phone', '请输入正确的手机号。')
  }
  if (reason === 'bad_purpose') {
    throw new HttpError(400, 'invalid_purpose', '未知的验证码用途。')
  }
  throw new HttpError(500, 'sms_issue_failed', '短信下发失败。', { reason })
}

/**
 * 强校验版 verify —— 校验失败抛 HttpError 400 / 410。
 */
export function assertVerify(result) {
  if (result.ok) return result
  const msg = {
    bad_phone: '请输入正确的手机号。',
    bad_purpose: '未知的验证码用途。',
    not_found: '请先获取验证码。',
    expired: '验证码已过期, 请重新获取。',
    too_many_attempts: '输入错误次数过多, 请重新获取验证码。',
    wrong_code: '验证码不正确。',
  }
  const status = result.reason === 'expired' ? 410 : 400
  throw new HttpError(status, 'sms_verify_failed', msg[result.reason] || '验证码校验失败。', {
    reason: result.reason,
    attemptsLeft: result.attemptsLeft,
  })
}

function dayBucket(ms) {
  return Math.floor(ms / DAY_MS)
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
