// Escrow · 资金托管（双方确认后放款）
//
// 纯逻辑模块 —— 不碰任何 store，只负责：
//   1) 定义 escrow 状态机（none → held → buyer_confirmed / seller_ready → released / refunded）
//   2) 给出"是否可以放款"的判断（必须买卖双方都确认）
//   3) 计算下一个 escrow 状态（给 store 调用时一个干净的 reducer）
//
// 设计原则：
//   - 不抛任意错误：非法转移抛 HttpError(409) 或 HttpError(400)
//   - 不直接写数据库：调用方（memory-store / postgres-store）负责持久化
//   - 幂等：重复 confirm 不会把已确认的再次标记
//
// 状态流：
//
//    none ──(createPayment)──▶ held
//                                │
//        buyer markDelivered ────┤
//        seller markReady   ────┤
//                                ▼
//                     held (已记录某方确认)
//                                │
//            买卖双方都已确认 ────┤
//                                ▼
//                             released
//
//    held ──(refund by admin / dispute resolution)──▶ refunded
//
// 额外动作：
//   - buyer 可以"只确认交付"（confirm_delivery）
//   - seller 可以"标记可以放款"（ready_for_release）
//   - admin 强制放款 / 强制退款（force_release / force_refund）用于纠纷裁决
//
// 需要 memory-store.js 在 payment 对象上持久化的新字段：
//   buyerConfirmedAt:  ISO | null
//   sellerReadyAt:     ISO | null
//   releaseRequestedBy:'buyer'|'seller'|'admin' | null   （触发最后一步的人）
//   releasedAt:        ISO | null
//   refundedAt:        ISO | null

import { HttpError } from './http.js'

/**
 * 所有允许的 escrow 状态
 */
export const escrowStatuses = Object.freeze([
  'none', // 尚未付款
  'held', // 已托管，等待双方确认
  'released', // 已放款给卖家
  'refunded', // 已退款给买家
])

/**
 * 双方可以触发的动作
 */
export const escrowActions = Object.freeze([
  'confirm_delivery', // 买家：我确认收到交付
  'ready_for_release', // 卖家：我这边交付完可以结款
  'cancel_confirmation', // 买家/卖家：撤回我的确认（仅在 held 状态、未 released 时可用）
  'force_release', // admin：强制放款（用于纠纷裁决）
  'force_refund', // admin：强制退款（用于纠纷裁决）
])

/**
 * 允许的角色
 */
const allowedRoles = new Set(['buyer', 'seller', 'admin'])

/**
 * 判断某个 action 在当前 state + 角色下是否合法。
 * 不合法时返回字符串原因（方便测试），合法返回 null。
 */
export function validateAction({ escrowStatus, action, actorRole }) {
  if (!allowedRoles.has(actorRole)) return 'invalid_actor_role'
  if (!escrowActions.includes(action)) return 'invalid_action'
  if (!escrowStatuses.includes(escrowStatus)) return 'invalid_escrow_status'

  // 未付款的订单谁也动不了
  if (escrowStatus === 'none') return 'escrow_not_funded'

  // 终局状态不可再动
  if (escrowStatus === 'released' || escrowStatus === 'refunded') {
    return 'escrow_terminal'
  }

  switch (action) {
    case 'confirm_delivery':
      if (actorRole !== 'buyer') return 'only_buyer_can_confirm_delivery'
      return null
    case 'ready_for_release':
      if (actorRole !== 'seller') return 'only_seller_can_mark_ready'
      return null
    case 'cancel_confirmation':
      if (actorRole !== 'buyer' && actorRole !== 'seller') {
        return 'only_participants_can_cancel'
      }
      return null
    case 'force_release':
    case 'force_refund':
      if (actorRole !== 'admin') return 'only_admin_can_force'
      return null
    default:
      return 'unknown_action'
  }
}

export function assertAction(args) {
  const reason = validateAction(args)
  if (reason) {
    throw new HttpError(409, 'escrow_action_rejected', escrowReasonMessage(reason), {
      reason,
    })
  }
}

function escrowReasonMessage(reason) {
  const map = {
    invalid_actor_role: '非法角色。',
    invalid_action: '未知的托管动作。',
    invalid_escrow_status: '未知的托管状态。',
    escrow_not_funded: '订单还未完成托管付款。',
    escrow_terminal: '托管已结束，不能再操作。',
    only_buyer_can_confirm_delivery: '只有买家可以确认收到交付。',
    only_seller_can_mark_ready: '只有卖家可以标记可以放款。',
    only_participants_can_cancel: '只有买卖双方可以撤回自己的确认。',
    only_admin_can_force: '只有管理员可以强制放款或退款。',
  }
  return map[reason] || '非法的托管操作。'
}

/**
 * 基于当前 payment snapshot + 一个 action，计算下一个 snapshot。
 * 不修改入参，返回一个新对象。
 *
 * @param {{ escrowStatus, buyerConfirmedAt, sellerReadyAt, releasedAt, refundedAt }} payment
 * @param {{ action, actorRole, actorId, now?: string }} event
 * @returns {{
 *   payment: object,
 *   released: boolean,      // 本次是否触发了"放款"
 *   refunded: boolean,      // 本次是否触发了"退款"
 *   dualConfirmed: boolean, // 本次之后是否买卖都已确认
 * }}
 */
export function applyAction(payment, event) {
  assertAction({
    escrowStatus: payment?.escrowStatus,
    action: event?.action,
    actorRole: event?.actorRole,
  })

  const now = event?.now || new Date().toISOString()
  const next = { ...payment }
  let released = false
  let refunded = false

  switch (event.action) {
    case 'confirm_delivery':
      // 幂等：已经标记过不重复
      if (!next.buyerConfirmedAt) next.buyerConfirmedAt = now
      break
    case 'ready_for_release':
      if (!next.sellerReadyAt) next.sellerReadyAt = now
      break
    case 'cancel_confirmation':
      if (event.actorRole === 'buyer') next.buyerConfirmedAt = null
      if (event.actorRole === 'seller') next.sellerReadyAt = null
      break
    case 'force_release':
      next.escrowStatus = 'released'
      next.releasedAt = now
      next.releaseRequestedBy = 'admin'
      released = true
      break
    case 'force_refund':
      next.escrowStatus = 'refunded'
      next.refundedAt = now
      next.releaseRequestedBy = 'admin'
      refunded = true
      break
  }

  const dualConfirmed = Boolean(next.buyerConfirmedAt && next.sellerReadyAt)

  // 双方都确认 → 自动转为 released
  if (
    dualConfirmed &&
    next.escrowStatus === 'held' &&
    event.action !== 'force_refund'
  ) {
    next.escrowStatus = 'released'
    next.releasedAt = now
    // release 触发者 = 最后一个确认的人
    if (!next.releaseRequestedBy) {
      next.releaseRequestedBy = event.actorRole
    }
    released = true
  }

  return { payment: next, released, refunded, dualConfirmed }
}

/**
 * 给前端 / API 返回用的公共投影 —— 不暴露内部字段。
 */
export function publicEscrowShape(payment) {
  if (!payment) return null
  return {
    escrowStatus: payment.escrowStatus || 'none',
    buyerConfirmedAt: payment.buyerConfirmedAt || null,
    sellerReadyAt: payment.sellerReadyAt || null,
    releasedAt: payment.releasedAt || null,
    refundedAt: payment.refundedAt || null,
    releaseRequestedBy: payment.releaseRequestedBy || null,
    dualConfirmed: Boolean(payment.buyerConfirmedAt && payment.sellerReadyAt),
  }
}

/**
 * "是不是可以直接放款了" —— 给 UI 按钮 disabled 状态用。
 */
export function canRelease(payment) {
  if (!payment) return false
  if (payment.escrowStatus !== 'held') return false
  return Boolean(payment.buyerConfirmedAt && payment.sellerReadyAt)
}
