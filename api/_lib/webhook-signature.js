// Webhook signature · HMAC-SHA256 签名 + 时序攻击安全的校验（纯逻辑）
//
// 给外部集成 (e.g. 渠道方回调、future 分账服务) 用。
// 运行环境: Vercel Edge / Node 18+ —— 用 Web Crypto subtle API, 不依赖 node:crypto,
// 方便在任何 JS runtime 里跑。
//
// 用法:
//   const sig = await signPayload({ body: JSON.stringify(payload), secret, timestamp })
//   // sig = "t=1700000000,v1=abc123..."
//   // 放进 header: X-WhiteHive-Signature: ${sig}
//
//   const ok = await verifyPayload({ body, secret, header, toleranceSec: 300 })
//   // true 表示签名有效且在 5 分钟时效内

const VERSION = 'v1'
const DEFAULT_TOLERANCE_SEC = 300

/**
 * 对 body 字符串签名, 返回 "t=<timestamp>,v1=<hex>" 风格的 header value。
 */
export async function signPayload({ body, secret, timestamp, now }) {
  if (typeof body !== 'string') throw new TypeError('body must be a string')
  if (typeof secret !== 'string' || !secret) throw new TypeError('secret required')
  const ts = Number.isFinite(timestamp)
    ? Math.floor(timestamp)
    : Math.floor((now ?? Date.now()) / 1000)
  const payload = `${ts}.${body}`
  const hex = await hmacSha256Hex(secret, payload)
  return `t=${ts},${VERSION}=${hex}`
}

/**
 * 解析 header。非法格式返回 null, 不抛。
 */
export function parseSignatureHeader(header) {
  if (typeof header !== 'string' || !header) return null
  const parts = header.split(',').map((s) => s.trim()).filter(Boolean)
  let t = null
  const sigs = {}
  for (const p of parts) {
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const k = p.slice(0, eq).trim()
    const v = p.slice(eq + 1).trim()
    if (k === 't') {
      const n = Number(v)
      if (Number.isFinite(n)) t = Math.floor(n)
    } else if (/^v\d+$/.test(k)) {
      sigs[k] = v
    }
  }
  if (t == null || !sigs[VERSION]) return null
  return { timestamp: t, signatures: sigs }
}

/**
 * 验签。返回 { valid, reason? }。不抛。
 *
 *   reason ∈ 'bad_header' | 'expired' | 'signature_mismatch' | 'bad_input'
 */
export async function verifyPayload({ body, secret, header, toleranceSec, now }) {
  if (typeof body !== 'string' || typeof secret !== 'string' || !secret) {
    return { valid: false, reason: 'bad_input' }
  }
  const parsed = parseSignatureHeader(header)
  if (!parsed) return { valid: false, reason: 'bad_header' }
  const tol = Number.isFinite(toleranceSec) ? toleranceSec : DEFAULT_TOLERANCE_SEC
  const nowSec = Math.floor((now ?? Date.now()) / 1000)
  if (Math.abs(nowSec - parsed.timestamp) > tol) {
    return { valid: false, reason: 'expired' }
  }
  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${body}`)
  const actual = parsed.signatures[VERSION]
  if (!timingSafeEqualHex(expected, actual)) {
    return { valid: false, reason: 'signature_mismatch' }
  }
  return { valid: true }
}

/**
 * 生成一个新的 webhook secret（供后台给商户生成用）。
 * 32 bytes → 64 hex chars, 看起来像 whsec_xxxx 前缀。
 */
export function generateWebhookSecret({ bytes = 32 } = {}) {
  const arr = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr)
  } else {
    // 兜底 —— 不应走到这里（所有目标 runtime 都有 crypto）
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  let hex = ''
  for (const b of arr) hex += b.toString(16).padStart(2, '0')
  return `whsec_${hex}`
}

// --- internals ---

async function hmacSha256Hex(secret, payload) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const bytes = new Uint8Array(sig)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/**
 * 常数时间比较, 避免时序侧信道 leak。
 * 两串长度不等直接 false (长度本身不是秘密)。
 */
export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
