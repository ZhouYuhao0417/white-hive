// Shared test helpers.
//
// The memory store uses a singleton on globalThis. Each test calls
// resetMemoryStore() to get a clean slate. We also clear env vars that
// would otherwise route calls to Postgres (tests are pure memory).

export function resetMemoryStore() {
  delete globalThis.__whitehiveMvpStore
}

export function clearProductionEnv() {
  delete process.env.DATABASE_URL
  delete process.env.POSTGRES_URL
  delete process.env.STORAGES_URL
  delete process.env.WHITEHIVE_REQUIRE_DATABASE
  delete process.env.WHITEHIVE_SMS_PROVIDER
  delete process.env.SPUG_SMS_URL
  delete process.env.SPUG_SMS_TEMPLATE_ID
  delete process.env.SPUG_SMS_ENDPOINT
  delete process.env.SPUG_SMS_APP_NAME
  delete process.env.SPUG_SMS_METHOD
  delete process.env.ALIYUN_SMS_ACCESS_KEY_ID
  delete process.env.ALIYUN_SMS_ACCESS_KEY_SECRET
  delete process.env.ALIYUN_SMS_SIGN_NAME
  delete process.env.ALIYUN_SMS_TEMPLATE_CODE
  delete process.env.ALIYUN_SMS_REGION
  delete process.env.WHITEHIVE_SMS_MOCK
  delete process.env.GITHUB_CLIENT_ID
  delete process.env.GITHUB_CLIENT_SECRET
  delete process.env.WECHAT_CLIENT_ID
  delete process.env.WECHAT_CLIENT_SECRET
  delete process.env.QQ_CLIENT_ID
  delete process.env.QQ_CLIENT_SECRET
  delete process.env.WHITEHIVE_OAUTH_STATE_SECRET
  delete process.env.WHITEHIVE_PAYMENT_PROVIDER
  delete process.env.WHITEHIVE_PAYMENT_MOCK
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_WEBHOOK_SECRET
  delete process.env.WECHAT_PAY_APP_ID
  delete process.env.WECHAT_PAY_MCH_ID
  delete process.env.WECHAT_PAY_API_V3_KEY
  delete process.env.WECHAT_PAY_PRIVATE_KEY
  delete process.env.WECHAT_PAY_CERT_SERIAL_NO
  delete process.env.WECHAT_PAY_PLATFORM_CERTIFICATE
  delete process.env.WECHAT_PAY_NOTIFY_URL
  delete process.env.WECHAT_PAY_REFUND_NOTIFY_URL
  delete process.env.ALIPAY_APP_ID
  delete process.env.ALIPAY_PRIVATE_KEY
  delete process.env.ALIPAY_PUBLIC_KEY
}

export function withoutDeepSeek(fn) {
  const prev = process.env.DEEPSEEK_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  try {
    return fn()
  } finally {
    if (prev !== undefined) process.env.DEEPSEEK_API_KEY = prev
  }
}

export function uniqueEmail(tag = 't') {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.whitehive.local`
}
