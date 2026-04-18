// Payment cascade · 订单状态变化时的连带托管动作（纯 orchestration）
//
// 不访问 store, 不抛额外的自定义错误 —— 只是把 "order 转到新状态" 翻译成
// "escrow 应该做什么 action" 的映射。Codex 的 updateOrder() 拿到 next order +
// next payment 之后再一起写库。
//
// 用法:
//   const { paymentPatch, skipped, reason } = cascadeOnOrderTransition({
//     fromStatus: 'delivered',
//     toStatus: 'completed',
//     actorRole: 'buyer',
//     payment,     // 当前 payment 对象 (含 escrowStatus 等)
//   })
//   if (paymentPatch) await store.updatePayment(payment.id, paymentPatch)

import { applyAction, canRelease } from './escrow.js'

/**
 * 订单状态变化 → 托管该做什么。
 *
 * 规则:
 *   completed :
 *     - 若 payment 还在 held 且双方都确认过 → 啥都不用做 (escrow 已经在自动放款那一步)
 *     - 若还在 held 但少一方 → force_release (buyer 确认完成即隐含放行)
 *     - 若已经 released → skipped
 *   cancelled :
 *     - 若 payment 在 held → force_refund
 *     - 若还没付款 (none) → skipped
 *     - 若已经 released → 不能再改, 返回 { skipped, reason: 'already_released' }
 *   disputed / accepted / in_progress / delivered / submitted → 不连带
 *
 * 返回:
 *   { paymentPatch: 新 payment 对象 | null, action: 执行的 escrow 动作 | null,
 *     released, refunded, skipped, reason }
 */
export function cascadeOnOrderTransition({
  fromStatus,
  toStatus,
  actorRole = 'system',
  payment,
  now,
}) {
  const empty = { paymentPatch: null, action: null, released: false, refunded: false, skipped: true, reason: 'no_cascade' }

  if (!payment) {
    return { ...empty, reason: 'no_payment' }
  }

  const escrowStatus = payment.escrowStatus || 'none'

  if (toStatus === 'completed') {
    if (escrowStatus === 'released') {
      return { ...empty, reason: 'already_released' }
    }
    if (escrowStatus !== 'held') {
      return { ...empty, reason: 'escrow_not_held' }
    }
    // 买家确认完成 == 同时当作 buyer_confirmed 处理, 然后 force_release。
    // 这里直接 force_release, 把理由归给 actorRole (buyer 确认 → 放款)。
    const action = 'force_release'
    const effectiveActor = actorRole === 'admin' ? 'admin' : 'admin' // force_* 只允许 admin, 但这是连带放款, 由系统以 admin 身份触发
    const { payment: next, released } = applyAction(payment, {
      action,
      actorRole: effectiveActor,
      now,
    })
    return {
      paymentPatch: next,
      action,
      released,
      refunded: false,
      skipped: false,
      reason: 'order_completed',
    }
  }

  if (toStatus === 'cancelled') {
    if (escrowStatus === 'none') {
      return { ...empty, reason: 'escrow_not_funded' }
    }
    if (escrowStatus === 'released') {
      return { ...empty, reason: 'already_released' }
    }
    if (escrowStatus === 'refunded') {
      return { ...empty, reason: 'already_refunded' }
    }
    const action = 'force_refund'
    const { payment: next, refunded } = applyAction(payment, {
      action,
      actorRole: 'admin',
      now,
    })
    return {
      paymentPatch: next,
      action,
      released: false,
      refunded,
      skipped: false,
      reason: 'order_cancelled',
    }
  }

  // 其他 target 不连带
  return empty
}

/**
 * 便捷布尔: 给一个订单 + 它的 payment, 能否立刻把订单推到 completed。
 * 前提: 订单处于 delivered, 且 escrow 的双方都确认过。
 */
export function canAutoComplete(order, payment) {
  if (!order || !payment) return false
  if (order.status !== 'delivered') return false
  return canRelease(payment)
}
