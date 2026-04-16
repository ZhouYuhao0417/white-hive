# WhiteHive MVP API Contract

This is the first backend contract for the buying/selling order MVP. The current implementation runs through one Vercel Function gateway (`api/index.js`) and uses an in-memory store until a real Postgres `DATABASE_URL` is provisioned.

## Response Shape

Successful response:

```json
{
  "ok": true,
  "data": {}
}
```

Error response:

```json
{
  "ok": false,
  "error": {
    "code": "missing_fields",
    "message": "缺少必要字段。"
  }
}
```

## Auth

### `GET /api/auth/session`

Returns the demo session user.

### `POST /api/auth/session`

Creates a demo session. This is not real authentication yet.

```json
{
  "email": "founder@whitehive.cn",
  "password": "demo-password",
  "mode": "buyer"
}
```

## Services

### `GET /api/services`

Query params:

- `category`: optional category slug such as `web` or `ai`
- `status`: optional service status, defaults to `published`

### `GET /api/services?id=svc_web_landing`

Returns one service.

### `POST /api/services`

Creates a service draft/published listing.

```json
{
  "sellerId": "usr_demo_seller",
  "category": "web",
  "title": "创业项目官网与预约落地页",
  "summary": "交付一套可访问、可修改的官网页面。",
  "priceCents": 280000,
  "deliveryDays": 7,
  "status": "draft",
  "tags": ["官网", "Vercel"]
}
```

In the current frontend, `/sell` sends this request and stores the latest created services in browser local storage as a demo fallback until Postgres is connected.

## Orders

### `GET /api/orders`

Query params:

- `userId`: optional buyer/seller user id
- `status`: optional order status

### `GET /api/orders?id=ord_demo_001`

Returns one order with service, buyer, seller and `messageCount`.

### `POST /api/orders`

Creates an order from a selected service.

```json
{
  "serviceId": "svc_web_landing",
  "buyerId": "usr_demo_buyer",
  "brief": "我需要一个能用于比赛路演的官网。",
  "budgetCents": 300000
}
```

### `PATCH /api/orders?id=ord_demo_001`

Updates order status. The backend now validates that the order does not skip workflow nodes.

```json
{
  "status": "in_progress"
}
```

Allowed order statuses:

- `submitted`
- `accepted`
- `in_progress`
- `delivered`
- `completed`
- `cancelled`

When a paid order moves to `completed`, the mock escrow payment is released automatically. When a paid order moves to `cancelled`, the mock escrow payment is refunded automatically.

## Payments

Payments are still mock payments for MVP demos. They prove the escrow flow before a real payment provider is connected.

### `GET /api/payments`

Query params:

- `orderId`: optional order id
- `status`: optional payment status

### `GET /api/payments?id=pay_xxx`

Returns one payment.

### `POST /api/payments`

Creates an idempotent mock payment for an order. If the order already has a held or released escrow payment, the existing payment is returned.

```json
{
  "orderId": "ord_demo_001",
  "method": "alipay_mock"
}
```

The response includes:

- `status`: currently `succeeded` for mock payments
- `escrowStatus`: `held`, then `released` or `refunded`
- `order.paymentStatus`: `mock_paid`, `mock_released`, or `mock_refunded`

## Messages

### `GET /api/messages?orderId=ord_demo_001`

Returns messages for an order.

### `POST /api/messages`

```json
{
  "orderId": "ord_demo_001",
  "senderId": "usr_demo_buyer",
  "body": "这个版本可以先按比赛路演来做。"
}
```

## Verification

Verification is also a mock workflow for now. It gives the product a stable trust-layer API before connecting a real identity provider.

### `GET /api/verification?userId=usr_demo_seller`

Returns the user verification profile plus the latest request.

### `POST /api/verification`

Creates a pending verification request.

```json
{
  "userId": "usr_demo_seller",
  "realName": "蜂巢创作者",
  "idNumberLast4": "2026",
  "contactEmail": "seller@whitehive.cn",
  "role": "seller"
}
```

### `PATCH /api/verification?id=ver_xxx`

Reviews a request in demo/admin mode.

```json
{
  "status": "approved",
  "reviewerNote": "演示审核通过"
}
```
