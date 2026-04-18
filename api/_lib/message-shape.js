// Message shape · 订单消息的对外投影 + 敏感信息处理
//
// 纯逻辑, 不 call LLM, 也不写库。
// 三件事：
//   1) publicMessageShape(msg, viewerRole) —— 给 API 响应剥掉内部字段
//   2) redactSensitive(body) —— 把疑似手机号 / 身份证 / 银行卡替换成 ***
//   3) threadKey(order) + groupByThread(messages) —— UI 按 (orderId+参与者) 分组
//
// 需要"真·内容审核"请用 ai-moderation.js, 这里只是把人类眼睛能一眼看出的东西遮住。

const PHONE_RE = /1[3-9]\d{9}/g
const ID_CARD_RE = /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g
const BANK_CARD_RE = /\b\d{13,19}\b/g
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g

/**
 * 对一段文本做保守遮罩 —— 命中的数字 / 邮箱转为 *** 占位。
 *
 *   redactSensitive('联系 13812345678 或 ab@x.com')
 *   → '联系 ***-****-*678 或 ***@***'
 *
 * 注意: 只做展示层遮罩, 不是审核放行条件; 真正的拦截判断交给 ai-moderation。
 */
export function redactSensitive(body) {
  if (body == null) return ''
  let s = String(body)
  s = s.replace(PHONE_RE, (m) => `***-****-*${m.slice(-3)}`)
  s = s.replace(ID_CARD_RE, (m) => `${m.slice(0, 4)}***********${m.slice(-2)}`)
  s = s.replace(BANK_CARD_RE, (m) =>
    m.length >= 13 ? `${m.slice(0, 4)}****${m.slice(-4)}` : m,
  )
  s = s.replace(EMAIL_RE, () => '***@***')
  return s
}

/**
 * 返回一个稳定的线程 key, 给前端做消息分组。
 * 不做密码学用途, 只是 "orderId:seller:buyer" 的字符串。
 */
export function threadKey(order) {
  if (!order?.id) return ''
  const a = order.buyerId || 'anon'
  const b = order.sellerId || 'anon'
  const [x, y] = [a, b].sort()
  return `thr:${order.id}:${x}:${y}`
}

/**
 * 按 orderId 分桶, 每桶按 createdAt 升序。
 *   返回 Map<orderId, messages[]>。
 */
export function groupByOrder(messages) {
  const m = new Map()
  for (const msg of messages || []) {
    const id = msg?.orderId
    if (!id) continue
    if (!m.has(id)) m.set(id, [])
    m.get(id).push(msg)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  }
  return m
}

/**
 * 一条消息的"对外公开投影"。viewerRole 决定是否看得到内部字段 (e.g. adminNotes)。
 */
export function publicMessageShape(msg, viewerRole = 'buyer') {
  if (!msg) return null
  const shape = {
    id: msg.id,
    orderId: msg.orderId,
    senderRole: msg.senderRole, // buyer | seller | system | admin
    senderId: msg.senderId,
    body: msg.body || '',
    bodyRedacted: redactSensitive(msg.body),
    attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
    createdAt: msg.createdAt,
    edited: !!msg.editedAt,
    flagged: !!msg.flagged,
    moderation: msg.moderation
      ? {
          allow: msg.moderation.allow,
          severity: msg.moderation.severity,
          categories: msg.moderation.categories || [],
        }
      : null,
  }
  if (viewerRole === 'admin') {
    shape.adminNotes = msg.adminNotes || null
    shape.rawModeration = msg.moderation || null
  }
  return shape
}

/**
 * 一个订单的消息时间线, 给 UI 画 chat bubble。
 * opts: { viewerRole, hideFlagged, limit }
 */
export function buildMessageTimeline(messages, opts = {}) {
  const viewerRole = opts.viewerRole || 'buyer'
  const hideFlagged = !!opts.hideFlagged
  const limit = Number.isFinite(opts.limit) ? Math.max(0, opts.limit) : null
  let list = (messages || []).map((m) => publicMessageShape(m, viewerRole))
  if (hideFlagged) list = list.filter((m) => !m.flagged)
  list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  if (limit != null) list = list.slice(-limit)
  return list
}

/**
 * 给订单详情页的"最后一条消息"预览 —— 截 60 字, 遮敏感。
 */
export function lastMessagePreview(messages, { length = 60 } = {}) {
  if (!messages || messages.length === 0) return null
  const last = messages[messages.length - 1]
  const redacted = redactSensitive(last.body || '')
  const text = redacted.length > length ? redacted.slice(0, length) + '…' : redacted
  return {
    senderRole: last.senderRole || null,
    text,
    at: last.createdAt,
  }
}
