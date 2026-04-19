-- WhiteHive MVP database schema.
-- The Postgres adapter auto-creates these tables when DATABASE_URL is configured.

create table if not exists users (
  id text primary key,
  email text unique not null,
  display_name text not null,
  role text not null check (role in ('buyer', 'seller', 'admin')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  password_hash text,
  phone text not null default '',
  school_or_company text not null default '',
  city text not null default '',
  bio text not null default '',
  avatar_url text not null default '',
  auth_provider text not null default 'password',
  provider_user_id text not null default '',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

create table if not exists services (
  id text primary key,
  seller_id text not null references users(id),
  category text not null,
  title text not null,
  summary text not null,
  price_cents integer not null default 0,
  currency text not null default 'CNY',
  delivery_days integer not null default 7,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  service_id text not null references services(id),
  buyer_id text not null references users(id),
  seller_id text not null references users(id),
  title text not null,
  brief text not null,
  budget_cents integer not null default 0,
  currency text not null default 'CNY',
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled')),
  payment_status text not null default 'mock_pending'
    check (payment_status in ('mock_pending', 'mock_paid', 'mock_released', 'mock_refunded', 'mock_failed')),
  verification_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  buyer_id text not null references users(id),
  seller_id text not null references users(id),
  amount_cents integer not null,
  currency text not null default 'CNY',
  provider text not null default 'mock',
  method text not null default 'alipay_mock',
  status text not null default 'succeeded'
    check (status in ('succeeded', 'failed', 'refunded')),
  escrow_status text not null default 'held'
    check (escrow_status in ('held', 'released', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz
);

create table if not exists messages (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  sender_id text not null references users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists verification_requests (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  real_name text not null,
  role text not null,
  verification_type text not null default 'individual',
  id_number_last4 text not null default '',
  contact_email text not null,
  school_or_company text not null default '',
  city text not null default '',
  evidence_url text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_verification_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists phone_verification_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0
);

create table if not exists password_reset_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists rate_limit_events (
  id text primary key,
  bucket text not null,
  identifier_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists services_category_status_idx on services(category, status);
create index if not exists sessions_user_idx on sessions(user_id, expires_at);
create index if not exists sessions_token_hash_idx on sessions(token_hash);
create index if not exists orders_buyer_idx on orders(buyer_id);
create index if not exists orders_seller_idx on orders(seller_id);
create index if not exists payments_order_idx on payments(order_id, created_at);
create index if not exists messages_order_idx on messages(order_id, created_at);
create index if not exists verification_requests_user_idx on verification_requests(user_id, created_at);
create index if not exists email_verification_tokens_user_idx on email_verification_tokens(user_id, expires_at);
create index if not exists phone_verification_tokens_user_idx on phone_verification_tokens(user_id, expires_at);
create index if not exists password_reset_tokens_email_idx on password_reset_tokens(email, expires_at);
create unique index if not exists users_provider_identity_idx
  on users(auth_provider, provider_user_id)
  where provider_user_id <> '';
create index if not exists rate_limit_events_lookup_idx on rate_limit_events(bucket, identifier_hash, created_at);
