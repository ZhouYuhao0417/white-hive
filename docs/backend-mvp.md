# WhiteHive Backend MVP Plan

## Goal

The first backend milestone is not real payments or real-name verification. It is the smallest product loop that proves WhiteHive can support buying and selling digital services:

1. A user can register, log in, and keep a short-lived product session.
1. A user can request and confirm an email verification code.
2. A seller can publish a structured service.
3. A buyer can create an order from a service.
4. The backend can recommend matching services before order creation.
5. The order can move through clear states.
6. Buyer and seller can leave messages under the order.
7. The buyer can create a mock escrow payment.
8. A seller can submit a mock real-name verification request.

## Current Implementation

Added a unified Vercel Function gateway at `api/index.js`. Public routes stay the same, but `/api/:path*` is rewritten to one function so the backend can share the same storage adapter across order, payment and message calls.

Public endpoints:

- `GET /api/health`
- `GET /api/auth/session`
- `POST /api/auth/session`
- `POST /api/auth/provider`
- `GET /api/auth/profile`
- `PATCH /api/auth/profile`
- `DELETE /api/auth/account`
- `POST /api/auth/email-verification`
- `POST /api/auth/email-verification/confirm`
- `POST /api/auth/password-reset`
- `POST /api/auth/password-reset/confirm`
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
- Phone, WeChat, QQ and GitHub buttons now create provider-backed MVP sessions through `POST /api/auth/provider`, so every advertised login/register entry point is usable in demos. These are provider bridges, not final OAuth/SMS integrations yet.
- Registration/login and email verification now have simple IP/session/email rate limits backed by the active store.
- Profile data now supports an optional compressed avatar image for higher-trust accounts.
- Email verification now stores short-lived hashed verification codes. Production email requires `RESEND_API_KEY` and `EMAIL_FROM`; the UI no longer displays mock codes.
- Password reset now stores short-lived hashed reset codes, invalidates old sessions after a reset, and uses the same email delivery configuration.
- Real-name verification now has session-bound endpoints under `/api/auth/verification`, so the frontend can submit verification for the logged-in user without trusting a browser-provided `userId`.
- Disposable test accounts can be deleted from `/account` when they have no linked services, orders, payments or messages.
- Service publishing, order creation, order messages, mock payments and verification now prefer the bearer-token user over hard-coded demo IDs.
- Logged-in users can only pay for their own buyer-side orders and can only send messages inside orders they participate in.
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

- `mock_pending`: payment UI placeholder, no real transaction
- `mock_paid`: buyer confirmed simulated payment and funds are held in mock escrow
- `mock_released`: completed order released mock escrow to seller
- `mock_refunded`: simulated refund state

Verification statuses:

- `unverified`
- `pending`
- `verified`
- `rejected`

## Next Backend Steps

1. Add a real email sender such as Resend in Vercel and verify `whitehive.cn` as a sender domain.
2. Replace the provider bridges with real SMS, WeChat, QQ and GitHub OAuth credentials.
3. Replace the MVP password auth with Clerk/Auth0 or email magic-link auth when the product leaves demo mode.
4. Move avatar images from compressed data URLs into Vercel Blob or Alibaba Cloud OSS.
5. Replace browser cache fallback with Postgres-backed user data everywhere.
6. Split `/dashboard` into real buyer/seller dashboards after auth is connected across all flows.
7. Add the final payment confirmation UI on top of `/api/payments`.
8. Replace `whitehive-rule-match-v1` with LLM + embedding search after service data grows.
9. Connect a real payment provider and real-name verification provider only after the demo loop is stable.
