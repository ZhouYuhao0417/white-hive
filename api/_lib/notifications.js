// Notifications · 订单 / 托管 / 纠纷 事件的结构化通知模板（纯逻辑）
//
// 这个模块只负责 "把一个事件变成一份可以发 email / 推送 / 站内信的结构化内容"。
// 真实发送是 api/_lib/email.js / 未来的 push adapter 的事 —— 不在这里。
//
// 用法：
//   const payload = renderNotification({
//     event: 'order.placed',
//     actorRole: 'buyer',
//     order,
//   })
//   // payload = { channel, audience, subject, title, body, cta: { label, href }, severity }
//   await emailAdapter.send(payload.audience, payload)
//
// 设计原则：
//   - 所有模板都集中在这里，方便统一审校文案
//   - 每个事件输出"给谁 / 标题 / 正文 / CTA"，不碰 transport
//   - 渲染函数纯函数, 输入 = (event, context)，输出 = payload

import { HttpError } from './http.js'

export const notificationEvents = Object.freeze([
  'order.placed', // 买家下单成功
  'order.payment_held', // 钱已进托管
  'order.delivered', // 卖家点"已交付"
  'order.buyer_confirmed', // 买家确认收到
  'order.seller_ready', // 卖家标记可放款
  'order.released', // 托管放款（= 订单完成）
  'order.refunded', // 退款
  'order.cancelled', // 订单取消
  'dispute.opened', // 纠纷开启
  'dispute.evidence_submitted',// 有新证据
  'dispute.under_review', // 管理员介入
  'dispute.resolved', // 纠纷裁定完毕
  'message.moderation_flagged',// 消息被审核系统拦截
  'review.received', // 收到一条评价
])

export const notificationChannels = Object.freeze(['email', 'inapp', 'push'])

const severityByEvent = {
  'order.placed': 'info',
  'order.payment_held': 'info',
  'order.delivered': 'info',
  'order.buyer_confirmed': 'success',
  'order.seller_ready': 'info',
  'order.released': 'success',
  'order.refunded': 'warning',
  'order.cancelled': 'warning',
  'dispute.opened': 'warning',
  'dispute.evidence_submitted': 'info',
  'dispute.under_review': 'warning',
  'dispute.resolved': 'success',
  'message.moderation_flagged': 'warning',
  'review.received': 'info',
}

/**
 * 把 "钱分" 转成显示用的 ¥ 字符串。不改原值。
 */
function yuan(cents) {
  if (!Number.isFinite(cents)) return '—'
  return `¥${(cents / 100).toFixed(2)}`
}

function orderLabel(order) {
  if (!order) return '你的订单'
  return order.title ? `「${order.title}」` : `订单 ${order.id || ''}`.trim()
}

function orderHref(order) {
  if (!order?.id) return '/dashboard'
  return `/orders/${order.id}`
}

/**
 * 接收者角色 → 用"你 / 卖家 / 买家"的表达
 */
function roleWord(role) {
  if (role === 'buyer') return '你（买家）'
  if (role === 'seller') return '你（卖家）'
  if (role === 'admin') return '管理员'
  return '你'
}

/**
 * 每个事件的模板函数。
 * 入参 ctx 至少含 { order }, 某些事件需要 { dispute, review, message, amount } 等。
 * 输出基础部分：{ subject, title, body, cta }
 * 其它（channel / audience / severity）由 renderNotification 统一处理。
 */
const templates = {
  'order.placed': ({ order, recipientRole }) => ({
    subject: `订单已创建 · ${orderLabel(order)}`,
    title: `订单已创建`,
    body: `${roleWord(recipientRole)}的订单 ${orderLabel(order)} 已创建。需求已发送给卖家, 等对方确认后即可进入托管付款。`,
    cta: { label: '查看订单', href: orderHref(order) },
  }),

  'order.payment_held': ({ order, amount, recipientRole }) => ({
    subject: `资金已进入托管 · ${orderLabel(order)}`,
    title: `资金已托管`,
    body: `订单 ${orderLabel(order)} 的 ${yuan(amount ?? order?.budgetCents)} 已进入 WhiteHive 托管。${
      recipientRole === 'seller'
        ? '请按约定交付，买卖双方都确认后才会放款到你账上。'
        : '交付完成并双方确认后会自动放款给卖家。'
    }`,
    cta: { label: '打开订单', href: orderHref(order) },
  }),

  'order.delivered': ({ order, recipientRole }) => ({
    subject: `卖家已交付 · ${orderLabel(order)}`,
    title: `卖家已交付`,
    body:
      recipientRole === 'buyer'
        ? `订单 ${orderLabel(order)} 的卖家已标记交付完成, 请进入订单页确认收到, 然后资金才会放款。`
        : `你已对订单 ${orderLabel(order)} 标记交付, 等买家确认。`,
    cta: {
      label: recipientRole === 'buyer' ? '去确认收到' : '查看订单',
      href: orderHref(order),
    },
  }),

  'order.buyer_confirmed': ({ order, recipientRole }) => ({
    subject: `买家已确认收到 · ${orderLabel(order)}`,
    title: `买家已确认交付`,
    body:
      recipientRole === 'seller'
        ? `订单 ${orderLabel(order)} 的买家已确认收到。只要你再标记"可放款", 托管资金就会自动结算到你账上。`
        : `你已确认收到订单 ${orderLabel(order)}。资金将在卖家确认可放款后自动打给对方。`,
    cta: { label: '查看订单', href: orderHref(order) },
  }),

  'order.seller_ready': ({ order, recipientRole }) => ({
    subject: `卖家已确认可放款 · ${orderLabel(order)}`,
    title: `卖家确认可放款`,
    body:
      recipientRole === 'buyer'
        ? `订单 ${orderLabel(order)} 的卖家已确认可放款, 等你确认收到就会自动结算。`
        : `你已标记订单 ${orderLabel(order)} 可放款, 等买家确认后资金会自动结算。`,
    cta: { label: '查看订单', href: orderHref(order) },
  }),

  'order.released': ({ order, amount }) => ({
    subject: `订单已完成 · ${orderLabel(order)}`,
    title: `资金已放款`,
    body: `订单 ${orderLabel(order)} 的 ${yuan(amount ?? order?.budgetCents)} 已从托管中放款。感谢一次靠谱的合作。`,
    cta: { label: '写一条评价', href: orderHref(order) + '#review' },
  }),

  'order.refunded': ({ order, amount }) => ({
    subject: `订单已退款 · ${orderLabel(order)}`,
    title: `订单已退款`,
    body: `订单 ${orderLabel(order)} 的 ${yuan(amount ?? order?.budgetCents)} 已从托管退还买家。详情请进入订单查看。`,
    cta: { label: '查看订单', href: orderHref(order) },
  }),

  'order.cancelled': ({ order }) => ({
    subject: `订单已取消 · ${orderLabel(order)}`,
    title: `订单已取消`,
    body: `订单 ${orderLabel(order)} 已被取消。如果已经进入托管, 资金会退还到买家账户。`,
    cta: { label: '查看订单', href: orderHref(order) },
  }),

  'dispute.opened': ({ order, dispute, recipientRole }) => ({
    subject: `纠纷已开启 · ${orderLabel(order)}`,
    title: `纠纷已开启`,
    body: `订单 ${orderLabel(order)} 出现纠纷 (${dispute?.reason || '未分类'})。${
      recipientRole === 'seller'
        ? '请在 48 小时内提交你的证据 (交付物 / 沟通截图 / 日志)。'
        : recipientRole === 'buyer'
          ? '请在 48 小时内补充你的说明和证据。'
          : '请介入审核。'
    }`,
    cta: { label: '提交证据', href: orderHref(order) + '#dispute' },
  }),

  'dispute.evidence_submitted': ({ order, dispute }) => ({
    subject: `新证据提交 · ${orderLabel(order)}`,
    title: `有新证据`,
    body: `订单 ${orderLabel(order)} 的纠纷 ${dispute?.id || ''} 新增了一条证据, 请查看。`,
    cta: { label: '查看纠纷', href: orderHref(order) + '#dispute' },
  }),

  'dispute.under_review': ({ order, dispute }) => ({
    subject: `管理员介入审查 · ${orderLabel(order)}`,
    title: `管理员介入`,
    body: `订单 ${orderLabel(order)} 的纠纷已进入 under_review 状态, 管理员会在 48 小时内给出结果。期间请勿重复提交证据。`,
    cta: { label: '查看纠纷', href: orderHref(order) + '#dispute' },
  }),

  'dispute.resolved': ({ order, dispute }) => ({
    subject: `纠纷已裁定 · ${orderLabel(order)}`,
    title: `纠纷结果已出`,
    body: `订单 ${orderLabel(order)} 的纠纷已裁定: ${dispute?.resolution?.action || '见详情'}。点击查看完整判定与资金流向。`,
    cta: { label: '查看裁定', href: orderHref(order) + '#dispute' },
  }),

  'message.moderation_flagged': ({ order, message, recipientRole }) => ({
    subject: `你的一条消息被拦截 · ${orderLabel(order)}`,
    title: `消息未通过审核`,
    body: `${roleWord(recipientRole)}在订单 ${orderLabel(order)} 下发送的一条消息触发了平台风控 (${(message?.categories || []).join(' / ') || '合规'}), 未发送给对方。建议改写后重新发送。`,
    cta: { label: '查看消息', href: orderHref(order) + '#messages' },
  }),

  'review.received': ({ order, review, recipientRole }) => ({
    subject: `你收到了一条评价 · ${orderLabel(order)}`,
    title: `${review?.rating || '?'} 星评价`,
    body: `${roleWord(recipientRole)}在订单 ${orderLabel(order)} 下收到了一条 ${review?.rating || '?'} 星评价。${review?.body ? `“${String(review.body).slice(0, 60)}${review.body.length > 60 ? '…' : ''}”` : ''}`,
    cta: { label: '查看评价', href: orderHref(order) + '#review' },
  }),
}

/**
 * 基于事件 + 上下文，渲染一份完整的通知 payload。
 *
 * @param {object} input
 * @param {string} input.event                        必填, 在 notificationEvents 里
 * @param {'email'|'inapp'|'push'} [input.channel]    默认 'inapp'
 * @param {'buyer'|'seller'|'admin'} input.recipientRole
 * @param {string} input.recipientId                  接收方 id（会带进 audience）
 * @param {object} input.context                      事件相关上下文 { order, dispute, review, message, amount }
 * @returns {{ event, channel, audience, severity, subject, title, body, cta }}
 */
export function renderNotification(input = {}) {
  const { event, channel = 'inapp', recipientRole, recipientId, context = {} } = input
  if (!notificationEvents.includes(event)) {
    throw new HttpError(400, 'invalid_notification_event', `未知事件: ${event}`)
  }
  if (!notificationChannels.includes(channel)) {
    throw new HttpError(400, 'invalid_notification_channel', `未知通道: ${channel}`)
  }
  if (!recipientRole) {
    throw new HttpError(400, 'invalid_notification_recipient', 'recipientRole 必填。')
  }

  const tmpl = templates[event]({ ...context, recipientRole })
  return {
    event,
    channel,
    audience: {
      role: recipientRole,
      id: recipientId || null,
    },
    severity: severityByEvent[event] || 'info',
    subject: tmpl.subject,
    title: tmpl.title,
    body: tmpl.body,
    cta: tmpl.cta || null,
    createdAt: input.now || new Date().toISOString(),
  }
}

/**
 * Fan-out 辅助：一个事件常同时要通知 buyer + seller（或加上 admin）。
 *
 *   renderNotificationBatch({
 *     event: 'order.released',
 *     recipients: [{ role: 'buyer', id: 'usr_1' }, { role: 'seller', id: 'usr_2' }],
 *     context: { order },
 *   })
 *
 * 返回 payload 数组（每人一份）。
 */
export function renderNotificationBatch({ event, channel, recipients, context, now }) {
  if (!Array.isArray(recipients) || recipients.length === 0) return []
  return recipients.map((r) =>
    renderNotification({
      event,
      channel,
      recipientRole: r.role,
      recipientId: r.id,
      context,
      now,
    }),
  )
}
