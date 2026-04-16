# WhiteHive Database Setup

WhiteHive now has two storage modes:

- Memory demo mode: no `DATABASE_URL`; safe for UI demos, but data can reset.
- Postgres mode: `DATABASE_URL` exists; users, sessions, orders, services, messages, mock payments and verification requests persist.

## Recommended Provider

Use Neon Postgres through Vercel Marketplace when possible. It is the cleanest path for a Vercel-hosted MVP because Vercel can inject the database environment variables into the project.

## Environment Variables

Required for persistence:

```bash
DATABASE_URL="postgres://..."
```

Optional after the database is stable:

```bash
WHITEHIVE_REQUIRE_DATABASE=1
```

`WHITEHIVE_REQUIRE_DATABASE=1` means the API will fail loudly if Postgres is unavailable. Keep it off during early MVP demos so the app can fall back to memory instead of going down.

## How It Works

The public API does not change. The frontend still calls:

- `/api/services`
- `/api/auth/session`
- `/api/auth/profile`
- `/api/orders`
- `/api/payments`
- `/api/messages`
- `/api/verification`

Internally:

- `api/_lib/store.js` chooses the adapter.
- `api/_lib/memory-store.js` is the no-database fallback.
- `api/_lib/postgres-store.js` creates tables, seeds demo records and persists data.
- `db/schema.sql` mirrors the tables used by the Postgres adapter.

## Verification

After setting `DATABASE_URL`, open:

```text
https://www.whitehive.cn/api/health
```

Expected storage block:

```json
{
  "driver": "neon-postgres",
  "persistent": true
}
```

If it says `memory` or `memory-fallback`, the site is still safe, but data is not truly persistent yet.
