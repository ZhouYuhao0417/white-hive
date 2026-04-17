# WhiteHive Database Setup

WhiteHive now has two storage modes:

- Memory demo mode: no database URL; safe for UI demos, but data can reset.
- Postgres mode: a database URL exists; users, provider identities, sessions, avatars, email verification codes, password reset codes, rate-limit events, orders, services, messages, mock payments and verification requests persist.

## Recommended Provider

Use Neon Postgres through Vercel Marketplace when possible. It is the cleanest path for a Vercel-hosted MVP because Vercel can inject the database environment variables into the project.

## Environment Variables

Required for persistence:

```bash
DATABASE_URL="postgres://..."
```

Accepted fallback name:

```bash
POSTGRES_URL="postgres://..."
```

Vercel Storage integrations can also generate a prefixed name:

```bash
STORAGES_URL="postgres://..."
```

The backend checks `DATABASE_URL` first, then `POSTGRES_URL`, then `STORAGES_URL`. Vercel/Neon integrations may expose different names depending on the setup path and custom prefix.

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
- `/api/auth/provider`
- `/api/auth/password-reset`
- `/api/auth/verification`
- `/api/orders`
- `/api/payments`
- `/api/messages`
- `/api/verification`

Internally:

- `api/_lib/store.js` chooses the adapter.
- `api/_lib/memory-store.js` is the no-database fallback.
- `api/_lib/postgres-store.js` creates tables, seeds demo records and persists data.
- `db/schema.sql` mirrors the tables used by the Postgres adapter.

## Vercel + Neon Setup

Recommended path for this project:

1. Open the Vercel project `whitehive-project`.
2. Go to `Storage` or `Marketplace`.
3. Choose `Neon Postgres`.
4. Create a new Neon database and connect it to this Vercel project.
5. Make sure the integration adds `DATABASE_URL`, `POSTGRES_URL`, or `STORAGES_URL` to Production, Preview and Development.
6. Redeploy the latest `main` deployment after the environment variable exists.

The API auto-migrates on first request, so there is no separate SQL command to run manually.

## Email Sender

Email verification uses Resend-compatible API calls. Add these server-side variables in Vercel when you are ready for real delivery:

```bash
RESEND_API_KEY="re_..."
EMAIL_FROM="WhiteHive <no-reply@whitehive.cn>"
```

Verify `whitehive.cn` as a sender domain before relying on production delivery. Local-only mock email can be enabled with `WHITEHIVE_EMAIL_MOCK=1`, but the frontend no longer displays mock verification codes.

## Verification

After setting the database URL, open:

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
