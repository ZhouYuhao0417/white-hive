// Rate Limit · 接口限流（纯 in-memory，可按 actor key 限）
//
// 两种算法：
//  - tokenBucket(key, { capacity, refillPerSec, now? })  —— 均摊速率
//  - slidingWindow(key, { limit, windowMs, now? })       —— 精确时间窗
//
// 不依赖任何存储后端 —— 适合单实例 Vercel Function 冷启实例、
// 或把 store 注入进来用 KV 持久化。
//
// 用法：
//   import { createLimiter } from './rate-limit.js'
//   const limiter = createLimiter()
//   const ok = limiter.tokenBucket(`ip:${ip}`, { capacity: 20, refillPerSec: 2 })
//   if (!ok.allowed) throw new HttpError(429, 'rate_limited', ...)

/**
 * 创建一个独立的限流器实例（有自己的 in-memory state）。
 * 生产里如果想跨实例共享，可以把 opts.store 注入进来，store 实现：
 *   { get(key), set(key, value), delete(key) }
 */
export function createLimiter(opts = {}) {
  const store = opts.store || defaultMemoryStore()

  function tokenBucket(key, { capacity, refillPerSec, now } = {}) {
    if (!key || typeof key !== 'string') {
      throw new Error('rate-limit: key is required')
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error('rate-limit: capacity must be > 0')
    }
    if (!Number.isFinite(refillPerSec) || refillPerSec <= 0) {
      throw new Error('rate-limit: refillPerSec must be > 0')
    }
    const currentMs = now ?? Date.now()
    const recordKey = `tb:${key}`
    const prev = store.get(recordKey)

    let tokens = capacity
    let lastMs = currentMs

    if (prev && typeof prev.tokens === 'number' && typeof prev.lastMs === 'number') {
      const elapsedSec = Math.max(0, (currentMs - prev.lastMs) / 1000)
      tokens = Math.min(capacity, prev.tokens + elapsedSec * refillPerSec)
      lastMs = currentMs
    }

    if (tokens < 1) {
      const need = 1 - tokens
      const retryAfterSec = Math.ceil(need / refillPerSec)
      store.set(recordKey, { tokens, lastMs })
      return {
        allowed: false,
        remaining: Math.floor(tokens),
        retryAfterSec,
        capacity,
      }
    }

    tokens -= 1
    store.set(recordKey, { tokens, lastMs })
    return {
      allowed: true,
      remaining: Math.floor(tokens),
      retryAfterSec: 0,
      capacity,
    }
  }

  function slidingWindow(key, { limit, windowMs, now } = {}) {
    if (!key || typeof key !== 'string') {
      throw new Error('rate-limit: key is required')
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('rate-limit: limit must be a positive integer')
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error('rate-limit: windowMs must be > 0')
    }
    const currentMs = now ?? Date.now()
    const recordKey = `sw:${key}`
    const cutoff = currentMs - windowMs
    const prev = store.get(recordKey) || { hits: [] }
    const hits = prev.hits.filter((t) => t > cutoff)

    if (hits.length >= limit) {
      const oldest = hits[0]
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - currentMs) / 1000))
      store.set(recordKey, { hits })
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec,
        limit,
      }
    }

    hits.push(currentMs)
    store.set(recordKey, { hits })
    return {
      allowed: true,
      remaining: Math.max(0, limit - hits.length),
      retryAfterSec: 0,
      limit,
    }
  }

  function reset(key) {
    store.delete(`tb:${key}`)
    store.delete(`sw:${key}`)
  }

  return { tokenBucket, slidingWindow, reset, _store: store }
}

function defaultMemoryStore() {
  const m = new Map()
  return {
    get: (k) => m.get(k),
    set: (k, v) => m.set(k, v),
    delete: (k) => m.delete(k),
  }
}

/**
 * Response helper —— 根据限流结果设置标准 429 响应头。
 * 调用方自己决定是 throw HttpError 还是直接返回。
 */
export function rateLimitHeaders(result) {
  const h = {
    'x-ratelimit-limit': String(result.capacity || result.limit || ''),
    'x-ratelimit-remaining': String(Math.max(0, result.remaining || 0)),
  }
  if (!result.allowed) {
    h['retry-after'] = String(result.retryAfterSec || 1)
  }
  return h
}
