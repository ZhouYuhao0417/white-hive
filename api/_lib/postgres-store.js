import { neon } from '@neondatabase/serverless'
import { createId, nowIso } from './ids.js'
import {
  createEmailVerificationCode,
  createSessionToken,
  emailVerificationExpiresAt,
  hashPassword,
  hashToken,
  passwordResetExpiresAt,
  providerEmail,
  sanitizeProfileInput,
  sanitizeProviderAuthInput,
  sessionExpiresAt,
  validateEmailVerificationCode,
  validateEmail,
  validatePassword,
  verifyPassword,
} from './auth.js'
import { sendEmailVerification, sendPasswordReset } from './email.js'
import {
  seedMessages,
  seedOrders,
  seedPayments,
  seedServices,
  seedUsers,
  seedVerificationRequests,
} from './seed.js'
import { HttpError } from './http.js'

const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGES_URL || ''
const databaseUrlSource = process.env.DATABASE_URL
  ? 'DATABASE_URL'
  : process.env.POSTGRES_URL
    ? 'POSTGRES_URL'
    : process.env.STORAGES_URL
      ? 'STORAGES_URL'
      : ''
const orderStatuses = ['submitted', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled']
const serviceStatuses = ['draft', 'published', 'paused', 'archived']
const orderPaymentStatuses = ['mock_pending', 'mock_paid', 'mock_released', 'mock_refunded', 'mock_failed']
const verificationStatuses = ['unverified', 'pending', 'verified', 'rejected']
const verificationRequestStatuses = ['pending', 'approved', 'rejected']

const orderStatusLabels = {
  submitted: '待卖家接单',
  accepted: '卖家已接单',
  in_progress: '制作中',
  delivered: '等待买家验收',
  completed: '订单已完成',
  cancelled: '订单已取消',
}

const orderStatusTransitions = {
  submitted: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['delivered', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

let client
let readyPromise

export function hasDatabase() {
  return Boolean(databaseUrl)
}

function getClient() {
  if (!databaseUrl) {
    throw new HttpError(500, 'database_not_configured', '数据库连接变量尚未配置。')
  }

  if (!client) {
    client = neon(databaseUrl)
  }

  return client
}

async function query(strings, ...values) {
  await ensureDatabase()
  return getClient()(strings, ...values)
}

async function ensureDatabase() {
  if (!databaseUrl) return
  if (!readyPromise) {
    readyPromise = migrateAndSeed()
  }
  return readyPromise
}

async function migrateAndSeed() {
  const db = getClient()

  await db`
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
      updated_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `

  await db`alter table users add column if not exists password_hash text`
  await db`alter table users add column if not exists phone text not null default ''`
  await db`alter table users add column if not exists school_or_company text not null default ''`
  await db`alter table users add column if not exists city text not null default ''`
  await db`alter table users add column if not exists bio text not null default ''`
  await db`alter table users add column if not exists avatar_url text not null default ''`
  await db`alter table users add column if not exists auth_provider text not null default 'password'`
  await db`alter table users add column if not exists provider_user_id text not null default ''`
  await db`alter table users add column if not exists email_verified_at timestamptz`
  await db`alter table users add column if not exists updated_at timestamptz not null default now()`

  await db`
    create table if not exists sessions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text unique not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      last_seen_at timestamptz not null default now()
    )
  `

  await db`
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
    )
  `

  await db`
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
    )
  `

  await db`
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
    )
  `

  await db`
    create table if not exists messages (
      id text primary key,
      order_id text not null references orders(id) on delete cascade,
      sender_id text not null references users(id),
      body text not null,
      created_at timestamptz not null default now()
    )
  `

  await db`
    create table if not exists verification_requests (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      real_name text not null,
      role text not null,
      id_number_last4 text not null default '',
      contact_email text not null,
      status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
      reviewer_note text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `

  await db`
    create table if not exists email_verification_tokens (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      email text not null,
      code_hash text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at timestamptz
    )
  `

  await db`
    create table if not exists password_reset_tokens (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      email text not null,
      code_hash text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at timestamptz
    )
  `

  await db`
    create table if not exists rate_limit_events (
      id text primary key,
      bucket text not null,
      identifier_hash text not null,
      created_at timestamptz not null default now()
    )
  `

  await db`create index if not exists services_category_status_idx on services(category, status)`
  await db`create index if not exists sessions_user_idx on sessions(user_id, expires_at)`
  await db`create index if not exists sessions_token_hash_idx on sessions(token_hash)`
  await db`create index if not exists orders_buyer_idx on orders(buyer_id)`
  await db`create index if not exists orders_seller_idx on orders(seller_id)`
  await db`create index if not exists payments_order_idx on payments(order_id, created_at)`
  await db`create index if not exists messages_order_idx on messages(order_id, created_at)`
  await db`create index if not exists verification_requests_user_idx on verification_requests(user_id, created_at)`
  await db`create index if not exists email_verification_tokens_user_idx on email_verification_tokens(user_id, expires_at)`
  await db`create index if not exists password_reset_tokens_email_idx on password_reset_tokens(email, expires_at)`
  await db`
    create unique index if not exists users_provider_identity_idx
    on users(auth_provider, provider_user_id)
    where provider_user_id <> ''
  `
  await db`create index if not exists rate_limit_events_lookup_idx on rate_limit_events(bucket, identifier_hash, created_at)`

  await seedDatabase(db)
}

async function seedDatabase(db) {
  for (const user of seedUsers) {
    await db`
      insert into users (id, email, display_name, role, verification_status, created_at)
      values (${user.id}, ${user.email}, ${user.displayName}, ${user.role}, ${user.verificationStatus}, ${user.createdAt})
      on conflict (id) do nothing
    `
  }

  for (const service of seedServices) {
    await db`
      insert into services (
        id, seller_id, category, title, summary, price_cents, currency, delivery_days, status, tags, created_at, updated_at
      )
      values (
        ${service.id}, ${service.sellerId}, ${service.category}, ${service.title}, ${service.summary},
        ${service.priceCents}, ${service.currency}, ${service.deliveryDays}, ${service.status}, ${service.tags},
        ${service.createdAt}, ${service.updatedAt}
      )
      on conflict (id) do nothing
    `
  }

  for (const order of seedOrders) {
    await db`
      insert into orders (
        id, service_id, buyer_id, seller_id, title, brief, budget_cents, currency,
        status, payment_status, verification_required, created_at, updated_at
      )
      values (
        ${order.id}, ${order.serviceId}, ${order.buyerId}, ${order.sellerId}, ${order.title}, ${order.brief},
        ${order.budgetCents}, ${order.currency}, ${order.status}, ${order.paymentStatus},
        ${order.verificationRequired}, ${order.createdAt}, ${order.updatedAt}
      )
      on conflict (id) do nothing
    `
  }

  for (const payment of seedPayments) {
    await db`
      insert into payments (
        id, order_id, buyer_id, seller_id, amount_cents, currency, provider, method,
        status, escrow_status, created_at, updated_at, confirmed_at, released_at, refunded_at
      )
      values (
        ${payment.id}, ${payment.orderId}, ${payment.buyerId}, ${payment.sellerId}, ${payment.amountCents},
        ${payment.currency}, ${payment.provider}, ${payment.method}, ${payment.status}, ${payment.escrowStatus},
        ${payment.createdAt}, ${payment.updatedAt}, ${payment.confirmedAt}, ${payment.releasedAt}, ${payment.refundedAt}
      )
      on conflict (id) do nothing
    `
  }

  for (const request of seedVerificationRequests) {
    await db`
      insert into verification_requests (
        id, user_id, real_name, role, id_number_last4, contact_email, status, reviewer_note, created_at, updated_at
      )
      values (
        ${request.id}, ${request.userId}, ${request.realName}, ${request.role}, ${request.idNumberLast4},
        ${request.contactEmail}, ${request.status}, ${request.reviewerNote}, ${request.createdAt}, ${request.updatedAt}
      )
      on conflict (id) do nothing
    `
  }

  for (const message of seedMessages) {
    await db`
      insert into messages (id, order_id, sender_id, body, created_at)
      values (${message.id}, ${message.orderId}, ${message.senderId}, ${message.body}, ${message.createdAt})
      on conflict (id) do nothing
    `
  }
}

export async function storeInfo() {
  await ensureDatabase()
  return {
    driver: 'neon-postgres',
    persistent: true,
    note: `${databaseUrlSource} 已配置，当前 API 使用 Postgres 持久化存储。`,
    capabilities: [
      'password_auth',
      'provider_auth_demo',
      'sessions',
      'email_verification',
      'password_reset',
      'orders',
      'messages',
      'mock_payments',
      'verification_requests',
    ],
  }
}

export async function getDemoUser() {
  const user = await ensureUser('usr_demo_buyer')
  return publicUser(user)
}

export async function checkRateLimit(input = {}) {
  const bucket = String(input.bucket || 'default').slice(0, 80)
  const identifierHash = hashToken(input.identifier || 'anonymous')
  const limit = Math.max(1, Number(input.limit || 10))
  const windowSeconds = Math.max(1, Number(input.windowSeconds || 60))
  const nowMs = Date.now()
  const staleBefore = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
  const windowStart = new Date(nowMs - windowSeconds * 1000).toISOString()

  await query`delete from rate_limit_events where created_at < ${staleBefore}`

  const rows = await query`
    select count(*)::int as count, min(created_at) as oldest_at
    from rate_limit_events
    where bucket = ${bucket}
      and identifier_hash = ${identifierHash}
      and created_at >= ${windowStart}
  `
  const count = Number(rows[0]?.count || 0)

  if (count >= limit) {
    const oldestMs = rows[0]?.oldest_at ? new Date(rows[0].oldest_at).getTime() : nowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + windowSeconds * 1000 - nowMs) / 1000))
    throw new HttpError(429, 'rate_limited', input.message || '请求太频繁，请稍后再试。', {
      limit,
      windowSeconds,
      retryAfterSeconds,
    })
  }

  await query`
    insert into rate_limit_events (id, bucket, identifier_hash, created_at)
    values (${createId('rl')}, ${bucket}, ${identifierHash}, ${nowIso()})
  `

  return {
    allowed: true,
    limit,
    windowSeconds,
    remaining: Math.max(0, limit - count - 1),
  }
}

export async function upsertDemoSession(input = {}) {
  const normalizedEmail = validateEmail(input.email)
  const password = validatePassword(input.password)
  const profile = sanitizeProfileInput(input, normalizedEmail)
  const action = input.action || (input.mode === 'signin' ? 'signin' : 'signup')
  const existing = await query`select * from users where email = ${normalizedEmail} limit 1`
  let user = existing[0]

  if (action === 'signin') {
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'invalid_credentials', '邮箱或密码不正确。')
    }

    return createSessionForUser(userFromRow(user))
  }

  if (user?.password_hash) {
    throw new HttpError(409, 'account_exists', '这个邮箱已经注册，请直接登录。')
  }

  const passwordHash = hashPassword(password)

  if (!user) {
    const id = createId('usr')
    const createdAt = nowIso()
    const inserted = await query`
      insert into users (
        id, email, display_name, role, verification_status, password_hash,
        phone, school_or_company, city, bio, avatar_url, auth_provider, provider_user_id, created_at, updated_at
      )
      values (
        ${id}, ${normalizedEmail}, ${profile.displayName}, ${profile.role}, 'unverified',
        ${passwordHash}, ${profile.phone}, ${profile.schoolOrCompany}, ${profile.city},
        ${profile.bio}, ${profile.avatarUrl}, 'password', '', ${createdAt}, ${createdAt}
      )
      returning *
    `
    user = inserted[0]
  } else {
    const updatedAt = nowIso()
    const updated = await query`
      update users
      set
        display_name = ${profile.displayName},
        role = ${profile.role},
        password_hash = ${passwordHash},
        phone = ${profile.phone},
        school_or_company = ${profile.schoolOrCompany},
        city = ${profile.city},
        bio = ${profile.bio},
        avatar_url = ${profile.avatarUrl},
        auth_provider = 'password',
        provider_user_id = '',
        updated_at = ${updatedAt}
      where id = ${user.id}
      returning *
    `
    user = updated[0]
  }

  return createSessionForUser(userFromRow(user))
}

export async function upsertProviderSession(input = {}) {
  const profile = sanitizeProviderAuthInput(input)
  const email = providerEmail(profile.provider, profile.providerUserId)
  const existing = await query`
    select * from users
    where (auth_provider = ${profile.provider} and provider_user_id = ${profile.providerUserId})
      or email = ${email}
    limit 1
  `
  let user = existing[0]

  if (!user) {
    const createdAt = nowIso()
    const inserted = await query`
      insert into users (
        id, email, display_name, role, verification_status, password_hash,
        phone, school_or_company, city, bio, avatar_url, auth_provider, provider_user_id,
        email_verified_at, created_at, updated_at
      )
      values (
        ${createId('usr')}, ${email}, ${profile.displayName}, ${profile.role}, 'unverified', null,
        ${profile.phone}, ${profile.schoolOrCompany}, ${profile.city}, ${profile.bio}, ${profile.avatarUrl},
        ${profile.provider}, ${profile.providerUserId}, ${createdAt}, ${createdAt}, ${createdAt}
      )
      returning *
    `
    user = inserted[0]
  } else {
    const updatedAt = nowIso()
    const updated = await query`
      update users
      set
        display_name = coalesce(nullif(display_name, ''), ${profile.displayName}),
        phone = coalesce(nullif(phone, ''), ${profile.phone}),
        school_or_company = coalesce(nullif(school_or_company, ''), ${profile.schoolOrCompany}),
        city = coalesce(nullif(city, ''), ${profile.city}),
        bio = coalesce(nullif(bio, ''), ${profile.bio}),
        avatar_url = coalesce(nullif(avatar_url, ''), ${profile.avatarUrl}),
        auth_provider = ${profile.provider},
        provider_user_id = ${profile.providerUserId},
        email_verified_at = coalesce(email_verified_at, ${updatedAt}),
        updated_at = ${updatedAt}
      where id = ${user.id}
      returning *
    `
    user = updated[0]
  }

  return createSessionForUser(userFromRow(user))
}

export async function requestPasswordReset(input = {}) {
  const email = validateEmail(input.email)
  const rows = await query`
    select * from users
    where email = ${email}
      and password_hash is not null
    limit 1
  `
  const user = rows[0]
  const publicDelivery = {
    provider: 'email',
    delivered: false,
    mock: false,
    message: '如果这个邮箱已注册，我们会发送一封密码重置邮件。',
  }
  const expiresAt = passwordResetExpiresAt()

  if (user) {
    const code = createEmailVerificationCode()
    const createdAt = nowIso()
    await sendPasswordReset({ to: email, code })
    await query`
      insert into password_reset_tokens (id, user_id, email, code_hash, created_at, expires_at)
      values (${createId('prt')}, ${user.id}, ${email}, ${hashToken(code)}, ${createdAt}, ${expiresAt})
    `
  }

  return {
    passwordReset: {
      status: 'pending',
      email,
      expiresAt,
      delivery: publicDelivery,
    },
  }
}

export async function confirmPasswordReset(input = {}) {
  const email = validateEmail(input.email)
  const password = validatePassword(input.password || input.newPassword)
  const code = validateEmailVerificationCode(input.code)
  const rows = await query`
    select * from password_reset_tokens
    where email = ${email}
      and code_hash = ${hashToken(code)}
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  `

  if (!rows[0]) {
    throw new HttpError(400, 'invalid_password_reset_code', '验证码不正确或已过期，请重新发送。')
  }

  const resetAt = nowIso()
  const passwordHash = hashPassword(password)
  await query`
    update password_reset_tokens
    set used_at = ${resetAt}
    where id = ${rows[0].id}
  `
  const updated = await query`
    update users
    set
      password_hash = ${passwordHash},
      auth_provider = 'password',
      provider_user_id = '',
      email_verified_at = coalesce(email_verified_at, ${resetAt}),
      updated_at = ${resetAt}
    where id = ${rows[0].user_id}
    returning *
  `
  await query`delete from sessions where user_id = ${rows[0].user_id}`

  const user = userFromRow(updated[0])
  return {
    user: publicUser(user),
    passwordReset: {
      status: 'reset',
      email: user.email,
      resetAt,
    },
  }
}

export async function getSessionByToken(token) {
  const rows = await query`
    select
      sessions.id as session_id,
      sessions.expires_at as session_expires_at,
      users.*
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ${hashToken(token)}
      and sessions.expires_at > now()
    limit 1
  `

  if (!rows[0]) {
    throw new HttpError(401, 'invalid_session', '登录状态已失效，请重新登录。')
  }

  await query`
    update sessions set last_seen_at = ${nowIso()}
    where id = ${rows[0].session_id}
  `

  return {
    user: publicUser(userFromRow(rows[0])),
    session: {
      id: rows[0].session_id,
      token: null,
      tokenType: 'Bearer',
      expiresAt: toIso(rows[0].session_expires_at),
      mode: rows[0].auth_provider || 'password',
      provider: rows[0].auth_provider || 'password',
    },
  }
}

export async function requestEmailVerification(token) {
  const current = await getSessionByToken(token)
  const user = await ensureUser(current.user.id)

  if (user.emailVerifiedAt) {
    return {
      user: publicUser(user),
      emailVerification: {
        status: 'verified',
        email: user.email,
        expiresAt: null,
        delivery: null,
      },
    }
  }

  const code = createEmailVerificationCode()
  const createdAt = nowIso()
  const expiresAt = emailVerificationExpiresAt()
  const delivery = await sendEmailVerification({ to: user.email, code })

  await query`
    insert into email_verification_tokens (id, user_id, email, code_hash, created_at, expires_at)
    values (${createId('evt')}, ${user.id}, ${user.email}, ${hashToken(code)}, ${createdAt}, ${expiresAt})
  `

  return {
    user: publicUser(user),
    emailVerification: {
      status: 'pending',
      email: user.email,
      expiresAt,
      delivery,
    },
  }
}

export async function confirmEmailVerification(token, input = {}) {
  const current = await getSessionByToken(token)
  const user = await ensureUser(current.user.id)

  if (user.emailVerifiedAt) {
    return {
      user: publicUser(user),
      emailVerification: {
        status: 'verified',
        email: user.email,
        verifiedAt: user.emailVerifiedAt,
      },
    }
  }

  const code = validateEmailVerificationCode(input.code)
  const rows = await query`
    select * from email_verification_tokens
    where user_id = ${user.id}
      and email = ${user.email}
      and code_hash = ${hashToken(code)}
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  `

  if (!rows[0]) {
    throw new HttpError(400, 'invalid_email_code', '验证码不正确或已过期，请重新发送。')
  }

  const verifiedAt = nowIso()
  await query`
    update email_verification_tokens
    set used_at = ${verifiedAt}
    where id = ${rows[0].id}
  `
  const updated = await query`
    update users
    set email_verified_at = ${verifiedAt}, updated_at = ${verifiedAt}
    where id = ${user.id}
    returning *
  `

  const refreshed = userFromRow(updated[0])
  return {
    user: publicUser(refreshed),
    emailVerification: {
      status: 'verified',
      email: refreshed.email,
      verifiedAt,
    },
  }
}

export async function deleteUserAccount(token) {
  const current = await getSessionByToken(token)
  const userId = current.user.id
  const linkedRows = await Promise.all([
    query`select id from services where seller_id = ${userId} limit 1`,
    query`select id from orders where buyer_id = ${userId} or seller_id = ${userId} limit 1`,
    query`select id from payments where buyer_id = ${userId} or seller_id = ${userId} limit 1`,
    query`select id from messages where sender_id = ${userId} limit 1`,
  ])

  if (linkedRows.some((rows) => rows.length > 0)) {
    throw new HttpError(409, 'account_has_linked_work', '这个账号已经有关联服务、订单或消息，暂时不能直接注销。')
  }

  await query`delete from users where id = ${userId}`

  return {
    deleted: true,
    userId,
  }
}

export async function updateUserProfile(token, input = {}) {
  const current = await getSessionByToken(token)
  const profile = sanitizeProfileInput(
    {
      displayName: input.displayName ?? current.user.displayName,
      role: input.role ?? current.user.role,
      phone: input.phone ?? current.user.phone,
      schoolOrCompany: input.schoolOrCompany ?? current.user.schoolOrCompany,
      city: input.city ?? current.user.city,
      bio: input.bio ?? current.user.bio,
      avatarUrl: input.avatarUrl ?? current.user.avatarUrl,
    },
    current.user.email,
    current.user.role,
  )
  const updatedAt = nowIso()
  const rows = await query`
    update users
    set
      display_name = ${profile.displayName},
      role = ${profile.role},
      phone = ${profile.phone},
      school_or_company = ${profile.schoolOrCompany},
      city = ${profile.city},
      bio = ${profile.bio},
      avatar_url = ${profile.avatarUrl},
      updated_at = ${updatedAt}
    where id = ${current.user.id}
    returning *
  `

  return {
    user: publicUser(userFromRow(rows[0])),
    session: current.session,
  }
}

export async function listServices({ category, status = 'published', sellerId } = {}) {
  const rows = await query`select * from services order by created_at desc limit 200`
  const filtered = rows
    .map(serviceFromRow)
    .filter((service) => (category ? service.category === category : true))
    .filter((service) => (status ? service.status === status : true))
    .filter((service) => (sellerId ? service.sellerId === sellerId : true))

  return Promise.all(filtered.map(withSeller))
}

export async function getService(id) {
  const rows = await query`select * from services where id = ${id} limit 1`
  if (!rows[0]) {
    throw new HttpError(404, 'service_not_found', '没有找到这个服务。')
  }
  return withSeller(serviceFromRow(rows[0]))
}

export async function createService(input) {
  if (!input.title || !input.category || !input.summary) {
    throw new HttpError(400, 'missing_fields', '服务标题、分类和简介不能为空。')
  }

  const priceCents = Number(input.priceCents || 0)
  const deliveryDays = Number(input.deliveryDays || 7)

  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw new HttpError(400, 'invalid_price', '服务价格必须大于 0。')
  }

  if (!Number.isFinite(deliveryDays) || deliveryDays <= 0) {
    throw new HttpError(400, 'invalid_delivery_days', '交付周期必须大于 0。')
  }

  const sellerId = input.sellerId || 'usr_demo_seller'
  await ensureUser(sellerId)

  const createdAt = nowIso()
  const status = serviceStatuses.includes(input.status) ? input.status : 'draft'
  const tags = Array.isArray(input.tags) ? input.tags.map(String).slice(0, 8) : []
  const rows = await query`
    insert into services (
      id, seller_id, category, title, summary, price_cents, currency, delivery_days, status, tags, created_at, updated_at
    )
    values (
      ${createId('svc')}, ${sellerId}, ${String(input.category).trim()}, ${String(input.title).trim()},
      ${String(input.summary).trim()}, ${priceCents}, ${input.currency || 'CNY'}, ${deliveryDays},
      ${status}, ${tags}, ${createdAt}, ${createdAt}
    )
    returning *
  `

  return withSeller(serviceFromRow(rows[0]))
}

export async function listOrders({ userId, status } = {}) {
  const rows = await query`select * from orders order by created_at desc limit 200`
  const filtered = rows
    .map(orderFromRow)
    .filter((order) => (userId ? order.buyerId === userId || order.sellerId === userId : true))
    .filter((order) => (status ? order.status === status : true))

  return Promise.all(filtered.map(withOrderRelations))
}

export async function getOrder(id) {
  const order = await findOrder(id)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }
  return withOrderRelations(order)
}

export async function createOrder(input) {
  const service = await selectService(input)

  if (!service) {
    throw new HttpError(400, 'invalid_service', '暂时没有可下单服务。')
  }

  if (!input.brief) {
    throw new HttpError(400, 'missing_brief', '请填写需求简介。')
  }

  const buyerId = input.buyerId || 'usr_demo_buyer'
  await ensureUser(buyerId)
  await ensureUser(service.sellerId)

  const budgetCents = Number(input.budgetCents || service.priceCents)
  if (!Number.isFinite(budgetCents) || budgetCents <= 0) {
    throw new HttpError(400, 'invalid_budget', '订单预算必须大于 0。')
  }

  const createdAt = nowIso()
  const rows = await query`
    insert into orders (
      id, service_id, buyer_id, seller_id, title, brief, budget_cents, currency,
      status, payment_status, verification_required, created_at, updated_at
    )
    values (
      ${createId('ord')}, ${service.id}, ${buyerId}, ${service.sellerId}, ${input.title || service.title},
      ${String(input.brief).trim()}, ${budgetCents}, ${input.currency || service.currency || 'CNY'},
      'submitted', 'mock_pending', ${Boolean(input.verificationRequired)}, ${createdAt}, ${createdAt}
    )
    returning *
  `
  const order = orderFromRow(rows[0])

  await appendMessage({
    orderId: order.id,
    senderId: order.buyerId,
    body: `买家提交了需求：${order.brief}`,
    createdAt,
  })

  return withOrderRelations(order)
}

export async function updateOrder(id, input) {
  const order = await findOrder(id)

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  if (input.status !== undefined) {
    if (!orderStatuses.includes(input.status)) {
      throw new HttpError(400, 'invalid_status', '订单状态不合法。', { allowed: orderStatuses })
    }

    if (input.status !== order.status) {
      const allowedNextStatuses = orderStatusTransitions[order.status] || []
      if (!allowedNextStatuses.includes(input.status)) {
        throw new HttpError(409, 'invalid_status_transition', '订单不能跳过当前流程节点。', {
          current: order.status,
          allowed: allowedNextStatuses,
        })
      }

      order.status = input.status
      await appendSystemMessage(order.id, `订单状态更新为：${orderStatusLabels[order.status] || order.status}`)

      if (order.status === 'completed') {
        await releaseEscrowForOrder(order)
      }

      if (order.status === 'cancelled') {
        await refundEscrowForOrder(order)
      }
    }
  }

  if (input.paymentStatus !== undefined) {
    if (!orderPaymentStatuses.includes(input.paymentStatus)) {
      throw new HttpError(400, 'invalid_payment_status', '付款状态不合法。', { allowed: orderPaymentStatuses })
    }
    order.paymentStatus = input.paymentStatus
  }

  const updatedAt = nowIso()
  const rows = await query`
    update orders
    set status = ${order.status}, payment_status = ${order.paymentStatus}, updated_at = ${updatedAt}
    where id = ${order.id}
    returning *
  `

  return withOrderRelations(orderFromRow(rows[0]))
}

export async function listPayments({ orderId, status } = {}) {
  const rows = await query`select * from payments order by created_at desc limit 200`
  return rows
    .map(paymentFromRow)
    .filter((payment) => (orderId ? payment.orderId === orderId : true))
    .filter((payment) => (status ? payment.status === status : true))
    .map(withPaymentRelations)
}

export async function getPayment(id) {
  const rows = await query`select * from payments where id = ${id} limit 1`
  if (!rows[0]) {
    throw new HttpError(404, 'payment_not_found', '没有找到这笔付款。')
  }
  return withPaymentRelations(paymentFromRow(rows[0]))
}

export async function createPayment(input) {
  const order = await findOrder(input.orderId)

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到要付款的订单。')
  }

  if (order.status === 'cancelled') {
    throw new HttpError(409, 'order_cancelled', '订单已取消，不能继续付款。')
  }

  const existing = await latestPaymentForOrder(order.id)
  if (existing && ['held', 'released'].includes(existing.escrowStatus)) {
    return withPaymentRelations(existing)
  }

  const amountCents = Number(input.amountCents || order.budgetCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new HttpError(400, 'invalid_amount', '付款金额必须大于 0。')
  }

  const createdAt = nowIso()
  const rows = await query`
    insert into payments (
      id, order_id, buyer_id, seller_id, amount_cents, currency, provider, method,
      status, escrow_status, created_at, updated_at, confirmed_at
    )
    values (
      ${createId('pay')}, ${order.id}, ${order.buyerId}, ${order.sellerId}, ${amountCents},
      ${input.currency || order.currency || 'CNY'}, 'mock', ${input.method || 'alipay_mock'},
      'succeeded', 'held', ${createdAt}, ${createdAt}, ${createdAt}
    )
    returning *
  `

  await query`
    update orders set payment_status = 'mock_paid', updated_at = ${createdAt}
    where id = ${order.id}
  `
  await appendSystemMessage(order.id, '买家已完成模拟付款，资金进入 WhiteHive 托管。')

  return withPaymentRelations(paymentFromRow(rows[0]))
}

export async function listMessages(orderId) {
  if (!orderId) {
    throw new HttpError(400, 'missing_order_id', '缺少订单 ID。')
  }

  if (!(await findOrder(orderId))) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  const rows = await query`
    select * from messages
    where order_id = ${orderId}
    order by created_at asc
  `
  return Promise.all(rows.map((row) => withMessageRelations(messageFromRow(row))))
}

export async function createMessage(input) {
  const order = await findOrder(input.orderId)
  const text = String(input.body || '').trim()

  if (!input.orderId || !text) {
    throw new HttpError(400, 'missing_fields', '订单 ID 和消息内容不能为空。')
  }

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  if (text.length > 1000) {
    throw new HttpError(400, 'message_too_long', '单条留言最多 1000 个字符。')
  }

  const senderId = input.senderId || order.buyerId
  await ensureUser(senderId)
  return appendMessage({
    orderId: order.id,
    senderId,
    body: text,
    createdAt: nowIso(),
  })
}

export async function getVerificationProfile(userId = 'usr_demo_seller') {
  const user = await ensureUser(userId)
  const rows = await query`
    select * from verification_requests
    where user_id = ${user.id}
    order by created_at desc
    limit 10
  `
  const requests = rows.map(verificationRequestFromRow)

  return {
    user: publicUser(user),
    latestRequest: requests[0] ? sanitizeVerificationRequest(requests[0]) : null,
    history: requests.map(sanitizeVerificationRequest),
  }
}

export async function submitVerification(input) {
  const user = await ensureUser(input.userId || 'usr_demo_seller')
  const realName = String(input.realName || '').trim()
  const contactEmail = String(input.contactEmail || user.email || '').trim().toLowerCase()
  const idNumberLast4 = String(input.idNumberLast4 || '').replace(/[^\dXx]/g, '').slice(-4)

  if (realName.length < 2) {
    throw new HttpError(400, 'invalid_real_name', '请填写真实姓名或主体名称。')
  }

  if (idNumberLast4 && idNumberLast4.length !== 4) {
    throw new HttpError(400, 'invalid_id_number', '证件号码只需要提交后 4 位用于演示校验。')
  }

  if (!contactEmail.includes('@')) {
    throw new HttpError(400, 'invalid_contact_email', '请填写有效联系邮箱。')
  }

  const createdAt = nowIso()
  const rows = await query`
    insert into verification_requests (
      id, user_id, real_name, role, id_number_last4, contact_email, status, reviewer_note, created_at, updated_at
    )
    values (
      ${createId('ver')}, ${user.id}, ${realName}, ${input.role || user.role}, ${idNumberLast4},
      ${contactEmail}, 'pending', '', ${createdAt}, ${createdAt}
    )
    returning *
  `

  await query`update users set verification_status = 'pending' where id = ${user.id}`
  const refreshed = await ensureUser(user.id)

  return {
    user: publicUser(refreshed),
    request: sanitizeVerificationRequest(verificationRequestFromRow(rows[0])),
  }
}

export async function reviewVerification(id, input) {
  if (!verificationRequestStatuses.includes(input.status)) {
    throw new HttpError(400, 'invalid_verification_status', '实名认证审核状态不合法。', {
      allowed: verificationRequestStatuses,
    })
  }

  const rows = await query`
    update verification_requests
    set status = ${input.status}, reviewer_note = ${String(input.reviewerNote || '').trim()}, updated_at = ${nowIso()}
    where id = ${id}
    returning *
  `

  if (!rows[0]) {
    throw new HttpError(404, 'verification_not_found', '没有找到这条实名认证申请。')
  }

  const request = verificationRequestFromRow(rows[0])
  const verificationStatus =
    request.status === 'approved' ? 'verified' : request.status === 'rejected' ? 'rejected' : 'pending'

  await query`
    update users set verification_status = ${verificationStatus}
    where id = ${request.userId}
  `
  const user = await ensureUser(request.userId)

  return {
    user: publicUser(user),
    request: sanitizeVerificationRequest(request),
  }
}

async function selectService(input) {
  const rows = await query`select * from services where status = 'published' order by created_at desc limit 200`
  const services = rows.map(serviceFromRow)
  return (
    services.find((item) => item.id === input.serviceId) ||
    services.find((item) => item.category === input.category) ||
    services[0]
  )
}

async function findOrder(id) {
  const rows = await query`select * from orders where id = ${id} limit 1`
  return rows[0] ? orderFromRow(rows[0]) : null
}

async function ensureUser(id) {
  const rows = await query`select * from users where id = ${id} limit 1`
  if (!rows[0]) {
    throw new HttpError(404, 'user_not_found', '没有找到这个用户。')
  }
  return userFromRow(rows[0])
}

async function appendSystemMessage(orderId, body) {
  return appendMessage({
    orderId,
    senderId: 'usr_system',
    body,
    createdAt: nowIso(),
  })
}

async function appendMessage({ orderId, senderId, body, createdAt }) {
  const rows = await query`
    insert into messages (id, order_id, sender_id, body, created_at)
    values (${createId('msg')}, ${orderId}, ${senderId}, ${body}, ${createdAt})
    returning *
  `
  return withMessageRelations(messageFromRow(rows[0]))
}

async function latestPaymentForOrder(orderId) {
  const rows = await query`
    select * from payments
    where order_id = ${orderId}
    order by created_at desc
    limit 1
  `
  return rows[0] ? paymentFromRow(rows[0]) : null
}

async function releaseEscrowForOrder(order) {
  const payment = await latestPaymentForOrder(order.id)
  if (!payment || payment.escrowStatus !== 'held') return

  const releasedAt = nowIso()
  await query`
    update payments
    set escrow_status = 'released', updated_at = ${releasedAt}, released_at = ${releasedAt}
    where id = ${payment.id}
  `
  order.paymentStatus = 'mock_released'
  await appendSystemMessage(order.id, '买家已确认验收，模拟托管款已释放给卖家。')
}

async function refundEscrowForOrder(order) {
  const payment = await latestPaymentForOrder(order.id)
  if (!payment || payment.escrowStatus !== 'held') return

  const refundedAt = nowIso()
  await query`
    update payments
    set escrow_status = 'refunded', updated_at = ${refundedAt}, refunded_at = ${refundedAt}
    where id = ${payment.id}
  `
  order.paymentStatus = 'mock_refunded'
  await appendSystemMessage(order.id, '订单已取消，模拟托管款已退回买家。')
}

async function withSeller(service) {
  const seller = await ensureUser(service.sellerId).catch(() => null)
  return {
    ...service,
    seller: seller
      ? {
          id: seller.id,
          displayName: seller.displayName,
          avatarUrl: seller.avatarUrl || '',
          role: seller.role,
          verificationStatus: seller.verificationStatus,
        }
      : null,
  }
}

async function withOrderRelations(order) {
  const [serviceRows, messageRows, payment] = await Promise.all([
    query`select * from services where id = ${order.serviceId} limit 1`,
    query`select id from messages where order_id = ${order.id}`,
    latestPaymentForOrder(order.id),
  ])

  const [buyer, seller] = await Promise.all([
    ensureUser(order.buyerId).catch(() => null),
    ensureUser(order.sellerId).catch(() => null),
  ])

  const service = serviceRows[0] ? serviceFromRow(serviceRows[0]) : null

  return {
    ...order,
    service: service ? { id: service.id, title: service.title, category: service.category } : null,
    buyer: buyer ? publicUser(buyer) : null,
    seller: seller ? publicUser(seller) : null,
    payment: payment ? summarizePayment(payment) : null,
    messageCount: messageRows.length,
  }
}

function withPaymentRelations(payment) {
  return payment
}

async function withMessageRelations(message) {
  const sender = await ensureUser(message.senderId).catch(() => null)
  return {
    ...message,
    sender: sender
      ? {
          id: sender.id,
          displayName: sender.displayName,
          avatarUrl: sender.avatarUrl || '',
          role: sender.role,
        }
      : null,
  }
}

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    phone: user.phone || '',
    schoolOrCompany: user.schoolOrCompany || '',
    city: user.city || '',
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || '',
    authProvider: user.authProvider || 'password',
    verificationStatus: verificationStatuses.includes(user.verificationStatus)
      ? user.verificationStatus
      : 'unverified',
    emailVerified: Boolean(user.emailVerifiedAt),
    emailVerifiedAt: user.emailVerifiedAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt || user.createdAt,
  }
}

async function createSessionForUser(user) {
  const token = createSessionToken()
  const createdAt = nowIso()
  const expiresAt = sessionExpiresAt()
  const rows = await query`
    insert into sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
    values (${createId('ses')}, ${user.id}, ${hashToken(token)}, ${createdAt}, ${expiresAt}, ${createdAt})
    returning *
  `
  const session = rows[0]

  return {
    user: publicUser(user),
    session: {
      id: session.id,
      token,
      tokenType: 'Bearer',
      expiresAt: toIso(session.expires_at),
      mode: user.authProvider || 'password',
      provider: user.authProvider || 'password',
    },
  }
}

function summarizePayment(payment) {
  return {
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    provider: payment.provider,
    method: payment.method,
    status: payment.status,
    escrowStatus: payment.escrowStatus,
    createdAt: payment.createdAt,
    confirmedAt: payment.confirmedAt,
    releasedAt: payment.releasedAt,
    refundedAt: payment.refundedAt,
  }
}

function sanitizeVerificationRequest(request) {
  return {
    id: request.id,
    userId: request.userId,
    realName: request.realName,
    role: request.role,
    idNumberLast4: request.idNumberLast4,
    contactEmail: request.contactEmail,
    status: request.status,
    reviewerNote: request.reviewerNote,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

function userFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    phone: row.phone || '',
    schoolOrCompany: row.school_or_company || '',
    city: row.city || '',
    bio: row.bio || '',
    avatarUrl: row.avatar_url || '',
    authProvider: row.auth_provider || 'password',
    providerUserId: row.provider_user_id || '',
    verificationStatus: row.verification_status,
    emailVerifiedAt: toIso(row.email_verified_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at) || toIso(row.created_at),
  }
}

function serviceFromRow(row) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    category: row.category,
    title: row.title,
    summary: row.summary,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    deliveryDays: Number(row.delivery_days),
    status: row.status,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function orderFromRow(row) {
  return {
    id: row.id,
    serviceId: row.service_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    title: row.title,
    brief: row.brief,
    budgetCents: Number(row.budget_cents),
    currency: row.currency,
    status: row.status,
    paymentStatus: row.payment_status,
    verificationRequired: Boolean(row.verification_required),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function paymentFromRow(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    provider: row.provider,
    method: row.method,
    status: row.status,
    escrowStatus: row.escrow_status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    confirmedAt: toIso(row.confirmed_at),
    releasedAt: toIso(row.released_at),
    refundedAt: toIso(row.refunded_at),
  }
}

function messageFromRow(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: toIso(row.created_at),
  }
}

function verificationRequestFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    realName: row.real_name,
    role: row.role,
    idNumberLast4: row.id_number_last4,
    contactEmail: row.contact_email,
    status: row.status,
    reviewerNote: row.reviewer_note,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function toIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}
