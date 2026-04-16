# WhiteHive Backend MVP Plan

## Goal

The first backend milestone is not real payments or real-name verification. It is the smallest product loop that proves WhiteHive can support buying and selling digital services:

1. A user can register, log in, and keep a short-lived product session.
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
- `GET /api/auth/profile`
- `PATCH /api/auth/profile`
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

Matching:

- `api/_lib/matcher.js` implements `whitehive-rule-match-v1`.
- It scores published services by category, keyword overlap, budget fit, delivery deadline and seller verification status.
- It returns explainable `reasons`, `warnings`, `clarifyingQuestions` and a `suggestedOrderDraft`.
- This is intentionally deterministic for the MVP; later it can be replaced by LLM + embedding search without changing the public `/api/matches` contract.

Current storage:

- `api/_lib/store.js` selects the active storage adapter.
- `api/_lib/memory-store.js` keeps the safe demo fallback.
- `api/_lib/postgres-store.js` uses Neon/Postgres when `DATABASE_URL` exists.
- Registration now stores a hashed password, personal profile fields, and a server-side session token hash.
- Without `DATABASE_URL`, data is still not persistent across cold starts or redeploys.
- With `DATABASE_URL`, the API auto-creates the MVP tables and seeds demo records.

Database target:

- Preferred: Neon Postgres through Vercel Marketplace.
- Add `DATABASE_URL` in Vercel once the database exists.
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

1. Create a real Postgres database and set `DATABASE_URL` in Vercel.
2. Verify `/api/health` reports `driver: neon-postgres`.
3. Add rate limiting and email verification before opening registration publicly.
4. Replace the MVP password auth with Clerk/Auth0 or email magic-link auth when the product leaves demo mode.
5. Replace browser cache fallback with Postgres-backed user data everywhere.
6. Split `/dashboard` into real buyer/seller dashboards after auth is connected across all flows.
7. Add the final payment confirmation UI on top of `/api/payments`.
8. Replace `whitehive-rule-match-v1` with LLM + embedding search after service data grows.
9. Connect a real payment provider and real-name verification provider only after the demo loop is stable.
