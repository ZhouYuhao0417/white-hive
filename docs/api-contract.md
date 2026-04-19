# WhiteHive MVP API Contract

This is the first backend contract for the buying/selling order MVP. The current implementation runs through one Vercel Function gateway (`api/index.js`). It uses Postgres through `DATABASE_URL` when available, and safely falls back to the in-memory demo store when no database is configured.

Auth-related account endpoints:

- `POST /api/auth/session`: sign up or sign in with email/password.
- `POST /api/auth/provider`: sign in with the MVP provider bridge for phone, WeChat, QQ or GitHub.
- `GET /api/auth/providers`: inspect which provider logins are live vs demo.
- `GET /api/auth/session`: restore the current bearer-token session.
- `PATCH /api/auth/profile`: update profile fields for the logged-in user.
- `DELETE /api/auth/account`: delete a disposable test account when it has no linked services, orders, payments or messages.
- `POST /api/auth/email-verification`: create and send a 6-digit email verification code.
- `POST /api/auth/email-verification/confirm`: confirm the 6-digit code and mark the email as verified.
- `POST /api/auth/phone-verification`: create and send a 6-digit SMS verification code.
- `POST /api/auth/phone-verification/confirm`: confirm the 6-digit SMS code and mark the phone as verified.
- `POST /api/auth/password-reset`: request a password reset code by email.
- `POST /api/auth/password-reset/confirm`: confirm the reset code and set a new password.
- `POST /api/uploads/avatar`: upload the current user's avatar to Vercel Blob when configured.
- `GET /api/auth/verification`: read the current logged-in user's real-name verification status.
- `POST /api/auth/verification`: submit a real-name verification request for the current logged-in user.
- `GET /api/verification`: read the logged-in user's real-name verification status.
- `POST /api/verification`: submit a real-name verification request.
- `PATCH /api/verification`: admin-only real-name verification review.

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

Returns the current session user when the frontend sends `Authorization: Bearer <token>`. If no token is present, it still returns the seeded demo buyer so the public MVP pages can keep working during early demos.

### `POST /api/auth/session`

Creates a password-based session. Passwords are hashed on the server with Node crypto `scrypt`; the API returns a random bearer token that the browser stores locally for later requests.
Registration and login are rate-limited by IP and email to reduce brute-force attempts. New profile payloads may include `avatarUrl`, currently a compressed image data URL from the frontend MVP.

```json
{
  "email": "founder@whitehive.cn",
  "password": "demo-password",
  "action": "signup",
  "role": "buyer",
  "displayName": "WhiteHive Founder",
  "phone": "13800000000",
  "schoolOrCompany": "WhiteHive",
  "city": "Chengdu",
  "bio": "I want to buy and sell trusted digital services.",
  "avatarUrl": "data:image/jpeg;base64,..."
}
```

For login, send:

```json
{
  "email": "founder@whitehive.cn",
  "password": "demo-password",
  "action": "signin",
  "mode": "signin"
}
```

### `POST /api/auth/provider`

Creates a session through the MVP provider bridge. This makes every UI entry point usable for demos today. Phone registration now has a separate SMS verification flow; WeChat/QQ/GitHub still use demo identities until platform app credentials are available.

Supported `provider` values:

- `phone`
- `wechat`
- `qq`
- `github`

```json
{
  "provider": "github",
  "role": "buyer",
  "displayName": "GitHub用户"
}
```

The response shape matches `POST /api/auth/session` and returns a bearer session token.

### `GET /api/auth/providers`

Returns a safe configuration summary for password, phone, GitHub, WeChat and QQ login. It never returns secrets. Phone reports `live` when Aliyun SMS variables are configured, `mock` when `WHITEHIVE_SMS_MOCK=1`, and `demo` otherwise. OAuth providers remain in `demo` mode until app credentials are configured.

### `GET /api/auth/profile`

Returns the current bearer-token user profile.

### `PATCH /api/auth/profile`

Updates the current user profile.

```json
{
  "displayName": "蜂巢创作者",
  "role": "seller",
  "phone": "13800000000",
  "schoolOrCompany": "WhiteHive Studio",
  "city": "Chengdu",
  "bio": "I can deliver landing pages and AI workflow services.",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

### `DELETE /api/auth/account`

Deletes the current logged-in test account and clears server-side session data. To protect order history, the backend refuses deletion when the account already owns services, orders, payments or messages.

### `POST /api/auth/email-verification`

Creates a short-lived hashed verification code and sends it by email. Production delivery requires `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. Without a real email key, the API no longer returns mock codes to the browser; local demos can opt into mock delivery with `WHITEHIVE_EMAIL_MOCK=1`, but the code remains hidden from the UI.

### `POST /api/auth/email-verification/confirm`

Confirms the 6-digit email code. Send/confirm endpoints are rate-limited by IP and session token to reduce verification-code abuse.

### `POST /api/auth/phone-verification`

Creates a short-lived hashed SMS code for the logged-in user. Production delivery uses Aliyun Dysmsapi and requires `ALIYUN_SMS_ACCESS_KEY_ID`, `ALIYUN_SMS_ACCESS_KEY_SECRET`, `ALIYUN_SMS_SIGN_NAME` and `ALIYUN_SMS_TEMPLATE_CODE`. Local demos can use `WHITEHIVE_SMS_MOCK=1`; the API still keeps the verification code server-side.

```json
{
  "phone": "13800000000"
}
```

The backend rate-limits requests by IP, session and phone number. A verified phone number cannot be claimed by a different account.

### `POST /api/auth/phone-verification/confirm`

Confirms the 6-digit SMS code, stores `phoneVerifiedAt`, and updates the user's bound phone number.

```json
{
  "phone": "13800000000",
  "code": "123456"
}
```

### `POST /api/auth/password-reset`

Requests a password reset code for an email/password account. The API intentionally returns a generic success response even when the email is not registered, so attackers cannot enumerate accounts. Real delivery requires the same `RESEND_API_KEY` and `EMAIL_FROM` variables as email verification.

```json
{
  "email": "founder@whitehive.cn"
}
```

### `POST /api/auth/password-reset/confirm`

Confirms the password reset code and stores a new scrypt-hashed password. Existing sessions for that account are invalidated.

```json
{
  "email": "founder@whitehive.cn",
  "code": "123456",
  "password": "new-demo-password"
}
```

### `POST /api/uploads/avatar`

Uploads a compressed data URL avatar for the current bearer-token user. This endpoint requires `BLOB_READ_WRITE_TOKEN`; otherwise it returns `blob_not_configured` and the frontend keeps the local compressed avatar as an MVP fallback.

```json
{
  "fileName": "avatar.jpg",
  "contentType": "image/jpeg",
  "dataUrl": "data:image/jpeg;base64,..."
}
```

### `GET /api/auth/verification`

Returns the current bearer-token user's real-name verification profile. This is the product-safe endpoint the frontend should prefer after login.

### `POST /api/auth/verification`

Submits a real-name verification request for the current bearer-token user. The backend ignores incoming `userId` on this endpoint and binds the request to the session user.

```json
{
  "verificationType": "individual",
  "realName": "周同学",
  "role": "买家个人",
  "idNumberLast4": "1234",
  "contactEmail": "founder@whitehive.cn",
  "schoolOrCompany": "成都理工大学",
  "city": "成都",
  "evidenceUrl": "https://www.whitehive.cn"
}
```

## Services

### `GET /api/services`

Query params:

- `category`: optional category slug such as `web` or `ai`
- `status`: optional service status, defaults to `published`
- `sellerId`: optional seller id, used by the logged-in dashboard to show "my services"

### `GET /api/services?id=svc_web_landing`

Returns one service.

### `POST /api/services`

Creates a service draft/published listing. Requires a bearer session whose user role is `seller` or `admin`; the backend ignores incoming `sellerId` and binds the service to the logged-in user.

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

In the current frontend, `/sell` sends this request and stores the latest created services in browser local storage as a demo fallback when the API is unavailable.

## Orders

### `GET /api/orders`

Query params:

- `userId`: optional buyer/seller user id
- `status`: optional order status

When called without a bearer token, the endpoint returns an empty list. Logged-in users only see orders where they are buyer or seller; admins may query another `userId`.

### `GET /api/orders?id=ord_demo_001`

Returns one order with service, buyer, seller and `messageCount`. Requires the current bearer-token user to be the buyer, seller or admin for that order.

### `POST /api/orders`

Creates an order from a selected service.

```json
{
  "serviceId": "svc_web_landing",
  "brief": "我需要一个能用于比赛路演的官网。",
  "budgetCents": 300000
}
```

Requires a bearer session. The backend sets `buyerId` from the logged-in user.

### `PATCH /api/orders?id=ord_demo_001`

Updates order status. Requires the current user to be an order participant. Seller-side users may accept/start/deliver/cancel; buyer-side users may complete/cancel. Direct `paymentStatus` mutation is admin-only because normal payment updates must go through `/api/payments`.

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

## Matching

### `GET /api/matches`

Quick matching preview through query params.

Query params:

- `q` or `brief`: demand text
- `category`: optional category slug or `any`
- `budgetCents`: optional budget in cents
- `deadline`: optional natural-language deadline such as `3 天内`
- `limit`: optional result count, between 1 and 10

### `POST /api/matches`

Runs the MVP matching engine and returns scored, explainable service recommendations.

```json
{
  "brief": "我需要一个比赛路演官网，移动端要好看，最好一周内完成。",
  "category": "web",
  "budgetCents": 300000,
  "deadline": "1 周内",
  "limit": 5,
  "answers": {
    "reference": "Linear 的极简风",
    "success": "能用于互联网+答辩"
  }
}
```

Response fields:

- `engine`: currently `whitehive-rule-match-v1`, a deterministic rule engine. It is intentionally not a paid LLM call yet.
- `confidence`: `high`, `medium`, or `low`
- `matches`: ranked services with `score`, `fit`, `reasons`, and `warnings`
- `clarifyingQuestions`: follow-up questions the UI can ask before creating an order
- `suggestedOrderDraft`: a safe draft that can be passed to `POST /api/orders`

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

When logged in, only the order buyer or an admin can create the mock payment.

The response includes:

- `status`: currently `succeeded` for mock payments
- `escrowStatus`: `held`, then `released` or `refunded`
- `order.paymentStatus`: `mock_paid`, `mock_released`, or `mock_refunded`

## Messages

### `GET /api/messages?orderId=ord_demo_001`

Returns messages for an order. Requires the current bearer-token user to be an order participant.

### `POST /api/messages`

```json
{
  "orderId": "ord_demo_001",
  "senderId": "usr_demo_buyer",
  "body": "这个版本可以先按比赛路演来做。"
}
```

When logged in, the backend sends the message as the current user and requires that user to be the order buyer, seller, or admin.

## Verification

Verification is also a mock workflow for now. It gives the product a stable trust-layer API before connecting a real identity provider.

### `GET /api/verification?userId=usr_demo_seller`

Returns the user verification profile plus the latest request. A user can read their own profile; reading another user's profile requires admin permission.

### `POST /api/verification`

Creates a pending verification request.

```json
{
  "userId": "usr_demo_seller",
  "realName": "蜂巢创作者",
  "idNumberLast4": "2026",
  "contactEmail": "seller@whitehive.cn",
  "role": "seller",
  "verificationType": "studio",
  "schoolOrCompany": "成都理工大学",
  "city": "成都",
  "evidenceUrl": "https://www.whitehive.cn"
}
```

When logged in, the verification request is attached to the current bearer-token user.

### `PATCH /api/verification?id=ver_xxx`

Reviews a verification request. Requires either `WHITEHIVE_ADMIN_EMAILS` to include the logged-in user's email or a valid `x-whitehive-admin-token` matching `WHITEHIVE_ADMIN_REVIEW_TOKEN`.

```json
{
  "status": "approved",
  "reviewerNote": "演示审核通过"
}
```
