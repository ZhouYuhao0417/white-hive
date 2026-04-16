-- WhiteHive MVP database schema draft.
-- Run this later in Neon / Supabase / Postgres when DATABASE_URL is ready.

create table if not exists users (
  id text primary key,
  email text unique not null,
  display_name text not null,
  role text not null check (role in ('buyer', 'seller', 'admin')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  created_at timestamptz not null default now()
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
  payment_status text not null default 'mock_pending',
  verification_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  sender_id text not null references users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists services_category_status_idx on services(category, status);
create index if not exists orders_buyer_idx on orders(buyer_id);
create index if not exists orders_seller_idx on orders(seller_id);
create index if not exists messages_order_idx on messages(order_id, created_at);
