# Escrow · 双方确认后才放款

> 面向 Codex 的交接文档。
> 目的：把"资金托管要买卖双方都确认后才放款"落实到 store + API 两层。
> 纯逻辑 + 测试已经在 `api/_lib/escrow.js` + `tests/escrow.test.js` 里完成。
> 你这边只需要把它接进 `api/_lib/memory-store.js`（+ 同步 `postgres-store.js`）和 `api/index.js` 路由。

## 背景

原来的 `createPayment` 把钱打到托管后直接等 status 推进就放款。
新规则（来自产品反馈）：**订单即使交付了，也必须买家点"确认收到"、卖家点"可以放款" 两边都确认过，钱才真正落到卖家账上。**
这避免了"卖家已经拿到钱，买家却觉得货不对板"的扯皮。

管理员（admin）仍可以在纠纷裁决时强制放款 / 强制退款，绕开双确认。

## 新状态机

```
none ──(createPayment)──▶ held
                             │
    buyer confirm_delivery ──┤
    seller ready_for_release ┤
                             ▼
                 held (已记录某方确认)
                             │
       双方都确认 (auto) ────▶ released
                             │
        admin force_refund ──▶ refunded
        admin force_release ─▶ released
```

## 新增 payment 字段（需要在 memory-store + postgres-store 加）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `buyerConfirmedAt` | `ISO \| null` | 买家点"确认收到"的时间 |
| `sellerReadyAt` | `ISO \| null` | 卖家点"可以放款"的时间 |
| `releasedAt` | `ISO \| null` | 真正放款给卖家的时间 |
| `refundedAt` | `ISO \| null` | 退款给买家的时间 |
| `releaseRequestedBy` | `'buyer' \| 'seller' \| 'admin' \| null` | 最后一个触发 release/refund 的角色 |

Postgres schema 建议：

```sql
ALTER TABLE payments
  ADD COLUMN buyer_confirmed_at    TIMESTAMPTZ NULL,
  ADD COLUMN seller_ready_at       TIMESTAMPTZ NULL,
  ADD COLUMN released_at           TIMESTAMPTZ NULL,
  ADD COLUMN refunded_at           TIMESTAMPTZ NULL,
  ADD COLUMN release_requested_by  TEXT        NULL CHECK (release_requested_by IN ('buyer','seller','admin'));
```

## Store 层接入（memory-store.js）

在 store 里只要加一个方法就够了 —— 所有状态机逻辑已经在 `escrow.applyAction()` 里：

```js
import { applyAction, publicEscrowShape } from './escrow.js'

// 在 createStore() 返回的对象里加一个方法：
async confirmEscrowAction({ orderId, actorId, actorRole, action }) {
  const order = await this.getOrderById(orderId)
  if (!order) throw new HttpError(404, 'order_not_found', '订单不存在。')
  const payment = order.payment
  if (!payment) throw new HttpError(400, 'no_payment', '订单还没有托管付款。')

  // 身份校验：actor 必须是订单的 buyerId / sellerId / admin
  if (actorRole === 'buyer' && actorId !== order.buyerId) {
    throw new HttpError(403, 'not_buyer', '只有本订单的买家可以确认交付。')
  }
  if (actorRole === 'seller' && actorId !== order.sellerId) {
    throw new HttpError(403, 'not_seller', '只有本订单的卖家可以标记放款。')
  }

  const { payment: nextPayment, released, refunded } = applyAction(payment, {
    action,
    actorRole,
    actorId,
  })

  // 持久化
  order.payment = nextPayment
  // 如果触发了 released / refunded，建议同步推进订单状态：
  //   released  → order.status = 'completed'
  //   refunded  → order.status = 'refunded'
  if (released) order.status = 'completed'
  if (refunded) order.status = 'refunded'
  order.updatedAt = new Date().toISOString()

  await this.persist(order) // 你原来 updateOrder 的套路

  return {
    order,
    escrow: publicEscrowShape(nextPayment),
    released,
    refunded,
  }
}
```

**注意**：`applyAction` 会在非法动作（例如 seller 触发 `confirm_delivery`）时抛 `HttpError(409)`，所以外层 handler 只要一路 `throw`、让 `withApiErrors` 兜住就好。

## API 路由（api/index.js 或新增 `api/payments.js`）

建议走一个专门的端点：

```
POST /api/orders/:id/escrow/confirm
  body: { action: 'confirm_delivery' | 'ready_for_release' | 'cancel_confirmation' | 'force_release' | 'force_refund' }
  auth: 从 session / cookie 拿 actorId + actorRole
  response: { ok: true, data: { order, escrow, released, refunded } }
```

handler 草稿：

```js
import { validate } from './_lib/validate.js'
import { ok } from './_lib/http.js'

async function handleEscrowConfirm(req, { store, session }) {
  const orderId = req.params.id
  const body = validate(await req.json(), {
    action: {
      type: 'enum',
      required: true,
      values: [
        'confirm_delivery',
        'ready_for_release',
        'cancel_confirmation',
        'force_release',
        'force_refund',
      ],
    },
  })

  const result = await store.confirmEscrowAction({
    orderId,
    actorId: session.userId,
    actorRole: session.role, // 'buyer' | 'seller' | 'admin'
    action: body.action,
  })

  return ok(result)
}
```

## 前端接入

`/orders/:id` 页面（`OrderDetail.jsx`）需要加两颗按钮：

- 买家视角：`确认收到交付` → `confirm_delivery`
  - 显示条件：payment.escrowStatus === 'held' && !buyerConfirmedAt
- 卖家视角：`标记可以放款` → `ready_for_release`
  - 显示条件：payment.escrowStatus === 'held' && !sellerReadyAt
- 双方都可以：`撤回我的确认` → `cancel_confirmation`（仅在自己确认过、payment 未 released 时可用）

另外顶部状态栏建议显示一个简单的进度条：

```
[ 托管已入金 ] —— [ 买家确认 ✓ / — ] —— [ 卖家就绪 ✓ / — ] —— [ 已放款 ]
```

`canRelease(payment)` 可以直接判断"两个勾都打上了、但还没放款"（理论上不会出现，因为 auto-release；但放在 UI 上做 sanity check 没坏处）。

## 测试覆盖

`tests/escrow.test.js` 已覆盖：

- buyer 单独确认 → 不放款
- seller 单独确认 → 不放款
- 两边都确认 → 自动 released
- confirm 幂等
- cancel 回滚自己那一侧
- 已 released 后禁止 cancel（抛 409）
- admin force_release / force_refund
- 非法角色 / 非法动作抛 `HttpError(409)` + reason 在 `details.reason`

你接入 store 后，如果方便，补一个 `tests/store.flow.test.js` 的扩展场景（"下单 → 付款 → 双确认 → 自动 released"）即可。

## 为什么不直接改 memory-store.js

为了不和你正在写的 `memory-store.js` / `postgres-store.js` 发生合并冲突 —— 这部分是我们分工约定的你的文件。这份文档 + 纯逻辑模块让你接入时不用从零推状态机。
