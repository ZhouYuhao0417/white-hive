// Idempotency · 用客户端传入的 Idempotency-Key 防止重复下单 / 重复支付
//
// 语义（参考 Stripe）：
//   - 客户端为"易重发"请求生成一个 UUID 作为 Idempotency-Key header
//   - 同一 key 在 TTL 内二次命中, 直接返回首次的结果, 不再执行真实操作
//   - 同一 key 命中但正在执行（并发重试）, 返回 inFlight，调用方可选择短暂等待或拒绝
//
// 不依赖数据库；默认 in-memory Map + TTL。可注入 store 切到 KV。

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h
const MAX_KEY_LEN = 128
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_\-:.]{8,128}$/

/**
 * 基本的 key 格式校验 —— 太短 / 含空格 / 含奇怪字符都拒绝。
 */
export function validateKey(key) {
  if (typeof key !== 'string') return { ok: false, reason: 'not_string' }
  if (key.length > MAX_KEY_LEN) return { ok: false, reason: 'too_long' }
  if (!IDEMPOTENCY_KEY_RE.test(key)) return { ok: false, reason: 'bad_format' }
  return { ok: true }
}

export function createIdempotencyCache(opts = {}) {
  const ttlMs = opts.ttlMs || DEFAULT_TTL_MS
  const store = opts.store || new Map()
  // Wrapper, so store can be Map or custom {get,set,delete}
  const api = {
    get(k) {
      return typeof store.get === 'function' ? store.get(k) : store[k]
    },
    set(k, v) {
      if (typeof store.set === 'function') store.set(k, v)
      else store[k] = v
    },
    delete(k) {
      if (typeof store.delete === 'function') store.delete(k)
      else delete store[k]
    },
  }

  function now(o) {
    return o?.now ?? Date.now()
  }

  /**
   * 检查 key 当前状态。
   *   { state: 'fresh' }         —— 没用过，调用方可以开始执行
   *   { state: 'in_flight' }     —— 正在执行
   *   { state: 'completed', result } —— 已完成，可直接返回上次结果
   *   { state: 'expired' }       —— 过期，当作 fresh
   */
  function inspect(key, opts) {
    const v = api.get(key)
    if (!v) return { state: 'fresh' }
    const t = now(opts)
    if (v.expiresAt && v.expiresAt <= t) {
      api.delete(key)
      return { state: 'expired' }
    }
    if (v.state === 'in_flight') return { state: 'in_flight', startedAt: v.startedAt }
    if (v.state === 'completed') return { state: 'completed', result: v.result, completedAt: v.completedAt }
    return { state: 'fresh' }
  }

  /**
   * 原子性地"开始"一个 key：如果是 fresh / expired 就占位为 in_flight 并返回 true；
   * 否则返回 false + 当前 state。
   */
  function begin(key, opts) {
    const check = inspect(key, opts)
    if (check.state === 'fresh' || check.state === 'expired') {
      const t = now(opts)
      api.set(key, {
        state: 'in_flight',
        startedAt: t,
        expiresAt: t + ttlMs,
      })
      return { started: true }
    }
    return { started: false, existing: check }
  }

  /**
   * 成功完成：把 result 记下, 之后 TTL 内的相同 key 直接返回。
   */
  function complete(key, result, opts) {
    const t = now(opts)
    api.set(key, {
      state: 'completed',
      result,
      completedAt: t,
      expiresAt: t + ttlMs,
    })
  }

  /**
   * 执行失败：释放 key，让客户端可以重试（不缓存错误）。
   */
  function fail(key) {
    api.delete(key)
  }

  /**
   * 全量清空 —— 测试用。
   */
  function clear() {
    if (typeof store.clear === 'function') store.clear()
  }

  return { inspect, begin, complete, fail, clear, _store: store }
}

/**
 * 标准 wrap-around helper —— 把 handler 包一层，自动处理 begin/complete/fail。
 *
 *   const wrapped = wrapIdempotent(cache, {
 *     key: 'user:usr_1:create_order:7c54…',
 *     handler: async () => await doExpensiveWork(),
 *   })
 *
 * 返回 { result, replayed: boolean, state }。
 */
export async function runIdempotent(cache, { key, handler, now }) {
  const begin = cache.begin(key, { now })
  if (!begin.started) {
    const existing = begin.existing
    if (existing.state === 'completed') {
      return { result: existing.result, replayed: true, state: 'completed' }
    }
    return { result: null, replayed: true, state: existing.state }
  }
  try {
    const result = await handler()
    cache.complete(key, result, { now })
    return { result, replayed: false, state: 'completed' }
  } catch (err) {
    cache.fail(key)
    throw err
  }
}
