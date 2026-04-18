# Handoff to Codex — 后端协作边界

> 给并行开发的另一个 AI (Codex) 的上下文简报。目标是**不冲突、不重复、不等待**。
> Claude 负责 pure-logic / reducer / shape / validate 层；Codex 负责 router /
> store / transport / infra 层。两侧通过 `api/_lib/*.js` 的 ESM import 交换。

## 一、文件所有权（HARD 边界）

### Codex 的文件 — Claude **绝对不改**

| 文件                           | 原因                          |
| ------------------------------ | ----------------------------- |
| `api/index.js`                 | 路由 / handler 编排层          |
| `api/_lib/email.js`            | 发件 transport                 |
| `api/_lib/memory-store.js`     | 开发期数据层                   |
| `api/_lib/postgres-store.js`   | 生产数据层                     |
| `api/_lib/blob.js`             | 文件上传 transport             |
| `api/_lib/auth.js`             | session / provider            |
| `api/_lib/seed.js`             | 种子数据                       |
| `api/_lib/store.js`            | store 门面 (决定用哪个实现)    |
| `db/schema.sql`                | 数据库建表                    |
| `package.json` / lockfile      | 依赖清单                      |

### Claude 的文件 — Codex **绝对不改**

| 文件                                   | 职责                                    |
| -------------------------------------- | --------------------------------------- |
| `api/_lib/http.js`                     | `HttpError` / `ok` / `fail` / `withApiErrors` |
| `api/_lib/validate.js`                 | 通用字段校验器                          |
| `api/_lib/pagination.js`               | `parsePagination` / `paginate`          |
| `api/_lib/search.js`                   | `tokenize` / `scoreMatch` / `applyFilters` |
| `api/_lib/ids.js`                      | ID 前缀生成                            |
| `api/_lib/deepseek.js`                 | DeepSeek client                        |
| `api/_lib/matcher.js`                  | 匹配两段式管线                         |
| `api/_lib/ai-brief.js` / `ai-price.js` / `ai-listing.js` / `ai-dispute.js` / `ai-moderation.js` | LLM 特化 |
| `api/_lib/dispute.js`                  | 纠纷状态机                              |
| `api/_lib/escrow.js`                   | 双确认托管状态机                       |
| `api/_lib/order-machine.js`            | 订单状态机                              |
| `api/_lib/deadline.js`                 | SLA / 截止时间计算                     |
| `api/_lib/message-shape.js`            | 消息投影 + 敏感遮罩                    |
| `api/_lib/profile-shape.js`            | 用户投影 + 信任分 + 徽章               |
| `api/_lib/payment-cascade.js`          | 订单 → 托管的连带动作                  |
| `api/_lib/webhook-signature.js`        | HMAC 签名 / 验签                        |
| `api/_lib/notifications.js`            | 事件 → 通知 payload                     |
| `api/_lib/reviews.js`                  | 评价纯逻辑                              |
| `api/_lib/rate-limit.js`               | tokenBucket / slidingWindow             |
| `api/_lib/idempotency.js`              | Idempotency-Key 状态机                  |
| `tests/*.test.js`                      | 这些模块对应的测试                     |
| `docs/ai-backend.md` / 本文件           | 纯逻辑文档                             |

### 共享文件 — 需要改的一方**先发 PR 再动**

- `docs/api-contract.md`（API 契约 —— 改接口 shape 必须两边对齐）
- `docs/backend-mvp.md`（功能 roadmap）
- `README.md`（部署 / 命令）

## 二、调用方向

```
┌─────────────────────────────┐
│  api/index.js  (Codex)      │ ← HTTP 请求进这里
│                             │
│  import {...} from './_lib/ │
│    order-machine.js         │ ← pure logic
│    escrow.js                │ ← pure logic
│    payment-cascade.js       │ ← pure logic
│    rate-limit.js            │ ← pure logic
│    idempotency.js           │ ← pure logic
│    notifications.js         │ ← pure logic
│  │
│  import {...} from './_lib/ │
│    memory-store.js          │ ← Codex 的 transport
│    email.js                 │ ← Codex 的 transport
└─────────────────────────────┘
         ↑               ↑
         └─ Claude 输出 ─┘
```

**单向依赖规则**：pure-logic 层**不准** import Codex 的 transport 层。
- `order-machine.js` ❌ import `memory-store.js`
- `notifications.js` ❌ import `email.js`
- `api/index.js` ✅ import 两边都可以

## 三、现成可用的钩子（Codex 现在能 `import` 的）

### 订单流转
```js
import { canTransition, applyTransition, availableActions } from './_lib/order-machine.js'
import { cascadeOnOrderTransition } from './_lib/payment-cascade.js'

// PATCH /api/orders/:id
const next = applyTransition(order, { toStatus: 'accepted', actorRole: 'seller', actorId, now })
await store.updateOrder(order.id, next)

// 如果是 completed / cancelled, 顺带处理托管
const { paymentPatch } = cascadeOnOrderTransition({
  fromStatus: order.status, toStatus: next.status, actorRole, payment, now,
})
if (paymentPatch) await store.updatePayment(payment.id, paymentPatch)
```

### 托管双确认
```js
import { applyAction, publicEscrowShape } from './_lib/escrow.js'

// POST /api/payments/:id/confirm-delivery  (buyer)
const { payment: next, released } = applyAction(payment, {
  action: 'confirm_delivery', actorRole: 'buyer', now,
})
await store.updatePayment(payment.id, next)
if (released) await store.updateOrder(next.orderId, { status: 'completed' })
```

### 通知发送
```js
import { renderNotification } from './_lib/notifications.js'
import { sendEmail } from './_lib/email.js'  // Codex 的

const payload = renderNotification({
  event: 'order.released',
  channel: 'email',
  recipientRole: 'seller',
  recipientId: seller.id,
  context: { order, amount: payment.amountCents },
})
await sendEmail({ to: seller.email, subject: payload.subject, html: payload.body })
```

### 限流
```js
import { createLimiter, rateLimitHeaders } from './_lib/rate-limit.js'
const limiter = createLimiter()  // 模块顶层, 跨请求复用

// 在 handler 里
const r = limiter.tokenBucket(`ip:${ip}`, { capacity: 20, refillPerSec: 2 })
if (!r.allowed) return fail(429, 'rate_limited', '请慢一点', { headers: rateLimitHeaders(r) })
```

### 幂等
```js
import { runIdempotent, createIdempotencyCache, validateKey } from './_lib/idempotency.js'
const idem = createIdempotencyCache()

// POST /api/orders  header: Idempotency-Key
const key = req.headers['idempotency-key']
if (key && !validateKey(key).ok) return fail(400, 'bad_idempotency_key', '格式错误')
const { result, replayed } = await runIdempotent(idem, {
  key: key || `anon:${crypto.randomUUID()}`,
  handler: async () => createOrder(body),
})
```

### 消息投影 / 用户投影
```js
import { buildMessageTimeline, lastMessagePreview } from './_lib/message-shape.js'
import { publicUserShape, sellerCard, selfUserShape } from './_lib/profile-shape.js'

// GET /api/orders/:id/messages
return ok({ messages: buildMessageTimeline(raw, { viewerRole, hideFlagged: viewerRole !== 'admin' }) })

// GET /api/auth/profile
return ok({ user: selfUserShape(user) })

// GET /api/services?category=...
return ok({
  services: list.map(s => ({ ...s, seller: sellerCard(await store.getUser(s.sellerId)) })),
})
```

### SLA 截止时间
```js
import { nextSlaMilestone, autoReleaseAt } from './_lib/deadline.js'

// Dashboard 面板
const milestone = nextSlaMilestone(order, Date.now())
// → { kind: 'auto_release', deadline, hoursRemaining: 47.2, overdue: false }
```

### Webhook
```js
import { verifyPayload } from './_lib/webhook-signature.js'

// POST /api/webhooks/incoming
const body = await req.text()
const { valid, reason } = await verifyPayload({
  body, secret: process.env.WEBHOOK_SECRET,
  header: req.headers['x-whitehive-signature'],
})
if (!valid) return fail(401, 'bad_signature', reason)
```

## 四、契约约定（两侧必须守）

1. **HttpError / 响应壳**：所有 handler 用 `withApiErrors(async req => ...)` 包裹；
   成功走 `ok(data)`，失败走 `throw new HttpError(status, code, message, details?)`。
   Claude 的 pure-logic 会抛 HttpError, 错误码见各模块源文件注释。

2. **时间参数可注入 `now`**：每个纯函数都接收 `now`（ms 或 ISO）作为可选参数，
   方便测试。Codex 在 router 里正常不用传。

3. **ID 规范**：继续用 `api/_lib/ids.js` 的 `newId('ord')` / `newId('pay')` 等前缀。

4. **store 对象字段**：
   - `order`: `{ id, buyerId, sellerId, status, budgetCents, deliveryDays, createdAt, updatedAt, statusHistory?, acceptedAt?, deliveredAt?, completedAt? }`
   - `payment`: `{ id, orderId, amountCents, escrowStatus, buyerConfirmedAt?, sellerReadyAt?, releasedAt?, refundedAt?, releaseRequestedBy? }`
   - `message`: `{ id, orderId, senderRole, senderId, body, createdAt, flagged?, moderation?, attachments?, adminNotes?, editedAt? }`
   - `review`: `{ id, orderId, reviewerId, role, rating, body, tags, attachments, createdAt, editedAt?, hidden? }`
   - `user`: `{ id, email, phone?, role, displayName, avatarUrl?, bio?, city?, verified, verificationStatus?, createdAt, stats: { ordersCompleted, ordersCancelled, disputesOpened, disputesLost, avgRating } }`

   如果要给已有对象加字段，Claude 在 pure-logic 侧先读（容错 `??`），Codex 在
   store 侧后补持久化 —— **不阻塞**。

5. **tests/**：新增 `tests/*.test.js` 的那一方，确保 `bun test` 全绿再提交。

## 五、协作流程（建议）

- **动 store / schema / env** → Codex。
- **动状态机 / 计算 / shape / 校验** → Claude。
- **动路由 handler** → 优先 Codex；Claude 需要路由改动时，在 commit 里写"待 Codex
  wire 进 api/index.js 的 XX endpoint"并附调用示例（见本文第三节模式）。
- **发生冲突**（同一个非边界文件同时想改）→ 在 `docs/` 下开一个临时 `handoff-*.md`
  沟通，别直接互相 revert。

## 六、现在可以立刻 wire 的路由（Claude 已经备好 pure-logic）

> 这些 endpoint 的 handler 基本只剩 "读 store → 调 pure-logic → 写 store → 返回",
> 不需要再写任何 domain 代码。Codex 按下面顺序 wire 即可。

| Endpoint                                    | Pure-logic 依赖                                              |
| ------------------------------------------- | ------------------------------------------------------------ |
| `PATCH /api/orders/:id` (status change)     | `order-machine.applyTransition` + `payment-cascade.cascadeOnOrderTransition` |
| `POST /api/payments/:id/confirm-delivery`   | `escrow.applyAction({ action: 'confirm_delivery' })`         |
| `POST /api/payments/:id/ready-for-release`  | `escrow.applyAction({ action: 'ready_for_release' })`        |
| `POST /api/orders/:id/reviews`              | `reviews.normalizeReview` + `reviews.hasExistingReview`       |
| `PATCH /api/reviews/:id`                    | `reviews.canEdit` + `reviews.applyEdit`                      |
| `GET /api/users/:id`                        | `profile-shape.publicUserShape`                              |
| `GET /api/users/me`                         | `profile-shape.selfUserShape`                                |
| `GET /api/orders/:id/messages`              | `message-shape.buildMessageTimeline`                         |
| `GET /api/dashboard` (deadline widget)      | `deadline.nextSlaMilestone`                                  |
| 所有写操作的 429 防刷                       | `rate-limit.createLimiter`                                    |
| 所有"易重复"的 POST (下单/支付)             | `idempotency.runIdempotent`                                   |
| 订单 / 托管 / 纠纷事件发件                  | `notifications.renderNotification` + Codex 的 `email.sendEmail` |

如果 Codex 在 wire 过程中发现 pure-logic 的字段不够，直接在对应模块的注释里加一条
"TODO: Claude please add X"，下一轮 Claude 就补。
