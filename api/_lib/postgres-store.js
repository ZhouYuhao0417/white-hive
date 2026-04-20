import { neon } from '@neondatabase/serverless'
import { createId, nowIso } from './ids.js'
import {
  createEmailVerificationCode,
  createPhoneVerificationCode,
  createSessionToken,
  emailVerificationExpiresAt,
  hashPassword,
  hashToken,
  isSyntheticAuthEmail,
  passwordResetExpiresAt,
  phoneVerificationExpiresAt,
  providerEmail,
  sanitizeProfileInput,
  sanitizeProviderAuthInput,
  sessionExpiresAt,
  validateEmailVerificationCode,
  validateEmail,
  validatePassword,
  validatePhone,
  validatePhoneVerificationCode,
  verifyPassword,
} from './auth.js'
import { sendEmailVerification, sendPasswordReset } from './email.js'
import {
  assertEscrowPaymentCanBeRecorded,
  createWechatPayRefund,
  createWechatPayTransaction,
} from './payment-gateway.js'
import { directSettlementMessage, paymentStatusForService } from './payment-policy.js'
import { sendSmsVerification } from './sms.js'
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
const orderPaymentStatuses = [
  'mock_pending',
  'mock_paid',
  'mock_released',
  'mock_refunded',
  'mock_failed',
  'direct_settlement',
  'payment_pending',
  'payment_held',
  'payment_released',
  'payment_refunded',
  'payment_refund_pending',
  'payment_failed',
]
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
  await db`alter table users add column if not exists phone_verified_at timestamptz`
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
        check (payment_status in ('mock_pending', 'mock_paid', 'mock_released', 'mock_refunded', 'mock_failed', 'direct_settlement', 'payment_pending', 'payment_held', 'payment_released', 'payment_refunded', 'payment_refund_pending', 'payment_failed')),
      verification_required boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `

  await db`alter table orders drop constraint if exists orders_payment_status_check`
  await db`
    alter table orders add constraint orders_payment_status_check
    check (payment_status in ('mock_pending', 'mock_paid', 'mock_released', 'mock_refunded', 'mock_failed', 'direct_settlement', 'payment_pending', 'payment_held', 'payment_released', 'payment_refunded', 'payment_refund_pending', 'payment_failed'))
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
        check (status in ('pending', 'succeeded', 'failed', 'refund_pending', 'refunded')),
      escrow_status text not null default 'held'
        check (escrow_status in ('none', 'held', 'released', 'refunded')),
      provider_payment_id text not null default '',
      checkout_url text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      confirmed_at timestamptz,
      released_at timestamptz,
      refunded_at timestamptz
    )
  `

  await db`alter table payments drop constraint if exists payments_status_check`
  await db`alter table payments add constraint payments_status_check check (status in ('pending', 'succeeded', 'failed', 'refund_pending', 'refunded'))`
  await db`alter table payments drop constraint if exists payments_escrow_status_check`
  await db`alter table payments add constraint payments_escrow_status_check check (escrow_status in ('none', 'held', 'released', 'refunded'))`
  await db`alter table payments add column if not exists provider_payment_id text not null default ''`
  await db`alter table payments add column if not exists checkout_url text not null default ''`

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
      verification_type text not null default 'individual',
      id_number_last4 text not null default '',
      student_id text not null default '',
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
    )
  `

  await db`alter table verification_requests add column if not exists verification_type text not null default 'individual'`
  await db`alter table verification_requests add column if not exists student_id text not null default ''`
  await db`alter table verification_requests add column if not exists school_or_company text not null default ''`
  await db`alter table verification_requests add column if not exists city text not null default ''`
  await db`alter table verification_requests add column if not exists evidence_url text not null default ''`
  await db`alter table verification_requests add column if not exists reviewed_at timestamptz`

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
    create table if not exists phone_verification_tokens (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      phone text not null,
      code_hash text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at timestamptz,
      attempts int not null default 0
    )
  `

  await db`
    create table if not exists phone_login_tokens (
      id text primary key,
      phone text not null,
      code_hash text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at timestamptz,
      attempts int not null default 0
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
  await db`create index if not exists phone_verification_tokens_user_idx on phone_verification_tokens(user_id, expires_at)`
  await db`create index if not exists phone_login_tokens_phone_idx on phone_login_tokens(phone, expires_at)`
  await db`create index if not exists password_reset_tokens_email_idx on password_reset_tokens(email, expires_at)`
  await db`
    create index if not exists users_verified_phone_lookup_idx
    on users(phone)
    where phone <> '' and phone_verified_at is not null
  `
  await db`
    create unique index if not exists users_verified_phone_unique_idx
    on users(phone)
    where phone <> '' and phone_verified_at is not null
  `
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
      'oauth_login',
      'sessions',
      'email_verification',
      'phone_verification',
      'phone_login',
      'password_reset',
      'resend_email_ready',
      'blob_avatar_ready',
      'orders',
      'messages',
      'mock_payments',
      'payment_policy',
      'wechatpay_checkout',
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

export async function requestPhoneLogin(input = {}) {
  const phone = validatePhone(input.phone)
  const nowMs = Date.now()

  await query`
    delete from phone_login_tokens
    where created_at < now() - interval '24 hours'
  `

  const recent = await query`
    select * from phone_login_tokens
    where phone = ${phone}
      and created_at >= now() - interval '24 hours'
    order by created_at desc
  `

  const last = recent[0]
  if (last) {
    const elapsed = nowMs - new Date(last.created_at).getTime()
    if (elapsed < PHONE_RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((PHONE_RESEND_COOLDOWN_MS - elapsed) / 1000)
      throw new HttpError(
        429,
        'phone_login_throttled',
        `请求太快了, 请 ${retryAfterSec} 秒后再试。`,
        { retryAfterSec },
      )
    }
  }

  if (recent.length >= PHONE_DAILY_QUOTA) {
    throw new HttpError(
      429,
      'phone_login_quota_exceeded',
      '今天发送的短信验证码已达上限, 请明天再试。',
    )
  }

  const code = createPhoneVerificationCode()
  const createdAt = nowIso()
  const expiresAt = phoneVerificationExpiresAt()
  const delivery = await sendSmsVerification({ to: phone, code })

  if (!delivery?.delivered && !delivery?.mock) {
    return {
      phoneLogin: {
        status: 'unavailable',
        phone,
        delivery,
      },
    }
  }

  await query`
    insert into phone_login_tokens (id, phone, code_hash, created_at, expires_at, attempts)
    values (${createId('plt')}, ${phone}, ${hashToken(code)}, ${createdAt}, ${expiresAt}, 0)
  `

  if (delivery?.mock) {
    console.warn(`[whitehive-sms] mock phone login code for ${phone}: ${code}`)
  }

  return {
    phoneLogin: {
      status: 'pending',
      phone,
      expiresAt,
      delivery,
    },
  }
}

export async function confirmPhoneLogin(input = {}) {
  const phone = validatePhone(input.phone)
  const code = validatePhoneVerificationCode(input.code)

  const rows = await query`
    select * from phone_login_tokens
    where phone = ${phone}
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  `

  const challenge = rows[0]
  if (!challenge) {
    throw new HttpError(400, 'invalid_phone_code', '验证码不正确或已过期, 请重新发送。')
  }

  if (challenge.attempts >= PHONE_MAX_ATTEMPTS) {
    throw new HttpError(
      400,
      'phone_login_too_many_attempts',
      '输入错误次数过多, 请重新发送验证码。',
    )
  }

  if (challenge.code_hash !== hashToken(code)) {
    const nextAttempts = challenge.attempts + 1
    await query`
      update phone_login_tokens
      set attempts = ${nextAttempts}
      where id = ${challenge.id}
    `
    throw new HttpError(400, 'invalid_phone_code', '验证码不正确, 请重新输入。', {
      attemptsLeft: Math.max(0, PHONE_MAX_ATTEMPTS - nextAttempts),
    })
  }

  const verifiedAt = nowIso()
  await query`
    update phone_login_tokens
    set used_at = ${verifiedAt}
    where id = ${challenge.id}
  `

  const profile = sanitizeProviderAuthInput({
    provider: 'phone',
    providerUserId: phone,
    role: input.role,
    phone,
    displayName: input.displayName || `手机尾号${phone.slice(-4)}用户`,
  })
  const email = providerEmail('phone', phone)
  const existing = await query`
    select * from users
    where (phone = ${phone} and phone_verified_at is not null)
      or (auth_provider = 'phone' and provider_user_id = ${phone})
      or email = ${email}
    order by
      case when phone = ${phone} and phone_verified_at is not null then 0 else 1 end,
      created_at asc
    limit 1
  `
  let user = existing[0]

  if (!user) {
    const inserted = await query`
      insert into users (
        id, email, display_name, role, verification_status, password_hash,
        phone, school_or_company, city, bio, avatar_url, auth_provider, provider_user_id,
        email_verified_at, phone_verified_at, created_at, updated_at
      )
      values (
        ${createId('usr')}, ${email}, ${profile.displayName}, ${profile.role}, 'unverified', null,
        ${phone}, ${profile.schoolOrCompany}, ${profile.city}, ${profile.bio}, ${profile.avatarUrl},
        'phone', ${phone}, null, ${verifiedAt}, ${verifiedAt}, ${verifiedAt}
      )
      returning *
    `
    user = inserted[0]
  } else {
    const updated = await query`
      update users
      set
        phone = ${phone},
        phone_verified_at = coalesce(phone_verified_at, ${verifiedAt}),
        auth_provider = coalesce(nullif(auth_provider, ''), 'phone'),
        provider_user_id = case
          when coalesce(provider_user_id, '') = ''
            and coalesce(auth_provider, '') in ('', 'phone') then ${phone}
          else provider_user_id
        end,
        display_name = coalesce(nullif(display_name, ''), ${profile.displayName}),
        updated_at = ${verifiedAt}
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

const PHONE_RESEND_COOLDOWN_MS = 60 * 1000
const PHONE_DAILY_QUOTA = 5
const PHONE_MAX_ATTEMPTS = 5

export async function requestPhoneVerification(token, input = {}) {
  const current = await getSessionByToken(token)
  const user = await ensureUser(current.user.id)
  const phone = validatePhone(input.phone || user.phone)
  const nowMs = Date.now()

  if (user.phone === phone && user.phoneVerifiedAt) {
    return {
      user: publicUser(user),
      phoneVerification: {
        status: 'verified',
        phone,
        verifiedAt: user.phoneVerifiedAt,
        delivery: null,
      },
    }
  }

  const alreadyVerified = await query`
    select id from users
    where phone = ${phone}
      and phone_verified_at is not null
      and id <> ${user.id}
    limit 1
  `

  if (alreadyVerified[0]) {
    throw new HttpError(409, 'phone_already_verified', '这个手机号已经绑定到其他账号。')
  }

  await query`
    delete from phone_verification_tokens
    where created_at < now() - interval '24 hours'
  `

  const recent = await query`
    select * from phone_verification_tokens
    where user_id = ${user.id}
      and phone = ${phone}
      and created_at >= now() - interval '24 hours'
    order by created_at desc
  `

  const last = recent[0]
  if (last) {
    const elapsed = nowMs - new Date(last.created_at).getTime()
    if (elapsed < PHONE_RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((PHONE_RESEND_COOLDOWN_MS - elapsed) / 1000)
      throw new HttpError(
        429,
        'phone_verification_throttled',
        `请求太快了, 请 ${retryAfterSec} 秒后再试。`,
        { retryAfterSec },
      )
    }
  }

  if (recent.length >= PHONE_DAILY_QUOTA) {
    throw new HttpError(
      429,
      'phone_verification_quota_exceeded',
      '今天发送的短信验证码已达上限, 请明天再试。',
    )
  }

  const code = createPhoneVerificationCode()
  const createdAt = nowIso()
  const expiresAt = phoneVerificationExpiresAt()
  const delivery = await sendSmsVerification({ to: phone, code })

  if (!delivery?.delivered && !delivery?.mock) {
    return {
      user: publicUser(user),
      phoneVerification: {
        status: 'unavailable',
        phone,
        delivery,
      },
    }
  }

  await query`
    insert into phone_verification_tokens (id, user_id, phone, code_hash, created_at, expires_at, attempts)
    values (${createId('pvt')}, ${user.id}, ${phone}, ${hashToken(code)}, ${createdAt}, ${expiresAt}, 0)
  `

  if (delivery?.mock) {
    console.warn(`[whitehive-sms] mock code for ${phone}: ${code}`)
  }

  return {
    user: publicUser(user),
    phoneVerification: {
      status: 'pending',
      phone,
      expiresAt,
      delivery,
    },
  }
}

export async function confirmPhoneVerification(token, input = {}) {
  const current = await getSessionByToken(token)
  const user = await ensureUser(current.user.id)
  const phone = validatePhone(input.phone || user.phone)
  const code = validatePhoneVerificationCode(input.code)

  const alreadyVerified = await query`
    select id from users
    where phone = ${phone}
      and phone_verified_at is not null
      and id <> ${user.id}
    limit 1
  `

  if (alreadyVerified[0]) {
    throw new HttpError(409, 'phone_already_verified', '这个手机号已经绑定到其他账号。')
  }

  const rows = await query`
    select * from phone_verification_tokens
    where user_id = ${user.id}
      and phone = ${phone}
      and used_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  `

  const challenge = rows[0]
  if (!challenge) {
    throw new HttpError(400, 'invalid_phone_code', '验证码不正确或已过期, 请重新发送。')
  }

  if (challenge.attempts >= PHONE_MAX_ATTEMPTS) {
    throw new HttpError(
      400,
      'phone_verification_too_many_attempts',
      '输入错误次数过多, 请重新发送验证码。',
    )
  }

  if (challenge.code_hash !== hashToken(code)) {
    const nextAttempts = challenge.attempts + 1
    await query`
      update phone_verification_tokens
      set attempts = ${nextAttempts}
      where id = ${challenge.id}
    `
    throw new HttpError(400, 'invalid_phone_code', '验证码不正确, 请重新输入。', {
      attemptsLeft: Math.max(0, PHONE_MAX_ATTEMPTS - nextAttempts),
    })
  }

  const verifiedAt = nowIso()
  await query`
    update phone_verification_tokens
    set used_at = ${verifiedAt}
    where id = ${challenge.id}
  `
  const updated = await query`
    update users
    set phone = ${phone}, phone_verified_at = ${verifiedAt}, updated_at = ${verifiedAt}
    where id = ${user.id}
    returning *
  `

  const refreshed = userFromRow(updated[0])
  return {
    user: publicUser(refreshed),
    phoneVerification: {
      status: 'verified',
      phone,
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
  const seller = await ensureUser(sellerId)
  const category = String(input.category).trim()

  if (seller.role !== 'admin' && isCdutServiceCategory(category) && !(await hasApprovedCampusVerification(sellerId))) {
    throw new HttpError(403, 'campus_verification_required', '发布成都理工校园服务前，请先完成卖家校园认证。')
  }

  const createdAt = nowIso()
  const status = serviceStatuses.includes(input.status) ? input.status : 'draft'
  const tags = Array.isArray(input.tags) ? input.tags.map(String).slice(0, 8) : []
  const rows = await query`
    insert into services (
      id, seller_id, category, title, summary, price_cents, currency, delivery_days, status, tags, created_at, updated_at
    )
    values (
      ${createId('svc')}, ${sellerId}, ${category}, ${String(input.title).trim()},
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
  const paymentStatus = paymentStatusForService(service)
  const rows = await query`
    insert into orders (
      id, service_id, buyer_id, seller_id, title, brief, budget_cents, currency,
      status, payment_status, verification_required, created_at, updated_at
    )
    values (
      ${createId('ord')}, ${service.id}, ${buyerId}, ${service.sellerId}, ${input.title || service.title},
      ${String(input.brief).trim()}, ${budgetCents}, ${input.currency || service.currency || 'CNY'},
      'submitted', ${paymentStatus}, ${Boolean(input.verificationRequired)}, ${createdAt}, ${createdAt}
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

  if (isCdutServiceCategory(service.category)) {
    await appendSystemMessage(order.id, directSettlementMessage())
  }

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

  const service = await serviceForOrder(order)
  if (isCdutServiceCategory(service?.category)) {
    throw new HttpError(409, 'direct_settlement_order', directSettlementMessage())
  }

  const existing = await latestPaymentForOrder(order.id)
  if (existing && ['held', 'released'].includes(existing.escrowStatus)) {
    return withPaymentRelations(existing)
  }
  if (existing?.provider === 'wechatpay' && existing.status === 'pending' && existing.checkoutUrl) {
    return withPaymentRelations(existing)
  }

  const amountCents = Number(input.amountCents || order.budgetCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new HttpError(400, 'invalid_amount', '付款金额必须大于 0。')
  }

  const createdAt = nowIso()
  const paymentId = createId('pay')
  const gateway = assertEscrowPaymentCanBeRecorded()

  if (gateway.checkoutEnabled && gateway.provider === 'wechatpay') {
    const transaction = await createWechatPayTransaction({
      outTradeNo: paymentId,
      amountCents,
      currency: input.currency || order.currency || 'CNY',
      description: order.title,
      method: input.method,
      clientIp: input.clientIp,
    })
    const rows = await query`
      insert into payments (
        id, order_id, buyer_id, seller_id, amount_cents, currency, provider, method,
        status, escrow_status, provider_payment_id, checkout_url, created_at, updated_at
      )
      values (
        ${paymentId}, ${order.id}, ${order.buyerId}, ${order.sellerId}, ${amountCents},
        ${input.currency || order.currency || 'CNY'}, 'wechatpay', ${transaction.method},
        'pending', 'none', '', ${transaction.checkoutUrl || ''}, ${createdAt}, ${createdAt}
      )
      returning *
    `
    await query`
      update orders set payment_status = 'payment_pending', updated_at = ${createdAt}
      where id = ${order.id}
    `
    await appendSystemMessage(order.id, '买家已发起微信支付，等待微信支付成功回调后进入平台托管。')
    return withPaymentRelations(paymentFromRow(rows[0]))
  }

  const rows = await query`
    insert into payments (
      id, order_id, buyer_id, seller_id, amount_cents, currency, provider, method,
      status, escrow_status, created_at, updated_at, confirmed_at
    )
    values (
      ${paymentId}, ${order.id}, ${order.buyerId}, ${order.sellerId}, ${amountCents},
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

export async function confirmWechatPayment(input = {}) {
  const outTradeNo = String(input.outTradeNo || '').trim()
  if (!outTradeNo) {
    throw new HttpError(400, 'missing_out_trade_no', '缺少微信支付商户订单号。')
  }

  const rows = await query`
    select * from payments
    where id = ${outTradeNo} and provider = 'wechatpay'
    limit 1
  `
  const payment = rows[0] ? paymentFromRow(rows[0]) : null
  if (!payment) {
    throw new HttpError(404, 'payment_not_found', '没有找到这笔微信支付付款。')
  }
  if (input.amountCents !== undefined && Number(input.amountCents) !== payment.amountCents) {
    throw new HttpError(409, 'payment_amount_mismatch', '微信支付回调金额与订单金额不一致。')
  }

  const order = await findOrder(payment.orderId)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这笔付款对应的订单。')
  }

  const paidAt = input.successTime || nowIso()
  const updated = await query`
    update payments
    set
      status = 'succeeded',
      escrow_status = 'held',
      provider_payment_id = ${input.transactionId || payment.providerPaymentId || ''},
      updated_at = ${paidAt},
      confirmed_at = ${paidAt}
    where id = ${payment.id}
    returning *
  `
  await query`
    update orders set payment_status = 'payment_held', updated_at = ${paidAt}
    where id = ${order.id}
  `
  await appendSystemMessage(order.id, '微信支付已确认，资金进入 WhiteHive 托管。')

  return withPaymentRelations(paymentFromRow(updated[0]))
}

export async function confirmWechatRefund(input = {}) {
  const outTradeNo = String(input.outTradeNo || '').trim()
  if (!outTradeNo) {
    throw new HttpError(400, 'missing_out_trade_no', '缺少微信支付商户订单号。')
  }

  const rows = await query`
    select * from payments
    where id = ${outTradeNo} and provider = 'wechatpay'
    limit 1
  `
  const payment = rows[0] ? paymentFromRow(rows[0]) : null
  if (!payment) {
    throw new HttpError(404, 'payment_not_found', '没有找到这笔微信支付付款。')
  }

  const order = await findOrder(payment.orderId)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这笔付款对应的订单。')
  }

  const refundedAt = input.successTime || nowIso()
  const updated = await query`
    update payments
    set status = 'refunded', escrow_status = 'refunded', updated_at = ${refundedAt}, refunded_at = ${refundedAt}
    where id = ${payment.id}
    returning *
  `
  await query`
    update orders set payment_status = 'payment_refunded', updated_at = ${refundedAt}
    where id = ${order.id}
  `
  await appendSystemMessage(order.id, '微信支付退款已完成。')

  return withPaymentRelations(paymentFromRow(updated[0]))
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

export async function listVerificationRequests({ status = 'pending', limit = 50 } = {}) {
  if (status && status !== 'all' && !verificationRequestStatuses.includes(status)) {
    throw new HttpError(400, 'invalid_verification_status', '实名认证审核状态不合法。', {
      allowed: ['all', ...verificationRequestStatuses],
    })
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100))
  const rows =
    status && status !== 'all'
      ? await query`
          select
            vr.*,
            u.email as user_email,
            u.display_name as user_display_name,
            u.role as user_role,
            u.phone as user_phone,
            u.school_or_company as user_school_or_company,
            u.city as user_city,
            u.bio as user_bio,
            u.avatar_url as user_avatar_url,
            u.auth_provider as user_auth_provider,
            u.provider_user_id as user_provider_user_id,
            u.verification_status as user_verification_status,
            u.email_verified_at as user_email_verified_at,
            u.phone_verified_at as user_phone_verified_at,
            u.created_at as user_created_at,
            u.updated_at as user_updated_at
          from verification_requests vr
          left join users u on u.id = vr.user_id
          where vr.status = ${status}
          order by vr.created_at desc
          limit ${safeLimit}
        `
      : await query`
          select
            vr.*,
            u.email as user_email,
            u.display_name as user_display_name,
            u.role as user_role,
            u.phone as user_phone,
            u.school_or_company as user_school_or_company,
            u.city as user_city,
            u.bio as user_bio,
            u.avatar_url as user_avatar_url,
            u.auth_provider as user_auth_provider,
            u.provider_user_id as user_provider_user_id,
            u.verification_status as user_verification_status,
            u.email_verified_at as user_email_verified_at,
            u.phone_verified_at as user_phone_verified_at,
            u.created_at as user_created_at,
            u.updated_at as user_updated_at
          from verification_requests vr
          left join users u on u.id = vr.user_id
          order by vr.created_at desc
          limit ${safeLimit}
        `

  return rows.map((row) => ({
    ...sanitizeVerificationRequest(verificationRequestFromRow(row)),
    user: publicUser(userFromVerificationJoinRow(row)),
  }))
}

export async function submitVerification(input) {
  const user = await ensureUser(input.userId || 'usr_demo_seller')
  const realName = String(input.realName || '').trim()
  const contactEmail = String(input.contactEmail || user.email || '').trim().toLowerCase()
  const idNumberLast4 = String(input.idNumberLast4 || '').replace(/[^\dXx]/g, '').slice(-4)
  const verificationType = normalizeVerificationType(input.verificationType)
  const isCampus = verificationType === 'campus'
  const studentId = normalizeStudentId(input.studentId || input.schoolId || input.idNumberLast4)
  const schoolOrCompany = isCampus ? '成都理工大学' : limitText(input.schoolOrCompany || user.schoolOrCompany, 80)
  const city = isCampus ? '成都' : limitText(input.city || user.city, 40)
  const evidenceUrl = isCampus ? '' : sanitizeEvidenceUrl(input.evidenceUrl)

  if (realName.length < 2) {
    throw new HttpError(400, 'invalid_real_name', '请填写真实姓名或主体名称。')
  }

  if (isCampus && !['seller', 'admin'].includes(user.role)) {
    throw new HttpError(403, 'seller_campus_verification_only', '成都理工校园认证只面向卖家账号。买家登录后即可在校园专区交易。')
  }

  if (isCampus && studentId.length < 5) {
    throw new HttpError(400, 'invalid_student_id', '请填写有效学号。')
  }

  if (!isCampus && idNumberLast4 && idNumberLast4.length !== 4) {
    throw new HttpError(400, 'invalid_id_number', '证件号码只需要提交后 4 位用于演示校验。')
  }

  if (!isCampus && !contactEmail.includes('@')) {
    throw new HttpError(400, 'invalid_contact_email', '请填写有效联系邮箱。')
  }

  const createdAt = nowIso()
  const rows = await query`
    insert into verification_requests (
      id, user_id, real_name, role, verification_type, id_number_last4, student_id, contact_email,
      school_or_company, city, evidence_url, status, reviewer_note, created_at, updated_at
    )
    values (
      ${createId('ver')}, ${user.id}, ${realName}, ${input.role || user.role}, ${verificationType},
      ${idNumberLast4}, ${studentId}, ${contactEmail}, ${schoolOrCompany}, ${city}, ${evidenceUrl},
      'pending', '', ${createdAt}, ${createdAt}
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
    set
      status = ${input.status},
      reviewer_note = ${String(input.reviewerNote || '').trim()},
      reviewed_at = ${nowIso()},
      updated_at = ${nowIso()}
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

async function serviceForOrder(order) {
  const rows = await query`select * from services where id = ${order.serviceId} limit 1`
  return rows[0] ? serviceFromRow(rows[0]) : null
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
  order.paymentStatus = payment.provider === 'wechatpay' ? 'payment_released' : 'mock_released'
  await appendSystemMessage(
    order.id,
    payment.provider === 'wechatpay'
      ? '买家已确认验收，托管款等待平台按微信支付商户结算流程处理。'
      : '买家已确认验收，模拟托管款已释放给卖家。',
  )
}

async function refundEscrowForOrder(order) {
  const payment = await latestPaymentForOrder(order.id)
  if (!payment || payment.escrowStatus !== 'held') return

  const refundedAt = nowIso()
  if (payment.provider === 'wechatpay') {
    const refund = await createWechatPayRefund({
      outTradeNo: payment.id,
      outRefundNo: `rf_${payment.id}`,
      amountCents: payment.amountCents,
      currency: payment.currency,
      reason: 'WhiteHive 订单取消退款',
    })
    const refundFinished = refund.status === 'SUCCESS'
    await query`
      update payments
      set
        status = ${refundFinished ? 'refunded' : 'refund_pending'},
        escrow_status = ${refundFinished ? 'refunded' : 'held'},
        updated_at = ${refundedAt},
        refunded_at = ${refundFinished ? refundedAt : null}
      where id = ${payment.id}
    `
    order.paymentStatus = refundFinished ? 'payment_refunded' : 'payment_refund_pending'
    await appendSystemMessage(
      order.id,
      refundFinished
        ? '订单已取消，微信支付退款已受理完成。'
        : '订单已取消，微信支付退款申请已提交，等待微信支付处理结果。',
    )
    return
  }

  await query`
    update payments
    set status = 'refunded', escrow_status = 'refunded', updated_at = ${refundedAt}, refunded_at = ${refundedAt}
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
  const email = isSyntheticAuthEmail(user.email) ? '' : user.email
  const emailVerifiedAt = email ? user.emailVerifiedAt : null
  return {
    id: user.id,
    email,
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
    emailVerified: Boolean(emailVerifiedAt),
    emailVerifiedAt: emailVerifiedAt || null,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    phoneVerifiedAt: user.phoneVerifiedAt || null,
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
    providerPaymentId: payment.providerPaymentId || '',
    checkoutUrl: payment.checkoutUrl || '',
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
    verificationType: request.verificationType || 'individual',
    idNumberLast4: request.idNumberLast4,
    studentId: request.studentId || '',
    contactEmail: request.contactEmail,
    schoolOrCompany: request.schoolOrCompany || '',
    city: request.city || '',
    evidenceUrl: request.evidenceUrl || '',
    status: request.status,
    reviewerNote: request.reviewerNote,
    reviewedAt: request.reviewedAt || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

function normalizeVerificationType(value) {
  const text = String(value || '').trim()
  return ['individual', 'campus', 'studio', 'company'].includes(text) ? text : 'individual'
}

function normalizeStudentId(value) {
  return String(value || '').replace(/[^\dA-Za-z]/g, '').slice(0, 24)
}

function isCdutServiceCategory(category) {
  return String(category || '').trim().startsWith('cdut/')
}

async function hasApprovedCampusVerification(userId) {
  const rows = await query`
    select id from verification_requests
    where user_id = ${userId}
      and status = 'approved'
      and verification_type = 'campus'
      and school_or_company = '成都理工大学'
    limit 1
  `
  return Boolean(rows[0])
}

function limitText(value, maxLength) {
  const text = String(value || '').trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function sanitizeEvidenceUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^https:\/\/[^\s"'<>]+$/i.test(text)) return text.slice(0, 500)
  throw new HttpError(400, 'invalid_evidence_url', '辅助证明链接必须是 HTTPS 地址。')
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
    phoneVerifiedAt: toIso(row.phone_verified_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at) || toIso(row.created_at),
  }
}

function userFromVerificationJoinRow(row) {
  if (!row?.user_id || !row.user_email) return null
  return {
    id: row.user_id,
    email: row.user_email,
    displayName: row.user_display_name,
    role: row.user_role,
    phone: row.user_phone || '',
    schoolOrCompany: row.user_school_or_company || '',
    city: row.user_city || '',
    bio: row.user_bio || '',
    avatarUrl: row.user_avatar_url || '',
    authProvider: row.user_auth_provider || 'password',
    providerUserId: row.user_provider_user_id || '',
    verificationStatus: row.user_verification_status,
    emailVerifiedAt: toIso(row.user_email_verified_at),
    phoneVerifiedAt: toIso(row.user_phone_verified_at),
    createdAt: toIso(row.user_created_at),
    updatedAt: toIso(row.user_updated_at) || toIso(row.user_created_at),
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
    providerPaymentId: row.provider_payment_id || '',
    checkoutUrl: row.checkout_url || '',
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
    verificationType: row.verification_type || 'individual',
    idNumberLast4: row.id_number_last4,
    studentId: row.student_id || '',
    contactEmail: row.contact_email,
    schoolOrCompany: row.school_or_company || '',
    city: row.city || '',
    evidenceUrl: row.evidence_url || '',
    status: row.status,
    reviewerNote: row.reviewer_note,
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function toIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}
