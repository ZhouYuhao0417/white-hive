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
import { assertEscrowPaymentCanBeRecorded, createWechatPayTransaction } from './payment-gateway.js'
import { directSettlementMessage, paymentStatusForService } from './payment-policy.js'
import { sendSmsVerification } from './sms.js'
import {
  defaultUserStats,
  seedMessages,
  seedOrders,
  seedPayments,
  seedReviews,
  seedServices,
  seedUsers,
  seedVerificationRequests,
} from './seed.js'
import { HttpError } from './http.js'
import {
  applyEdit as applyReviewEdit,
  hasExistingReview,
  normalizeReview,
  publicReviewShape,
} from './reviews.js'
import { sellerLevelFor } from './profile-shape.js'

// Fallback adapter for local demos and deployments without DATABASE_URL.

const orderStatuses = ['submitted', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled']
const serviceStatuses = ['draft', 'pending_review', 'published', 'rejected', 'paused', 'archived']
const paymentStatuses = [
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
const rateLimitEventTtlMs = 24 * 60 * 60 * 1000

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

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createMemoryState() {
  return {
    users: clone(seedUsers),
    services: clone(seedServices),
    orders: clone(seedOrders),
    payments: clone(seedPayments),
    verificationRequests: clone(seedVerificationRequests),
    emailVerificationTokens: [],
    phoneVerificationTokens: [],
    phoneLoginTokens: [],
    passwordResetTokens: [],
    rateLimitEvents: [],
    notifications: [],
    messages: clone(seedMessages),
    reviews: clone(seedReviews),
    sessions: [],
  }
}

function freshUserStats() {
  return { ...defaultUserStats }
}

function ensureUserStats(user) {
  if (!user) return null
  if (!user.stats || typeof user.stats !== 'object') {
    user.stats = freshUserStats()
  } else {
    // 补齐缺失字段, 避免后续 undefined 干扰算术
    user.stats = { ...freshUserStats(), ...user.stats }
  }
  return user.stats
}

function getState() {
  if (!globalThis.__whitehiveMvpStore) {
    globalThis.__whitehiveMvpStore = createMemoryState()
  }
  return globalThis.__whitehiveMvpStore
}

export function storeInfo() {
  const hasDatabaseEnv = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGES_URL)
  return {
    driver: hasDatabaseEnv ? 'database-pending' : 'memory',
    persistent: false,
    note: hasDatabaseEnv
      ? '数据库连接变量已存在，但当前运行在内存适配器。'
      : '未配置数据库连接变量，当前使用内存种子数据，仅适合本地开发和接口联调。',
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
      'service_review',
      'inapp_notifications',
    ],
  }
}

export function checkRateLimit(input = {}) {
  const state = getState()
  if (!Array.isArray(state.rateLimitEvents)) {
    state.rateLimitEvents = []
  }

  const bucket = String(input.bucket || 'default').slice(0, 80)
  const identifierHash = hashToken(input.identifier || 'anonymous')
  const limit = Math.max(1, Number(input.limit || 10))
  const windowSeconds = Math.max(1, Number(input.windowSeconds || 60))
  const nowMs = Date.now()
  const windowStartMs = nowMs - windowSeconds * 1000

  state.rateLimitEvents = state.rateLimitEvents.filter((event) => {
    const createdAtMs = new Date(event.createdAt).getTime()
    return Number.isFinite(createdAtMs) && nowMs - createdAtMs < rateLimitEventTtlMs
  })

  const matchingEvents = state.rateLimitEvents
    .filter((event) => event.bucket === bucket && event.identifierHash === identifierHash)
    .filter((event) => new Date(event.createdAt).getTime() >= windowStartMs)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (matchingEvents.length >= limit) {
    const oldestMs = new Date(matchingEvents[0].createdAt).getTime()
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + windowSeconds * 1000 - nowMs) / 1000))
    throw new HttpError(429, 'rate_limited', input.message || '请求太频繁，请稍后再试。', {
      limit,
      windowSeconds,
      retryAfterSeconds,
    })
  }

  state.rateLimitEvents.push({
    id: createId('rl'),
    bucket,
    identifierHash,
    createdAt: nowIso(),
  })

  return {
    allowed: true,
    limit,
    windowSeconds,
    remaining: Math.max(0, limit - matchingEvents.length - 1),
  }
}

export function getDemoUser() {
  const user = getState().users.find((item) => item.id === 'usr_demo_buyer')
  return clone(publicUser(user))
}

export function upsertDemoSession(input = {}) {
  const state = getState()
  const normalizedEmail = validateEmail(input.email)
  const password = validatePassword(input.password)
  const profile = sanitizeProfileInput(input, normalizedEmail)
  const action = input.action || (input.mode === 'signin' ? 'signin' : 'signup')
  let user = state.users.find((item) => item.email === normalizedEmail)

  if (action === 'signin') {
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, 'invalid_credentials', '邮箱或密码不正确。')
    }

    return clone(createSessionForUser(user))
  }

  if (user?.passwordHash) {
    throw new HttpError(409, 'account_exists', '这个邮箱已经注册，请直接登录。')
  }

  if (!user) {
    user = {
      id: createId('usr'),
      email: normalizedEmail,
      displayName: profile.displayName,
      role: profile.role,
      verificationStatus: 'unverified',
      phone: profile.phone,
      schoolOrCompany: profile.schoolOrCompany,
      city: profile.city,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      emailVerifiedAt: null,
      passwordHash: hashPassword(password),
      authProvider: 'password',
      providerUserId: '',
      stats: freshUserStats(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    state.users.push(user)
  } else {
    user.displayName = profile.displayName
    user.role = profile.role
    user.phone = profile.phone
    user.schoolOrCompany = profile.schoolOrCompany
    user.city = profile.city
    user.bio = profile.bio
    user.avatarUrl = profile.avatarUrl
    user.passwordHash = hashPassword(password)
    user.authProvider = user.authProvider || 'password'
    user.providerUserId = user.providerUserId || ''
    user.updatedAt = nowIso()
  }

  return clone(createSessionForUser(user))
}

export function upsertProviderSession(input = {}) {
  const state = getState()
  const profile = sanitizeProviderAuthInput(input)
  const email = providerEmail(profile.provider, profile.providerUserId)
  let user =
    state.users.find(
      (item) => item.authProvider === profile.provider && item.providerUserId === profile.providerUserId,
    ) || state.users.find((item) => item.email === email)

  if (!user) {
    const createdAt = nowIso()
    user = {
      id: createId('usr'),
      email,
      displayName: profile.displayName,
      role: profile.role,
      verificationStatus: 'unverified',
      phone: profile.phone,
      schoolOrCompany: profile.schoolOrCompany,
      city: profile.city,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      emailVerifiedAt: createdAt,
      passwordHash: null,
      authProvider: profile.provider,
      providerUserId: profile.providerUserId,
      stats: freshUserStats(),
      createdAt,
      updatedAt: createdAt,
    }
    state.users.push(user)
  } else {
    user.displayName = user.displayName || profile.displayName
    user.role = user.role || profile.role
    user.phone = profile.phone || user.phone || ''
    user.schoolOrCompany = profile.schoolOrCompany || user.schoolOrCompany || ''
    user.city = profile.city || user.city || ''
    user.bio = profile.bio || user.bio || ''
    user.avatarUrl = profile.avatarUrl || user.avatarUrl || ''
    user.emailVerifiedAt = user.emailVerifiedAt || nowIso()
    user.authProvider = profile.provider
    user.providerUserId = profile.providerUserId
    user.updatedAt = nowIso()
  }

  return clone(createSessionForUser(user))
}

export async function requestPhoneLogin(input = {}) {
  const state = getState()
  if (!Array.isArray(state.phoneLoginTokens)) state.phoneLoginTokens = []

  const phone = validatePhone(input.phone)
  const now = new Date()
  const nowMs = now.getTime()

  state.phoneLoginTokens = state.phoneLoginTokens.filter(
    (item) => nowMs - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000,
  )

  const samePhoneToday = state.phoneLoginTokens.filter((item) => item.phone === phone)
  const last = samePhoneToday[0]
  if (last && nowMs - new Date(last.createdAt).getTime() < PHONE_RESEND_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil(
      (PHONE_RESEND_COOLDOWN_MS - (nowMs - new Date(last.createdAt).getTime())) / 1000,
    )
    throw new HttpError(
      429,
      'phone_login_throttled',
      `请求太快了, 请 ${retryAfterSec} 秒后再试。`,
      { retryAfterSec },
    )
  }

  if (samePhoneToday.length >= PHONE_DAILY_QUOTA) {
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
    return clone({
      phoneLogin: {
        status: 'unavailable',
        phone,
        delivery,
      },
    })
  }

  state.phoneLoginTokens.unshift({
    id: createId('plt'),
    phone,
    codeHash: hashToken(code),
    createdAt,
    expiresAt,
    usedAt: null,
    attempts: 0,
  })

  if (delivery?.mock) {
    console.warn(`[whitehive-sms] mock phone login code for ${phone}: ${code}`)
  }

  return clone({
    phoneLogin: {
      status: 'pending',
      phone,
      expiresAt,
      delivery,
    },
  })
}

export function confirmPhoneLogin(input = {}) {
  const state = getState()
  if (!Array.isArray(state.phoneLoginTokens)) state.phoneLoginTokens = []

  const phone = validatePhone(input.phone)
  const code = validatePhoneVerificationCode(input.code)
  const codeHash = hashToken(code)
  const now = new Date()
  const candidates = state.phoneLoginTokens.filter(
    (item) => item.phone === phone && !item.usedAt && new Date(item.expiresAt) > now,
  )

  const challenge = candidates[0]
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

  if (challenge.codeHash !== codeHash) {
    challenge.attempts += 1
    throw new HttpError(400, 'invalid_phone_code', '验证码不正确, 请重新输入。', {
      attemptsLeft: Math.max(0, PHONE_MAX_ATTEMPTS - challenge.attempts),
    })
  }

  const verifiedAt = nowIso()
  challenge.usedAt = verifiedAt
  const profile = sanitizeProviderAuthInput({
    provider: 'phone',
    providerUserId: phone,
    role: input.role,
    phone,
    displayName: input.displayName || `手机尾号${phone.slice(-4)}用户`,
  })
  const email = providerEmail('phone', phone)
  let user =
    state.users.find((item) => item.phone === phone && item.phoneVerifiedAt) ||
    state.users.find((item) => item.authProvider === 'phone' && item.providerUserId === phone) ||
    state.users.find((item) => item.email === email)

  if (!user) {
    user = {
      id: createId('usr'),
      email,
      displayName: profile.displayName,
      role: profile.role,
      verificationStatus: 'unverified',
      phone,
      schoolOrCompany: profile.schoolOrCompany,
      city: profile.city,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      emailVerifiedAt: null,
      phoneVerifiedAt: verifiedAt,
      passwordHash: null,
      authProvider: 'phone',
      providerUserId: phone,
      stats: freshUserStats(),
      createdAt: verifiedAt,
      updatedAt: verifiedAt,
    }
    state.users.push(user)
  } else {
    user.phone = phone
    user.phoneVerifiedAt = user.phoneVerifiedAt || verifiedAt
    user.authProvider = user.authProvider || 'phone'
    user.providerUserId = user.providerUserId || (user.authProvider === 'phone' ? phone : '')
    user.displayName = user.displayName || profile.displayName
    user.updatedAt = verifiedAt
  }

  return clone(createSessionForUser(user))
}

export async function requestPasswordReset(input = {}) {
  const email = validateEmail(input.email)
  const state = getState()
  if (!Array.isArray(state.passwordResetTokens)) {
    state.passwordResetTokens = []
  }
  const user = state.users.find((item) => item.email === email && item.passwordHash)
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
    state.passwordResetTokens.unshift({
      id: createId('prt'),
      userId: user.id,
      email,
      codeHash: hashToken(code),
      createdAt,
      expiresAt,
      usedAt: null,
    })
  }

  return clone({
    passwordReset: {
      status: 'pending',
      email,
      expiresAt,
      delivery: publicDelivery,
    },
  })
}

export function confirmPasswordReset(input = {}) {
  const email = validateEmail(input.email)
  const password = validatePassword(input.password || input.newPassword)
  const code = validateEmailVerificationCode(input.code)
  const codeHash = hashToken(code)
  const now = new Date()
  const state = getState()
  if (!Array.isArray(state.passwordResetTokens)) {
    state.passwordResetTokens = []
  }
  const challenge = state.passwordResetTokens.find(
    (item) =>
      item.email === email &&
      item.codeHash === codeHash &&
      !item.usedAt &&
      new Date(item.expiresAt) > now,
  )

  if (!challenge) {
    throw new HttpError(400, 'invalid_password_reset_code', '验证码不正确或已过期，请重新发送。')
  }

  const user = ensureUser(challenge.userId)
  const resetAt = nowIso()
  challenge.usedAt = resetAt
  user.passwordHash = hashPassword(password)
  user.emailVerifiedAt = user.emailVerifiedAt || resetAt
  user.authProvider = user.authProvider || 'password'
  user.providerUserId = user.providerUserId || ''
  user.updatedAt = resetAt
  state.sessions = state.sessions.filter((session) => session.userId !== user.id)

  return clone({
    user: publicUser(user),
    passwordReset: {
      status: 'reset',
      email: user.email,
      resetAt,
    },
  })
}

export function getSessionByToken(token) {
  const tokenHash = hashToken(token)
  const session = getState().sessions.find((item) => item.tokenHash === tokenHash)

  if (!session || new Date(session.expiresAt) <= new Date()) {
    throw new HttpError(401, 'invalid_session', '登录状态已失效，请重新登录。')
  }

  const user = ensureUser(session.userId)
  session.lastSeenAt = nowIso()

  return clone({
    user: publicUser(user),
    session: {
      id: session.id,
      token: null,
      tokenType: 'Bearer',
      expiresAt: session.expiresAt,
      mode: user.authProvider || 'password',
      provider: user.authProvider || 'password',
    },
  })
}

export async function requestEmailVerification(token) {
  const session = getSessionByToken(token)
  const user = ensureUser(session.user.id)

  if (user.emailVerifiedAt) {
    return clone({
      user: publicUser(user),
      emailVerification: {
        status: 'verified',
        email: user.email,
        expiresAt: null,
        delivery: null,
      },
    })
  }

  const code = createEmailVerificationCode()
  const createdAt = nowIso()
  const expiresAt = emailVerificationExpiresAt()
  const delivery = await sendEmailVerification({ to: user.email, code })

  getState().emailVerificationTokens.unshift({
    id: createId('evt'),
    userId: user.id,
    email: user.email,
    codeHash: hashToken(code),
    createdAt,
    expiresAt,
    usedAt: null,
  })

  return clone({
    user: publicUser(user),
    emailVerification: {
      status: 'pending',
      email: user.email,
      expiresAt,
      delivery,
    },
  })
}

export function confirmEmailVerification(token, input = {}) {
  const session = getSessionByToken(token)
  const user = ensureUser(session.user.id)

  if (user.emailVerifiedAt) {
    return clone({
      user: publicUser(user),
      emailVerification: {
        status: 'verified',
        email: user.email,
        verifiedAt: user.emailVerifiedAt,
      },
    })
  }

  const code = validateEmailVerificationCode(input.code)
  const codeHash = hashToken(code)
  const now = new Date()
  const challenge = getState().emailVerificationTokens.find(
    (item) =>
      item.userId === user.id &&
      item.email === user.email &&
      item.codeHash === codeHash &&
      !item.usedAt &&
      new Date(item.expiresAt) > now,
  )

  if (!challenge) {
    throw new HttpError(400, 'invalid_email_code', '验证码不正确或已过期，请重新发送。')
  }

  const verifiedAt = nowIso()
  challenge.usedAt = verifiedAt
  user.emailVerifiedAt = verifiedAt
  user.updatedAt = verifiedAt

  return clone({
    user: publicUser(user),
    emailVerification: {
      status: 'verified',
      email: user.email,
      verifiedAt,
    },
  })
}

/* ============================================================
   Phone verification / login (SMS)
   ============================================================ */

const PHONE_RESEND_COOLDOWN_MS = 60 * 1000
const PHONE_DAILY_QUOTA = 5
const PHONE_MAX_ATTEMPTS = 5

export async function requestPhoneVerification(token, input = {}) {
  const session = getSessionByToken(token)
  const user = ensureUser(session.user.id)
  const phone = validatePhone(input.phone || user.phone)
  const now = new Date()
  const nowMs = now.getTime()
  const state = getState()

  if (user.phone === phone && user.phoneVerifiedAt) {
    return clone({
      user: publicUser(user),
      phoneVerification: {
        status: 'verified',
        phone,
        verifiedAt: user.phoneVerifiedAt,
        delivery: null,
      },
    })
  }

  const alreadyVerified = state.users.find(
    (item) => item.id !== user.id && item.phone === phone && item.phoneVerifiedAt,
  )

  if (alreadyVerified) {
    throw new HttpError(409, 'phone_already_verified', '这个手机号已经绑定到其他账号。')
  }

  // 清理 24h 之外的历史记录
  state.phoneVerificationTokens = state.phoneVerificationTokens.filter(
    (item) => nowMs - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000,
  )

  const sameUserPhoneToday = state.phoneVerificationTokens.filter(
    (item) => item.userId === user.id && item.phone === phone,
  )

  // 60s 冷却
  const last = sameUserPhoneToday[0]
  if (last && nowMs - new Date(last.createdAt).getTime() < PHONE_RESEND_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil(
      (PHONE_RESEND_COOLDOWN_MS - (nowMs - new Date(last.createdAt).getTime())) / 1000,
    )
    throw new HttpError(
      429,
      'phone_verification_throttled',
      `请求太快了, 请 ${retryAfterSec} 秒后再试。`,
      { retryAfterSec },
    )
  }

  // 每日 5 次配额
  if (sameUserPhoneToday.length >= PHONE_DAILY_QUOTA) {
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
    return clone({
      user: publicUser(user),
      phoneVerification: {
        status: 'unavailable',
        phone,
        delivery,
      },
    })
  }

  state.phoneVerificationTokens.unshift({
    id: createId('pvt'),
    userId: user.id,
    phone,
    codeHash: hashToken(code),
    createdAt,
    expiresAt,
    usedAt: null,
    attempts: 0,
  })

  // mock 模式打印 code, 方便本地调试
  if (delivery?.mock) {
    console.warn(`[whitehive-sms] mock code for ${phone}: ${code}`)
  }

  return clone({
    user: publicUser(user),
    phoneVerification: {
      status: 'pending',
      phone,
      expiresAt,
      delivery,
    },
  })
}

export function confirmPhoneVerification(token, input = {}) {
  const session = getSessionByToken(token)
  const user = ensureUser(session.user.id)
  const phone = validatePhone(input.phone || user.phone)
  const code = validatePhoneVerificationCode(input.code)
  const codeHash = hashToken(code)
  const state = getState()
  const now = new Date()

  const alreadyVerified = state.users.find(
    (item) => item.id !== user.id && item.phone === phone && item.phoneVerifiedAt,
  )

  if (alreadyVerified) {
    throw new HttpError(409, 'phone_already_verified', '这个手机号已经绑定到其他账号。')
  }

  const candidates = state.phoneVerificationTokens.filter(
    (item) =>
      item.userId === user.id &&
      item.phone === phone &&
      !item.usedAt &&
      new Date(item.expiresAt) > now,
  )

  if (candidates.length === 0) {
    throw new HttpError(400, 'invalid_phone_code', '验证码不正确或已过期, 请重新发送。')
  }

  const challenge = candidates[0]

  if (challenge.attempts >= PHONE_MAX_ATTEMPTS) {
    throw new HttpError(
      400,
      'phone_verification_too_many_attempts',
      '输入错误次数过多, 请重新发送验证码。',
    )
  }

  if (challenge.codeHash !== codeHash) {
    challenge.attempts += 1
    throw new HttpError(400, 'invalid_phone_code', '验证码不正确, 请重新输入。', {
      attemptsLeft: Math.max(0, PHONE_MAX_ATTEMPTS - challenge.attempts),
    })
  }

  const verifiedAt = nowIso()
  challenge.usedAt = verifiedAt
  user.phone = phone
  user.phoneVerifiedAt = verifiedAt
  user.updatedAt = verifiedAt

  return clone({
    user: publicUser(user),
    phoneVerification: {
      status: 'verified',
      phone,
      verifiedAt,
    },
  })
}

export function deleteUserAccount(token) {
  const session = getSessionByToken(token)
  const userId = session.user.id
  const state = getState()
  const hasLinkedWork =
    state.services.some((service) => service.sellerId === userId) ||
    state.orders.some((order) => order.buyerId === userId || order.sellerId === userId) ||
    state.payments.some((payment) => payment.buyerId === userId || payment.sellerId === userId) ||
    state.messages.some((message) => message.senderId === userId)

  if (hasLinkedWork) {
    throw new HttpError(409, 'account_has_linked_work', '这个账号已经有关联服务、订单或消息，暂时不能直接注销。')
  }

  state.users = state.users.filter((user) => user.id !== userId)
  state.sessions = state.sessions.filter((item) => item.userId !== userId)
  state.emailVerificationTokens = state.emailVerificationTokens.filter((item) => item.userId !== userId)
  state.phoneVerificationTokens = state.phoneVerificationTokens.filter((item) => item.userId !== userId)
  state.passwordResetTokens = state.passwordResetTokens.filter((item) => item.userId !== userId)
  state.verificationRequests = state.verificationRequests.filter((item) => item.userId !== userId)

  return {
    deleted: true,
    userId,
  }
}

export function updateUserProfile(token, input = {}) {
  const session = getSessionByToken(token)
  const user = ensureUser(session.user.id)
  const profile = sanitizeProfileInput(
    {
      displayName: input.displayName ?? user.displayName,
      role: input.role ?? user.role,
      phone: input.phone ?? user.phone,
      schoolOrCompany: input.schoolOrCompany ?? user.schoolOrCompany,
      city: input.city ?? user.city,
      bio: input.bio ?? user.bio,
      avatarUrl: input.avatarUrl ?? user.avatarUrl,
    },
    user.email,
    user.role,
  )

  user.displayName = profile.displayName || user.displayName
  user.role = profile.role || user.role
  user.phone = profile.phone
  user.schoolOrCompany = profile.schoolOrCompany
  user.city = profile.city
  user.bio = profile.bio
  user.avatarUrl = profile.avatarUrl
  user.updatedAt = nowIso()

  return clone({
    user: publicUser(user),
    session: session.session,
  })
}

export function listServices({ category, status = 'published', sellerId } = {}) {
  const services = getState().services
    .filter((service) => (category ? service.category === category : true))
    .filter((service) => (status && status !== 'all' ? service.status === status : true))
    .filter((service) => (sellerId ? service.sellerId === sellerId : true))
    .map((service) => withSeller(service))

  return clone(services)
}

export function getService(id) {
  const service = getState().services.find((item) => item.id === id)
  if (!service) {
    throw new HttpError(404, 'service_not_found', '没有找到这个服务。')
  }
  return clone(withSeller(service))
}

export function createService(input) {
  const state = getState()

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
  const seller = ensureUser(sellerId)
  const category = String(input.category).trim()

  if (seller.role !== 'admin' && isCdutServiceCategory(category) && !hasApprovedCampusVerification(seller.id)) {
    throw new HttpError(403, 'campus_verification_required', '发布成都理工校园服务前，请先完成卖家校园认证。')
  }

  const requestedStatus = serviceStatuses.includes(input.status) ? input.status : 'pending_review'
  const service = {
    id: createId('svc'),
    sellerId,
    category,
    title: String(input.title).trim(),
    summary: String(input.summary).trim(),
    priceCents,
    currency: input.currency || 'CNY',
    deliveryDays,
    status: seller.role === 'admin' ? requestedStatus : 'pending_review',
    tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 8) : [],
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  state.services.unshift(service)
  return clone(withSeller(service))
}

export function updateService(id, input = {}) {
  const state = getState()
  const service = state.services.find((item) => item.id === id)
  if (!service) throw new HttpError(404, 'service_not_found', '没有找到这个服务。')

  const actorId = input.actorId || input.sellerId
  const actorRole = input.actorRole || ''
  if (service.sellerId !== actorId && actorRole !== 'admin') {
    throw new HttpError(403, 'service_owner_required', '只有服务发布者可以修改这项服务。')
  }
  if (!['rejected', 'pending_review', 'draft'].includes(service.status) && actorRole !== 'admin') {
    throw new HttpError(409, 'service_edit_not_allowed', '当前状态不能直接修改，请先联系平台处理。')
  }

  const title = limitText(input.title ?? service.title, 120)
  const summary = limitText(input.summary ?? service.summary, 1200)
  const category = limitText(input.category ?? service.category, 80)
  const priceCents = Number(input.priceCents ?? service.priceCents)
  const deliveryDays = Number(input.deliveryDays ?? service.deliveryDays)
  const tags = Array.isArray(input.tags) ? input.tags.map(String).slice(0, 8) : service.tags

  if (!title || !category || !summary) {
    throw new HttpError(400, 'missing_fields', '服务标题、分类和简介不能为空。')
  }
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw new HttpError(400, 'invalid_price', '服务价格必须大于 0。')
  }
  if (!Number.isFinite(deliveryDays) || deliveryDays <= 0) {
    throw new HttpError(400, 'invalid_delivery_days', '交付周期必须大于 0。')
  }

  service.title = title
  service.summary = summary
  service.category = category
  service.priceCents = priceCents
  service.deliveryDays = deliveryDays
  service.tags = tags
  service.updatedAt = nowIso()
  if (actorRole !== 'admin') {
    service.status = 'pending_review'
    service.reviewNote = ''
    service.reviewedBy = ''
    service.reviewedAt = null
  }

  return clone(withSeller(service))
}

export function reviewService(id, input = {}) {
  const state = getState()
  const service = state.services.find((item) => item.id === id)
  if (!service) throw new HttpError(404, 'service_not_found', '没有找到这个服务。')

  const status = String(input.status || '').trim()
  if (!['published', 'rejected', 'paused', 'archived'].includes(status)) {
    throw new HttpError(400, 'invalid_service_review_status', '服务审核状态不合法。', {
      allowed: ['published', 'rejected', 'paused', 'archived'],
    })
  }

  service.status = status
  service.reviewNote = limitText(input.reviewNote || input.reviewerNote || '', 500)
  service.reviewedBy = limitText(input.reviewerId || '', 80)
  service.reviewedAt = nowIso()
  service.updatedAt = service.reviewedAt

  createNotification({
    userId: service.sellerId,
    type: `service.${status}`,
    title: serviceReviewNotificationTitle(status),
    body: serviceReviewNotificationBody(service, status),
    ctaHref: '/dashboard',
    metadata: { serviceId: service.id, status, reviewNote: service.reviewNote },
  })

  return clone(withSeller(service))
}

export function listNotifications({ userId, limit = 30 } = {}) {
  if (!userId) throw new HttpError(401, 'auth_required', '请先登录。')
  return clone(
    getState()
      .notifications.filter((item) => item.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.min(Math.max(Number(limit) || 30, 1), 100)),
  )
}

export function markNotificationsRead({ userId, ids = [] } = {}) {
  if (!userId) throw new HttpError(401, 'auth_required', '请先登录。')
  const idSet = new Set(Array.isArray(ids) ? ids.map(String) : [])
  const readAt = nowIso()
  const updated = []
  getState().notifications.forEach((item) => {
    if (item.userId !== userId) return
    if (idSet.size > 0 && !idSet.has(item.id)) return
    item.readAt = readAt
    updated.push(item)
  })
  return clone(updated)
}

export function listOrders({ userId, status } = {}) {
  const orders = getState().orders
    .filter((order) => (userId ? order.buyerId === userId || order.sellerId === userId : true))
    .filter((order) => (status ? order.status === status : true))
    .map((order) => withOrderRelations(order))

  return clone(orders)
}

export function getOrder(id) {
  const order = findOrder(id)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }
  return clone(withOrderRelations(order))
}

export function createOrder(input) {
  const state = getState()
  const service =
    state.services.find((item) => item.id === input.serviceId) ||
    state.services.find((item) => item.category === input.category && item.status === 'published') ||
    state.services.find((item) => item.status === 'published')

  if (!service) {
    throw new HttpError(400, 'invalid_service', '暂时没有可下单服务。')
  }

  if (service.status !== 'published') {
    throw new HttpError(409, 'service_not_available', '该服务尚未通过平台审核，暂时不能下单。')
  }

  if (!input.brief) {
    throw new HttpError(400, 'missing_brief', '请填写需求简介。')
  }

  const buyerId = input.buyerId || 'usr_demo_buyer'
  ensureUser(buyerId)
  ensureUser(service.sellerId)

  const budgetCents = Number(input.budgetCents || service.priceCents)
  if (!Number.isFinite(budgetCents) || budgetCents <= 0) {
    throw new HttpError(400, 'invalid_budget', '订单预算必须大于 0。')
  }

  const order = {
    id: createId('ord'),
    serviceId: service.id,
    buyerId,
    sellerId: service.sellerId,
    title: input.title || service.title,
    brief: String(input.brief).trim(),
    budgetCents,
    currency: input.currency || service.currency || 'CNY',
    status: 'submitted',
    paymentStatus: paymentStatusForService(service),
    verificationRequired: Boolean(input.verificationRequired),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  state.orders.unshift(order)
  state.messages.push({
    id: createId('msg'),
    orderId: order.id,
    senderId: order.buyerId,
    body: `买家提交了需求：${order.brief}`,
    createdAt: nowIso(),
  })

  if (isCdutServiceCategory(service.category)) {
    appendSystemMessage(order.id, directSettlementMessage())
  }

  return clone(withOrderRelations(order))
}

export function updateOrder(id, input) {
  const order = findOrder(id)

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
      appendSystemMessage(order.id, `订单状态更新为：${orderStatusLabels[order.status] || order.status}`)

      if (order.status === 'completed') {
        releaseEscrowForOrder(order)
        bumpSellerStat(order.sellerId, 'ordersCompleted')
      }

      if (order.status === 'cancelled') {
        refundEscrowForOrder(order)
        bumpSellerStat(order.sellerId, 'ordersCancelled')
      }
    }
  }

  if (input.paymentStatus !== undefined) {
    if (!paymentStatuses.includes(input.paymentStatus)) {
      throw new HttpError(400, 'invalid_payment_status', '付款状态不合法。', { allowed: paymentStatuses })
    }
    order.paymentStatus = input.paymentStatus
  }

  order.updatedAt = nowIso()
  return clone(withOrderRelations(order))
}

export function listPayments({ orderId, status } = {}) {
  const payments = getState().payments
    .filter((payment) => (orderId ? payment.orderId === orderId : true))
    .filter((payment) => (status ? payment.status === status : true))
    .map((payment) => withPaymentRelations(payment))

  return clone(payments)
}

export function getPayment(id) {
  const payment = getState().payments.find((item) => item.id === id)
  if (!payment) {
    throw new HttpError(404, 'payment_not_found', '没有找到这笔付款。')
  }
  return clone(withPaymentRelations(payment))
}

export async function createPayment(input) {
  const state = getState()
  const order = findOrder(input.orderId)

  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到要付款的订单。')
  }

  if (order.status === 'cancelled') {
    throw new HttpError(409, 'order_cancelled', '订单已取消，不能继续付款。')
  }

  const service = state.services.find((item) => item.id === order.serviceId)
  if (isCdutServiceCategory(service?.category)) {
    throw new HttpError(409, 'direct_settlement_order', directSettlementMessage())
  }

  const existing = latestPaymentForOrder(order.id)
  if (existing && ['held', 'released'].includes(existing.escrowStatus)) {
    return clone(withPaymentRelations(existing))
  }
  if (existing?.provider === 'wechatpay' && existing.status === 'pending' && existing.checkoutUrl) {
    return clone(withPaymentRelations(existing))
  }

  const amountCents = Number(input.amountCents || order.budgetCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new HttpError(400, 'invalid_amount', '付款金额必须大于 0。')
  }

  const createdAt = nowIso()
  const gateway = assertEscrowPaymentCanBeRecorded()
  const paymentId = createId('pay')

  if (gateway.checkoutEnabled && gateway.provider === 'wechatpay') {
    const transaction = await createWechatPayTransaction({
      outTradeNo: paymentId,
      amountCents,
      currency: input.currency || order.currency || 'CNY',
      description: order.title,
      method: input.method,
      clientIp: input.clientIp,
    })
    const payment = {
      id: paymentId,
      orderId: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      amountCents,
      currency: input.currency || order.currency || 'CNY',
      provider: 'wechatpay',
      method: transaction.method,
      status: 'pending',
      escrowStatus: 'none',
      checkoutUrl: transaction.checkoutUrl,
      providerPaymentId: '',
      createdAt,
      updatedAt: createdAt,
      confirmedAt: null,
      releasedAt: null,
      refundedAt: null,
    }
    state.payments.unshift(payment)
    order.paymentStatus = 'payment_pending'
    order.updatedAt = createdAt
    appendSystemMessage(order.id, '买家已发起微信支付，等待微信支付成功回调后进入平台托管。')
    return clone(withPaymentRelations(payment))
  }

  const payment = {
    id: paymentId,
    orderId: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    amountCents,
    currency: input.currency || order.currency || 'CNY',
    provider: 'mock',
    method: input.method || 'alipay_mock',
    status: 'succeeded',
    escrowStatus: 'held',
    checkoutUrl: '',
    providerPaymentId: '',
    createdAt,
    updatedAt: createdAt,
    confirmedAt: createdAt,
    releasedAt: null,
    refundedAt: null,
  }

  state.payments.unshift(payment)
  order.paymentStatus = 'mock_paid'
  order.updatedAt = createdAt
  appendSystemMessage(order.id, '买家已完成模拟付款，资金进入 WhiteHive 托管。')

  return clone(withPaymentRelations(payment))
}

export function confirmWechatPayment(input = {}) {
  const state = getState()
  const outTradeNo = String(input.outTradeNo || '').trim()
  if (!outTradeNo) {
    throw new HttpError(400, 'missing_out_trade_no', '缺少微信支付商户订单号。')
  }

  const payment = state.payments.find((item) => item.id === outTradeNo && item.provider === 'wechatpay')
  if (!payment) {
    throw new HttpError(404, 'payment_not_found', '没有找到这笔微信支付付款。')
  }
  if (input.amountCents !== undefined && Number(input.amountCents) !== payment.amountCents) {
    throw new HttpError(409, 'payment_amount_mismatch', '微信支付回调金额与订单金额不一致。')
  }

  const order = findOrder(payment.orderId)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这笔付款对应的订单。')
  }

  const paidAt = input.successTime || nowIso()
  payment.status = 'succeeded'
  payment.escrowStatus = 'held'
  payment.providerPaymentId = input.transactionId || payment.providerPaymentId || ''
  payment.confirmedAt = paidAt
  payment.updatedAt = paidAt
  order.paymentStatus = 'payment_held'
  order.updatedAt = paidAt
  appendSystemMessage(order.id, '微信支付已确认，资金进入 WhiteHive 托管。')

  return clone(withPaymentRelations(payment))
}

export function confirmWechatRefund(input = {}) {
  const state = getState()
  const outTradeNo = String(input.outTradeNo || '').trim()
  if (!outTradeNo) {
    throw new HttpError(400, 'missing_out_trade_no', '缺少微信支付商户订单号。')
  }

  const payment = state.payments.find((item) => item.id === outTradeNo && item.provider === 'wechatpay')
  if (!payment) {
    throw new HttpError(404, 'payment_not_found', '没有找到这笔微信支付付款。')
  }

  const order = findOrder(payment.orderId)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这笔付款对应的订单。')
  }

  const refundedAt = input.successTime || nowIso()
  payment.status = 'refunded'
  payment.escrowStatus = 'refunded'
  payment.refundedAt = refundedAt
  payment.updatedAt = refundedAt
  order.paymentStatus = 'payment_refunded'
  order.updatedAt = refundedAt
  appendSystemMessage(order.id, '微信支付退款已完成。')

  return clone(withPaymentRelations(payment))
}

export function listMessages(orderId) {
  if (!orderId) {
    throw new HttpError(400, 'missing_order_id', '缺少订单 ID。')
  }

  if (!findOrder(orderId)) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }

  const messages = getState().messages
    .filter((message) => message.orderId === orderId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((message) => withMessageRelations(message))

  return clone(messages)
}

export function createMessage(input) {
  const state = getState()
  const order = findOrder(input.orderId)
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
  ensureUser(senderId)

  const message = {
    id: createId('msg'),
    orderId: order.id,
    senderId,
    body: text,
    createdAt: nowIso(),
  }

  state.messages.push(message)
  return clone(withMessageRelations(message))
}

export function getVerificationProfile(userId) {
  if (!userId) throw new HttpError(401, 'auth_required', '请先登录。')
  const user = ensureUser(userId)
  const requests = getState().verificationRequests
    .filter((request) => request.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return clone({
    user: publicUser(user),
    latestRequest: requests[0] ? sanitizeVerificationRequest(requests[0]) : null,
    history: requests.map(sanitizeVerificationRequest).slice(0, 10),
  })
}

export function listVerificationRequests({ status = 'pending', limit = 50 } = {}) {
  if (status && status !== 'all' && !verificationRequestStatuses.includes(status)) {
    throw new HttpError(400, 'invalid_verification_status', '实名认证审核状态不合法。', {
      allowed: ['all', ...verificationRequestStatuses],
    })
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100))
  const requests = getState().verificationRequests
    .filter((request) => status === 'all' || !status || request.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, safeLimit)

  return clone(
    requests.map((request) => ({
      ...sanitizeVerificationRequest(request),
      user: publicUser(getState().users.find((user) => user.id === request.userId)),
    })),
  )
}

export function submitVerification(input = {}) {
  const state = getState()
  if (!input.userId) throw new HttpError(401, 'auth_required', '请先登录。')
  const user = ensureUser(input.userId)
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
    throw new HttpError(400, 'invalid_id_number', '证件号码只需要提交后 4 位用于人工核对。')
  }

  if (!isCampus && !contactEmail.includes('@')) {
    throw new HttpError(400, 'invalid_contact_email', '请填写有效联系邮箱。')
  }

  const createdAt = nowIso()
  const request = {
    id: createId('ver'),
    userId: user.id,
    realName,
    role: input.role || user.role,
    verificationType,
    idNumberLast4,
    studentId,
    contactEmail,
    schoolOrCompany,
    city,
    evidenceUrl,
    status: 'pending',
    reviewerNote: '',
    createdAt,
    updatedAt: createdAt,
  }

  state.verificationRequests.unshift(request)
  user.verificationStatus = 'pending'

  return clone({
    user: publicUser(user),
    request: sanitizeVerificationRequest(request),
  })
}

export function reviewVerification(id, input) {
  const state = getState()
  const request = state.verificationRequests.find((item) => item.id === id)

  if (!request) {
    throw new HttpError(404, 'verification_not_found', '没有找到这条实名认证申请。')
  }

  if (!verificationRequestStatuses.includes(input.status)) {
    throw new HttpError(400, 'invalid_verification_status', '实名认证审核状态不合法。', {
      allowed: verificationRequestStatuses,
    })
  }

  request.status = input.status
  request.reviewerNote = String(input.reviewerNote || '').trim()
  request.reviewedAt = nowIso()
  request.updatedAt = nowIso()

  const user = state.users.find((item) => item.id === request.userId)
  if (user) {
    user.verificationStatus =
      request.status === 'approved' ? 'verified' : request.status === 'rejected' ? 'rejected' : 'pending'
  }

  return clone({
    user: user ? publicUser(user) : null,
    request: sanitizeVerificationRequest(request),
  })
}

function findOrder(id) {
  return getState().orders.find((item) => item.id === id)
}

function ensureUser(id) {
  const user = getState().users.find((item) => item.id === id)
  if (!user) {
    throw new HttpError(404, 'user_not_found', '没有找到这个用户。')
  }
  return user
}

function publicUser(user) {
  if (!user) return null
  const stats = ensureUserStats(user)
  const ordersCompleted = Number.isFinite(stats.ordersCompleted) ? stats.ordersCompleted : 0
  const avgRating = Number.isFinite(stats.avgRating) ? stats.avgRating : null
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
    stats: {
      ordersCompleted,
      ordersCancelled: Number.isFinite(stats.ordersCancelled) ? stats.ordersCancelled : 0,
      avgRating,
    },
    level: sellerLevelFor({ ordersCompleted, avgRating }),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt || user.createdAt,
  }
}

function bumpSellerStat(sellerId, key) {
  const user = getState().users.find((item) => item.id === sellerId)
  if (!user) return
  const stats = ensureUserStats(user)
  stats[key] = (Number.isFinite(stats[key]) ? stats[key] : 0) + 1
  user.updatedAt = nowIso()
}

function recomputeSellerAvgRating(sellerId) {
  const state = getState()
  const sellerOrderIds = new Set(
    state.orders.filter((o) => o.sellerId === sellerId).map((o) => o.id),
  )
  const ratings = state.reviews
    .filter((r) => !r.hidden && r.role === 'buyer' && sellerOrderIds.has(r.orderId))
    .map((r) => r.rating)
    .filter((n) => Number.isFinite(n))

  const user = state.users.find((item) => item.id === sellerId)
  if (!user) return
  const stats = ensureUserStats(user)
  if (ratings.length === 0) {
    stats.avgRating = null
  } else {
    const sum = ratings.reduce((a, b) => a + b, 0)
    stats.avgRating = Math.round((sum / ratings.length) * 100) / 100
  }
  user.updatedAt = nowIso()
}

function createSessionForUser(user) {
  const state = getState()
  const token = createSessionToken()
  const createdAt = nowIso()
  const session = {
    id: createId('ses'),
    userId: user.id,
    tokenHash: hashToken(token),
    createdAt,
    expiresAt: sessionExpiresAt(),
    lastSeenAt: createdAt,
  }

  state.sessions.unshift(session)

  return {
    user: publicUser(user),
    session: {
      id: session.id,
      token,
      tokenType: 'Bearer',
      expiresAt: session.expiresAt,
      mode: user.authProvider || 'password',
      provider: user.authProvider || 'password',
    },
  }
}

function appendSystemMessage(orderId, body) {
  getState().messages.push({
    id: createId('msg'),
    orderId,
    senderId: 'usr_system',
    body,
    createdAt: nowIso(),
  })
}

function latestPaymentForOrder(orderId) {
  return getState().payments
    .filter((payment) => payment.orderId === orderId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
}

function releaseEscrowForOrder(order) {
  const payment = latestPaymentForOrder(order.id)
  if (!payment || payment.escrowStatus !== 'held') return

  const releasedAt = nowIso()
  payment.escrowStatus = 'released'
  payment.updatedAt = releasedAt
  payment.releasedAt = releasedAt
  order.paymentStatus = 'mock_released'
  if (payment.provider === 'wechatpay') {
    payment.status = 'succeeded'
    order.paymentStatus = 'payment_released'
    appendSystemMessage(order.id, '买家已确认验收，托管款等待平台按微信支付商户结算流程处理。')
  } else {
    appendSystemMessage(order.id, '买家已确认验收，模拟托管款已释放给卖家。')
  }
}

function refundEscrowForOrder(order) {
  const payment = latestPaymentForOrder(order.id)
  if (!payment || payment.escrowStatus !== 'held') return

  const refundedAt = nowIso()
  payment.escrowStatus = 'refunded'
  payment.updatedAt = refundedAt
  payment.refundedAt = refundedAt
  order.paymentStatus = 'mock_refunded'
  if (payment.provider === 'wechatpay') {
    payment.status = 'refunded'
    order.paymentStatus = 'payment_refunded'
    appendSystemMessage(order.id, '订单已取消，托管款进入微信支付退款处理流程。')
  } else {
    appendSystemMessage(order.id, '订单已取消，模拟托管款已退回买家。')
  }
}

function withSeller(service) {
  const seller = getState().users.find((user) => user.id === service.sellerId)
  if (!seller) {
    return { ...service, seller: null }
  }
  const stats = ensureUserStats(seller)
  const ordersCompleted = Number.isFinite(stats.ordersCompleted) ? stats.ordersCompleted : 0
  const avgRating = Number.isFinite(stats.avgRating) ? stats.avgRating : null
  return {
    ...service,
    seller: {
      id: seller.id,
      displayName: seller.displayName,
      avatarUrl: seller.avatarUrl || '',
      role: seller.role,
      verificationStatus: seller.verificationStatus,
      verified: seller.verificationStatus === 'verified',
      ordersCompleted,
      avgRating,
      level: sellerLevelFor({ ordersCompleted, avgRating }),
    },
  }
}

function withOrderRelations(order) {
  const state = getState()
  const service = state.services.find((item) => item.id === order.serviceId)
  const buyer = state.users.find((item) => item.id === order.buyerId)
  const seller = state.users.find((item) => item.id === order.sellerId)
  const messages = state.messages.filter((item) => item.orderId === order.id)
  const payment = latestPaymentForOrder(order.id)

  return {
    ...order,
    service: service ? { id: service.id, title: service.title, category: service.category } : null,
    buyer: buyer ? publicUser(buyer) : null,
    seller: seller ? publicUser(seller) : null,
    payment: payment ? summarizePayment(payment) : null,
    messageCount: messages.length,
  }
}

function withPaymentRelations(payment) {
  const order = findOrder(payment.orderId)
  return {
    ...payment,
    order: order
      ? {
          id: order.id,
          title: order.title,
          status: order.status,
          paymentStatus: order.paymentStatus,
        }
      : null,
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
    checkoutUrl: payment.checkoutUrl || '',
    providerPaymentId: payment.providerPaymentId || '',
    createdAt: payment.createdAt,
    confirmedAt: payment.confirmedAt,
    releasedAt: payment.releasedAt,
    refundedAt: payment.refundedAt,
  }
}

function withMessageRelations(message) {
  const sender = getState().users.find((user) => user.id === message.senderId)
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

function hasApprovedCampusVerification(userId) {
  return getState().verificationRequests.some(
    (request) =>
      request.userId === userId &&
      request.status === 'approved' &&
      request.verificationType === 'campus' &&
      request.schoolOrCompany === '成都理工大学',
  )
}

function createNotification(input = {}) {
  if (!input.userId || !input.title || !input.body) return null
  const notification = {
    id: createId('ntf'),
    userId: input.userId,
    type: limitText(input.type || 'system', 80),
    title: limitText(input.title, 120),
    body: limitText(input.body, 1000),
    ctaHref: limitText(input.ctaHref || '', 300),
    metadata: input.metadata || {},
    readAt: null,
    createdAt: nowIso(),
  }
  getState().notifications.unshift(notification)
  return notification
}

function serviceReviewNotificationTitle(status) {
  if (status === 'published') return '你的服务已通过审核'
  if (status === 'rejected') return '你的服务未通过审核'
  if (status === 'paused') return '你的服务已被暂停'
  return '你的服务状态已更新'
}

function serviceReviewNotificationBody(service, status) {
  const note = service.reviewNote ? `审核备注：${service.reviewNote}` : ''
  if (status === 'published') return `「${service.title}」已经公开上架，买家现在可以看到并下单。${note}`
  if (status === 'rejected') return `「${service.title}」需要修改后重新提交。${note || '请补充更清晰的交付范围、资质或证明材料。'}`
  if (status === 'paused') return `「${service.title}」已暂时下架。${note || '请根据平台要求调整后再提交。'}`
  return `「${service.title}」状态已更新为 ${status}。${note}`
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

/* ============================================================
   Reviews · 订单完成后的评价
   ============================================================ */

export function createReview(input = {}) {
  const state = getState()
  const order = findOrder(input.orderId)
  if (!order) {
    throw new HttpError(404, 'order_not_found', '没有找到这个订单。')
  }
  if (order.status !== 'completed') {
    throw new HttpError(409, 'order_not_completed', '只有已完成的订单才能留评价。')
  }

  const reviewerId = input.reviewerId
  if (!reviewerId) {
    throw new HttpError(401, 'missing_reviewer', '请先登录后再评价。')
  }

  let role = input.role
  if (!role) {
    if (reviewerId === order.buyerId) role = 'buyer'
    else if (reviewerId === order.sellerId) role = 'seller'
  }
  if (role !== 'buyer' && role !== 'seller') {
    throw new HttpError(403, 'not_order_participant', '你不是这个订单的参与方。')
  }
  if (
    (role === 'buyer' && reviewerId !== order.buyerId) ||
    (role === 'seller' && reviewerId !== order.sellerId)
  ) {
    throw new HttpError(403, 'review_role_mismatch', '评价身份和订单参与方不一致。')
  }

  if (hasExistingReview(state.reviews, { orderId: order.id, role })) {
    throw new HttpError(409, 'review_exists', '你已经评价过这个订单了, 每个订单每方只能留一条。')
  }

  const normalized = normalizeReview({
    orderId: order.id,
    role,
    reviewerId,
    rating: input.rating,
    body: input.body,
    tags: input.tags,
    attachments: input.attachments,
  })

  const stored = { id: createId('rev'), ...normalized }
  state.reviews.unshift(stored)

  // 只用买家给卖家的评价去更新 avgRating —— 卖家给买家的评价单独记录
  if (role === 'buyer') {
    recomputeSellerAvgRating(order.sellerId)
  }

  return clone({ ...stored, ...publicReviewShape(stored) })
}

export function listReviews({ orderId, sellerId, buyerId, limit = 50 } = {}) {
  const state = getState()
  let rows = state.reviews.filter((r) => r && !r.hidden)

  if (orderId) {
    rows = rows.filter((r) => r.orderId === orderId)
  }
  if (sellerId) {
    const sellerOrderIds = new Set(
      state.orders.filter((o) => o.sellerId === sellerId).map((o) => o.id),
    )
    rows = rows.filter((r) => sellerOrderIds.has(r.orderId) && r.role === 'buyer')
  }
  if (buyerId) {
    const buyerOrderIds = new Set(
      state.orders.filter((o) => o.buyerId === buyerId).map((o) => o.id),
    )
    rows = rows.filter((r) => buyerOrderIds.has(r.orderId) && r.role === 'seller')
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100))
  rows = rows
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, safeLimit)

  return clone(rows.map((r) => ({ id: r.id, ...publicReviewShape(r) })).filter(Boolean))
}

export function updateReview(id, input = {}) {
  const state = getState()
  const review = state.reviews.find((r) => r.id === id)
  if (!review) {
    throw new HttpError(404, 'review_not_found', '评价不存在。')
  }
  if (input.reviewerId && input.reviewerId !== review.reviewerId) {
    throw new HttpError(403, 'review_owner_only', '只有评价作者可以修改这条评价。')
  }
  const patched = applyReviewEdit(review, input)
  Object.assign(review, patched)

  const order = findOrder(review.orderId)
  if (order && review.role === 'buyer') {
    recomputeSellerAvgRating(order.sellerId)
  }

  return clone({ id: review.id, ...publicReviewShape(review) })
}
