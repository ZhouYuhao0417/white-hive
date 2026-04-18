// Deadline · 订单 / 纠纷 / SLA 相关的时间计算（纯函数）
//
// 所有函数都接受 now (ms 或 ISO) 作为最后一个参数, 方便测试。
// 时区: 内部全部用 UTC millis, 不考虑本地时区——前端展示时再 toLocaleString。

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

function toMs(value) {
  if (value == null) return Date.now()
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  const t = Date.parse(value)
  if (Number.isNaN(t)) throw new TypeError(`invalid date: ${value}`)
  return t
}

function toIso(ms) {
  return new Date(ms).toISOString()
}

/**
 * 订单截止时间 = createdAt + deliveryDays 天。
 * 返回 ISO 字符串; 缺数据时返回 null, 不抛。
 */
export function orderDeadline({ createdAt, deliveryDays, startedAt }) {
  if (!Number.isFinite(deliveryDays) || deliveryDays < 0) return null
  const base = startedAt || createdAt
  if (!base) return null
  return toIso(toMs(base) + deliveryDays * DAY_MS)
}

/**
 * 距离截止还剩多少毫秒 / 天。负数表示已超时。
 *   { ms, days, overdue }
 */
export function timeUntil(deadlineIso, now) {
  if (!deadlineIso) return { ms: null, days: null, overdue: false }
  const delta = toMs(deadlineIso) - toMs(now)
  return {
    ms: delta,
    days: Math.round((delta / DAY_MS) * 10) / 10, // 1 位小数
    overdue: delta < 0,
  }
}

export function isOverdue(deadlineIso, now) {
  if (!deadlineIso) return false
  return toMs(deadlineIso) < toMs(now)
}

/**
 * 给 SLA 计时。from 起 +hours 小时的绝对截止。
 * 主要给 dispute.evidence / under_review 用。
 */
export function slaDeadline({ fromIso, hours }) {
  if (!Number.isFinite(hours) || hours < 0) return null
  const base = fromIso ? toMs(fromIso) : Date.now()
  return toIso(base + hours * HOUR_MS)
}

/**
 * 托管自动放款时间 —— 卖家标记交付后, N 小时内买家不确认就自动 release。
 * 默认 7 天 (168h)。
 */
export function autoReleaseAt({ deliveredAt, hours = 168 }) {
  if (!deliveredAt) return null
  return toIso(toMs(deliveredAt) + hours * HOUR_MS)
}

/**
 * 评价编辑窗口 —— 评价创建后 N 小时内可改, 默认 48h。
 */
export function reviewEditDeadline({ createdAt, hours = 48 }) {
  if (!createdAt) return null
  return toIso(toMs(createdAt) + hours * HOUR_MS)
}

/**
 * 根据订单状态 + 时间戳, 给出 "下一步 SLA 关注点"。
 *   返回 { kind, deadline, hoursRemaining, overdue } 或 null
 *
 * 用途: Dashboard 上的 "还有 12 小时自动放款" / "已超时 3 小时, 可申请裁定"。
 */
export function nextSlaMilestone(order, now) {
  if (!order?.status) return null
  const t = toMs(now)
  if (order.status === 'delivered' && order.deliveredAt) {
    const deadline = autoReleaseAt({ deliveredAt: order.deliveredAt })
    const u = timeUntil(deadline, t)
    return {
      kind: 'auto_release',
      deadline,
      hoursRemaining: u.ms != null ? u.ms / HOUR_MS : null,
      overdue: u.overdue,
    }
  }
  if (
    (order.status === 'accepted' || order.status === 'in_progress') &&
    order.createdAt &&
    Number.isFinite(order.deliveryDays)
  ) {
    const deadline = orderDeadline(order)
    const u = timeUntil(deadline, t)
    return {
      kind: 'delivery_due',
      deadline,
      hoursRemaining: u.ms != null ? u.ms / HOUR_MS : null,
      overdue: u.overdue,
    }
  }
  return null
}

/**
 * 从 cursor (ISO) 取"过去 24h / 7d" 这种窗口的起始点。给 analytics 用。
 */
export function windowStart({ kind = 'day', now } = {}) {
  const t = toMs(now)
  const map = { hour: HOUR_MS, day: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS }
  const span = map[kind]
  if (!span) throw new RangeError(`unknown window kind: ${kind}`)
  return toIso(t - span)
}

/**
 * 给人看的相对时间 "3 分钟前 / 2 小时前 / 昨天 / 3 天前"。
 * 不依赖 Intl, 避免 Node 环境差异。
 */
export function humanizeRelative(iso, now) {
  if (!iso) return ''
  const delta = toMs(now) - toMs(iso)
  if (delta < 0) return '即将'
  if (delta < 60_000) return '刚刚'
  if (delta < HOUR_MS) return `${Math.floor(delta / 60_000)} 分钟前`
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)} 小时前`
  if (delta < 2 * DAY_MS) return '昨天'
  if (delta < 30 * DAY_MS) return `${Math.floor(delta / DAY_MS)} 天前`
  return new Date(toMs(iso)).toISOString().slice(0, 10)
}
