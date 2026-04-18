// Order state machine · 订单状态流转（纯逻辑）
//
// 和 dispute.js 同构：这里只做 "from→to 是否合法 / 谁能做 / 下一个状态长什么样",
// 不碰 store, 不读取数据库。Codex 的 updateOrder() 调 validate → apply 拿到下一版订单。
//
// 状态流:
//
//   submitted   —— 买家刚下单，等卖家接
//   accepted    —— 卖家已接, 可以开工
//   in_progress —— 双方确认已开始（可选中间态）
//   delivered   —— 卖家标记交付, 等买家验收
//   completed   —— 买家确认 / 系统自动放款, 订单终结
//   cancelled   —— 订单被取消（卖家拒接 / 买家撤单 / 双方同意）
//   disputed    —— 进入 dispute.js 的流程（钱冻在托管里）
//
// 允许转移矩阵 见 transitions。
// 终态: completed / cancelled / disputed 的后续归 dispute.js / escrow.js 管。

import { HttpError } from './http.js'

export const orderStatuses = Object.freeze([
  'submitted',
  'accepted',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
])

// Key = from, value = { toStatus: [allowedActorRoles] }
// actorRole ∈ 'buyer' | 'seller' | 'admin' | 'system'
// 'system' 表示由定时任务 / 托管触发, 例如 48h 自动确认
const transitions = {
  submitted: {
    accepted: ['seller', 'admin'],
    cancelled: ['buyer', 'seller', 'admin'], // 双方都可以在卖家还没接的时候撤
  },
  accepted: {
    in_progress: ['seller', 'admin'],
    delivered: ['seller', 'admin'], // 小单可以跳过 in_progress
    cancelled: ['buyer', 'seller', 'admin'],
    disputed: ['buyer', 'seller', 'admin'],
  },
  in_progress: {
    delivered: ['seller', 'admin'],
    cancelled: ['buyer', 'seller', 'admin'],
    disputed: ['buyer', 'seller', 'admin'],
  },
  delivered: {
    completed: ['buyer', 'admin', 'system'], // system = 48h 自动确认
    in_progress: ['seller', 'admin'], // 卖家发现交付有问题, 回到开工
    disputed: ['buyer', 'admin'],
  },
  completed: {},
  cancelled: {},
  disputed: {
    // dispute resolution 会把订单推回 completed / cancelled
    completed: ['admin'],
    cancelled: ['admin'],
  },
}

export const orderActorRoles = Object.freeze(['buyer', 'seller', 'admin', 'system'])

/**
 * 快速判断状态是否为终态 (订单生命周期已结束)。
 */
export function isTerminalOrderStatus(status) {
  return status === 'completed' || status === 'cancelled'
}

/**
 * from → to 是否合法。
 * 返回 { ok, reason? }。不抛错，方便 UI 禁用按钮。
 */
export function canTransition(fromStatus, toStatus, actorRole) {
  if (!orderStatuses.includes(fromStatus)) {
    return { ok: false, reason: 'unknown_from_status' }
  }
  if (!orderStatuses.includes(toStatus)) {
    return { ok: false, reason: 'unknown_to_status' }
  }
  if (!orderActorRoles.includes(actorRole)) {
    return { ok: false, reason: 'unknown_actor_role' }
  }
  if (fromStatus === toStatus) {
    return { ok: false, reason: 'same_status' }
  }
  const allowed = transitions[fromStatus] || {}
  if (Object.keys(allowed).length === 0) {
    return { ok: false, reason: 'terminal_status' }
  }
  const actors = allowed[toStatus]
  if (!actors) {
    return { ok: false, reason: 'illegal_transition' }
  }
  if (!actors.includes(actorRole)) {
    return { ok: false, reason: 'actor_not_allowed' }
  }
  return { ok: true }
}

/**
 * 强校验版 canTransition, 非法时抛 HttpError(409)。
 */
export function assertTransition(fromStatus, toStatus, actorRole) {
  const r = canTransition(fromStatus, toStatus, actorRole)
  if (!r.ok) {
    throw new HttpError(
      409,
      'order_transition_rejected',
      `订单状态从 ${fromStatus} 到 ${toStatus} 不允许 (${actorRole})。`,
      { reason: r.reason, from: fromStatus, to: toStatus, actorRole },
    )
  }
}

/**
 * 应用一次状态变更, 返回新订单对象 (不改原对象)。
 * opts: { now }
 */
export function applyTransition(order, { toStatus, actorRole, actorId, note, now }) {
  if (!order || typeof order !== 'object') {
    throw new HttpError(400, 'order_required', '缺少订单对象。')
  }
  const from = order.status
  assertTransition(from, toStatus, actorRole)
  const ts = now || new Date().toISOString()
  const history = Array.isArray(order.statusHistory) ? order.statusHistory.slice() : []
  history.push({
    from,
    to: toStatus,
    actorRole,
    actorId: actorId || null,
    note: note ? String(note).slice(0, 400) : null,
    at: ts,
  })
  const next = {
    ...order,
    status: toStatus,
    statusHistory: history,
    updatedAt: ts,
  }
  // 便捷时间戳 —— 方便前端 / 报表不用扫 history
  if (toStatus === 'accepted') next.acceptedAt = next.acceptedAt || ts
  if (toStatus === 'in_progress') next.startedAt = next.startedAt || ts
  if (toStatus === 'delivered') next.deliveredAt = next.deliveredAt || ts
  if (toStatus === 'completed') next.completedAt = next.completedAt || ts
  if (toStatus === 'cancelled') next.cancelledAt = next.cancelledAt || ts
  if (toStatus === 'disputed') next.disputedAt = next.disputedAt || ts
  return next
}

/**
 * 给定当前订单 + 请求者角色, 列出 UI 可以展示的按钮（合法 next state 列表）。
 */
export function availableActions(order, actorRole) {
  if (!order?.status) return []
  const allowed = transitions[order.status] || {}
  return Object.entries(allowed)
    .filter(([, actors]) => actors.includes(actorRole))
    .map(([to]) => to)
}

/**
 * 给一个订单算"进度百分比" (给 UI 画进度条)。纯展示用。
 */
export function orderProgressPercent(status) {
  const map = {
    submitted: 10,
    accepted: 30,
    in_progress: 55,
    delivered: 80,
    completed: 100,
    cancelled: 100,
    disputed: 75,
  }
  return map[status] ?? 0
}
