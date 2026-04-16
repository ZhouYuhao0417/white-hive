# WhiteHive MVP API Contract

This is the first backend contract for the buying/selling order MVP. The current implementation runs on Vercel Functions and uses an in-memory store until a real Postgres `DATABASE_URL` is provisioned.

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

Updates status or payment status.

```json
{
  "status": "in_progress",
  "paymentStatus": "mock_paid"
}
```

Allowed order statuses:

- `submitted`
- `accepted`
- `in_progress`
- `delivered`
- `completed`
- `cancelled`

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
