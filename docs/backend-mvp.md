# WhiteHive Backend MVP Plan

## Goal

The first backend milestone is not real payments or real-name verification. It is the smallest product loop that proves WhiteHive can support buying and selling digital services:

1. A user can register, log in, and keep a short-lived product session.
2. A user can request and confirm phone verification by SMS.
3. A user can request and confirm an email verification code when the email provider is available.
4. A seller can publish a structured service.
5. A buyer can create an order from a service.
6. The backend can recommend matching services before order creation.
7. The order can move through clear states.
8. Buyer and seller can leave messages under the order.
9. The buyer can create a mock escrow payment in local/test mode. Production non-CDUT orders require a real payment provider adapter before escrow can be collected.
10. A seller can submit a mock real-name verification request.

## Current Implementation

Added a unified Vercel Function gateway at `api/index.js`. Public routes stay the same, but `/api/:path*` is rewritten to one function so the backend can share the same storage adapter across order, payment and message calls.

Public endpoints:

- `GET /api/health`
- `GET /api/auth/session`
- `POST /api/auth/session`
- `POST /api/auth/provider`
- `GET /api/auth/providers`
- `GET /api/auth/profile`
- `PATCH /api/auth/profile`
- `DELETE /api/auth/account`
- `POST /api/auth/email-verification`
- `POST /api/auth/email-verification/confirm`
- `POST /api/auth/phone-verification`
- `POST /api/auth/phone-verification/confirm`
- `POST /api/auth/password-reset`
- `POST /api/auth/password-reset/confirm`
- `POST /api/uploads/avatar`
- `GET /api/auth/verification`
- `POST /api/auth/verification`
- `GET /api/services`
- `POST /api/services`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders?id=...`
- `GET /api/matches`
- `POST /api/matches`
- `GET /api/payments`
- `POST /api/payments`
- `GET /api/verification?userId=...`
- `POST /api/verification`
- `PATCH /api/verification?id=...`
- `GET /api/messages?orderId=...`
- `POST /api/messages`

Added frontend MVP routes:

- `/ai-match`: creates an MVP order through `POST /api/orders`
- `/orders/:id`: reads order state, sends messages, creates mock escrow payments, and moves workflow state
- `/services/:slug`: sends buyers into `/ai-match?category=...`
- `/sell`: creates a seller service through `POST /api/services`
- `/dashboard`: combines buyer orders and seller services into one MVP workspace
- `/account`: manages email verification and real-name verification status

Matching:

- `api/_lib/matcher.js` implements `whitehive-rule-match-v1`.
- It scores published services by category, keyword overlap, budget fit, delivery deadline and seller verification status.
- It returns explainable `reasons`, `warnings`, `clarifyingQuestions` and a `suggestedOrderDraft`.
- This is intentionally deterministic for the MVP; later it can be replaced by LLM + embedding search without changing the public `/api/matches` contract.

Current storage:

- `api/_lib/store.js` selects the active storage adapter.
- `api/_lib/memory-store.js` keeps the safe demo fallback.
- `api/_lib/postgres-store.js` uses Neon/Postgres when a supported database URL exists.
- Registration now stores a hashed password, personal profile fields, and a server-side session token hash.
- Phone registration now sends and confirms 6-digit SMS codes through Aliyun Dysmsapi when configured, with `WHITEHIVE_SMS_MOCK=1` available for local demos.
- If SMS is not configured, registration no longer blocks on an impossible code. The phone is saved as an unverified contact method and can be verified later after SMS credentials or a manual review path exists.
- WeChat, QQ and GitHub buttons still create provider-backed MVP sessions through `POST /api/auth/provider`, so every advertised login/register entry point is usable in demos while final OAuth credentials are pending.
- GitHub, WeChat and QQ also have live OAuth start/callback endpoints. When platform credentials are configured, the frontend sends users through real provider authorization; otherwise it keeps the demo bridge.
- Registration/login, email verification and phone verification now have simple IP/session/email/phone rate limits backed by the active store.
- Profile data now supports an optional compressed avatar image for higher-trust accounts.
- Avatar upload now has a Vercel Blob endpoint. When `BLOB_READ_WRITE_TOKEN` is configured, newly uploaded profile photos can move out of the database payload and into object storage.
- Email verification now stores short-lived hashed verification codes. Production email requires `RESEND_API_KEY` and `EMAIL_FROM`; the UI no longer displays mock codes. If the email provider is unavailable, registration can continue through phone verification first.
- Password reset now stores short-lived hashed reset codes, invalidates old sessions after a reset, and uses the same email delivery configuration.
- Real-name verification now has session-bound endpoints under `/api/auth/verification`, so the frontend can submit verification for the logged-in user without trusting a browser-provided `userId`.
- Real-name verification requests now track `verificationType`, school/company, city, optional HTTPS evidence link and review timestamp.
- Disposable test accounts can be deleted from `/account` when they have no linked services, orders, payments or messages.
- Service publishing, order creation, order detail reads, order messages, mock payments and verification now bind to the bearer-token user instead of hard-coded demo IDs.
- Logged-in users can only read/chat/pay inside orders they participate in; seller/buyer status transitions are separated by role.
- Without a database URL, data is still not persistent across cold starts or redeploys.
- With a database URL, the API auto-creates the MVP tables and seeds demo records.

Database target:

- Preferred: Neon Postgres through Vercel Marketplace.
- Add `DATABASE_URL`, `POSTGRES_URL`, or `STORAGES_URL` in Vercel once the database exists.
- Optional: set `WHITEHIVE_REQUIRE_DATABASE=1` only after the database is stable, so database errors fail loudly instead of falling back to memory.

## MVP Status Model

Order statuses:

- `submitted`: buyer submitted demand
- `accepted`: seller accepted the order
- `in_progress`: work has started
- `delivered`: seller submitted deliverables
- `completed`: buyer accepted delivery
- `cancelled`: order stopped

Payment statuses for MVP:

- `mock_pending`: non-CDUT payment UI placeholder before escrow collection
- `mock_paid`: buyer confirmed simulated payment and funds are held in mock escrow
- `mock_released`: completed order released mock escrow to seller
- `direct_settlement`: CDUT order; no WhiteHive escrow, buyer and seller settle directly
- `mock_refunded`: simulated refund state

Verification statuses:

- `unverified`
- `pending`
- `verified`
- `rejected`

## Next Backend Steps

1. Configure Aliyun SMS in Vercel with `ALIYUN_SMS_ACCESS_KEY_ID`, `ALIYUN_SMS_ACCESS_KEY_SECRET`, `ALIYUN_SMS_SIGN_NAME`, `ALIYUN_SMS_TEMPLATE_CODE`, `ALIYUN_SMS_REGION=cn-hangzhou` and `WHITEHIVE_SMS_MOCK=0`; then verify phone registration on production.
2. Keep `BLOB_READ_WRITE_TOKEN`, `WHITEHIVE_ADMIN_EMAILS` and optionally `WHITEHIVE_ADMIN_REVIEW_TOKEN` configured; restore `RESEND_API_KEY` and `EMAIL_FROM` only after the Resend account is usable again.
3. Register OAuth apps for GitHub, WeChat and QQ, set the corresponding client ID/secret variables, and verify the callback URLs under `/api/auth/oauth/:provider/callback`.
4. Replace the MVP password auth with Clerk/Auth0 or email magic-link auth when the product leaves demo mode.
5. Replace browser cache fallback with Postgres-backed user data everywhere.
6. Add an admin review page for pending real-name verification requests.
7. Split `/dashboard` into real buyer/seller dashboards after auth is connected across all flows.
8. Add the final payment confirmation UI on top of `/api/payments`.
9. Replace `whitehive-rule-match-v1` with LLM + embedding search after service data grows.
10. Connect a real payment provider and real-name verification provider only after the demo loop is stable.
