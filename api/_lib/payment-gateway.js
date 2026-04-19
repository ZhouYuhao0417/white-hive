import { HttpError } from './http.js'

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function isProductionEnv(env = process.env) {
  return env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production'
}

function configuredProvider(env = process.env) {
  const explicit = String(env.WHITEHIVE_PAYMENT_PROVIDER || '').trim().toLowerCase()
  if (explicit) return explicit
  if (env.STRIPE_SECRET_KEY || env.STRIPE_WEBHOOK_SECRET) return 'stripe'
  if (env.WECHAT_PAY_MCH_ID || env.WECHAT_PAY_APP_ID) return 'wechatpay'
  if (env.ALIPAY_APP_ID || env.ALIPAY_PRIVATE_KEY) return 'alipay'
  return 'not_selected'
}

function providerRequirements(provider) {
  if (provider === 'stripe') {
    return ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  }
  if (provider === 'wechatpay') {
    return [
      'WECHAT_PAY_APP_ID',
      'WECHAT_PAY_MCH_ID',
      'WECHAT_PAY_API_V3_KEY',
      'WECHAT_PAY_PRIVATE_KEY',
      'WECHAT_PAY_CERT_SERIAL_NO',
    ]
  }
  if (provider === 'alipay') {
    return ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY']
  }
  return ['WHITEHIVE_PAYMENT_PROVIDER']
}

export function paymentGatewayStatus(env = process.env) {
  const provider = configuredProvider(env)
  const required = providerRequirements(provider)
  const missing = required.filter((key) => !env[key])
  const configured = provider !== 'not_selected' && missing.length === 0
  const production = isProductionEnv(env)
  const mockEnabled = truthy(env.WHITEHIVE_PAYMENT_MOCK) || (!production && env.WHITEHIVE_PAYMENT_MOCK !== '0')

  return {
    provider,
    configured,
    mode: configured ? 'credentials_ready' : mockEnabled ? 'mock' : 'not_configured',
    mockEnabled,
    checkoutEnabled: false,
    supported: ['stripe', 'wechatpay', 'alipay'],
    missing,
    note: configured
      ? '支付密钥已配置；下一步需要接入对应支付机构的下单与 webhook 适配器。'
      : '真实支付机构尚未配置。生产环境不会把模拟付款当作真实托管。',
  }
}

export function assertEscrowPaymentCanBeRecorded(env = process.env) {
  const status = paymentGatewayStatus(env)
  if (status.mockEnabled) return status

  if (status.configured && !status.checkoutEnabled) {
    throw new HttpError(501, 'payment_checkout_not_connected', '支付密钥已配置，但真实付款下单接口还没有接入。', {
      provider: status.provider,
    })
  }

  throw new HttpError(501, 'payment_provider_not_configured', '真实支付通道尚未配置，暂时不能收取平台托管款。', {
    provider: status.provider,
    missing: status.missing,
  })
}
