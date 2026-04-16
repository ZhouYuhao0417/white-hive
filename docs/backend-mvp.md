# WhiteHive Backend MVP Plan

## Goal

The first backend milestone is not real payments or real-name verification. It is the smallest product loop that proves WhiteHive can support buying and selling digital services:

1. A user can create a demo session.
2. A seller can publish a structured service.
3. A buyer can create an order from a service.
4. The order can move through clear states.
5. Buyer and seller can leave messages under the order.
6. The buyer can create a mock escrow payment.
7. A seller can submit a mock real-name verification request.

## Current Implementation

Added a unified Vercel Function gateway at `api/index.js`. Public routes stay the same, but `/api/:path*` is rewritten to one function so the memory MVP can share demo state across order, payment and message calls until Postgres is connected.

Public endpoints:

- `GET /api/health`
- `GET /api/auth/session`
- `POST /api/auth/session`
- `GET /api/services`
- `POST /api/services`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders?id=...`
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

Current storage:

- In-memory seeded data
- Good for frontend integration and competition demo wiring
- Not persistent across cold starts or redeploys

Next storage target:

- Neon Postgres or Supabase Postgres
- Use `db/schema.sql` as the first migration
- Add `DATABASE_URL` in Vercel once the database exists

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

1. Create real Postgres database and run `db/schema.sql`.
2. Replace memory store with a Postgres adapter.
3. Add real auth provider or email magic-link auth.
4. Replace browser cache fallback with Postgres persistence.
5. Split `/dashboard` into real buyer/seller dashboards after auth is connected.
6. Add the final payment confirmation UI on top of `/api/payments`.
7. Connect a real payment provider and real-name verification provider only after the demo loop is stable.
