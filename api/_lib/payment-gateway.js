import crypto from 'node:crypto'
import { HttpError } from './http.js'

const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com'
const WECHAT_PAY_NATIVE_PATH = '/v3/pay/transactions/native'
const WECHAT_PAY_H5_PATH = '/v3/pay/transactions/h5'
const WECHAT_PAY_REFUND_PATH = '/v3/refund/domestic/refunds'

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function isProductionEnv(env = process.env) {
  return env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production'
}

function configuredProvider(env = process.env) {
  const explicit = String(env.WHITEHIVE_PAYMENT_PROVIDER || '').trim().toLowerCase()
  if (explicit) return explicit
  if (env.WECHAT_PAY_MCH_ID || env.WECHAT_PAY_APP_ID) return 'wechatpay'
  if (env.STRIPE_SECRET_KEY || env.STRIPE_WEBHOOK_SECRET) return 'stripe'
  if (env.ALIPAY_APP_ID || env.ALIPAY_PRIVATE_KEY) return 'alipay'
  return 'not_selected'
}

function normalizeProvider(provider) {
  return provider === 'wechat' || provider === 'wxpay' ? 'wechatpay' : provider
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
      'WECHAT_PAY_PLATFORM_CERTIFICATE',
      'WHITEHIVE_SITE_URL',
    ]
  }
  if (provider === 'alipay') {
    return ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY']
  }
  return ['WHITEHIVE_PAYMENT_PROVIDER']
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n')
}

function normalizeCertificate(value) {
  return String(value || '').replace(/\\n/g, '\n')
}

function randomNonce() {
  return crypto.randomBytes(16).toString('hex')
}

function timestampSeconds() {
  return Math.floor(Date.now() / 1000).toString()
}

function signWechatPayRequest({ method, urlPath, body, env = process.env }) {
  const nonce = randomNonce()
  const timestamp = timestampSeconds()
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(message, 'utf8')
    .sign(normalizePrivateKey(env.WECHAT_PAY_PRIVATE_KEY), 'base64')

  return {
    nonce,
    timestamp,
    authorization:
      `WECHATPAY2-SHA256-RSA2048 mchid="${env.WECHAT_PAY_MCH_ID}",` +
      `nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.WECHAT_PAY_CERT_SERIAL_NO}",signature="${signature}"`,
  }
}

function cleanDescription(value) {
  return String(value || 'WhiteHive 订单托管')
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 120)
}

function notifyUrl(env = process.env) {
  const explicit = String(env.WECHAT_PAY_NOTIFY_URL || '').trim()
  if (explicit) return explicit
  const siteUrl = String(env.WHITEHIVE_SITE_URL || '').replace(/\/+$/g, '')
  return `${siteUrl}/api/payments/wechat/notify`
}

function refundNotifyUrl(env = process.env) {
  const explicit = String(env.WECHAT_PAY_REFUND_NOTIFY_URL || '').trim()
  if (explicit) return explicit
  const siteUrl = String(env.WHITEHIVE_SITE_URL || '').replace(/\/+$/g, '')
  return `${siteUrl}/api/payments/wechat/refund-notify`
}

function wechatPayMethod(method) {
  const text = String(method || '').toLowerCase()
  if (text.includes('h5')) return 'wechatpay_h5'
  return 'wechatpay_native'
}

export function paymentGatewayStatus(env = process.env) {
  const provider = normalizeProvider(configuredProvider(env))
  const required = providerRequirements(provider)
  const missing = required.filter((key) => !env[key])
  const configured = provider !== 'not_selected' && missing.length === 0
  const production = isProductionEnv(env)
  const mockEnabled = truthy(env.WHITEHIVE_PAYMENT_MOCK) || (!production && env.WHITEHIVE_PAYMENT_MOCK !== '0')

  return {
    provider,
    configured,
    mode: configured ? 'live' : mockEnabled ? 'mock' : 'not_configured',
    mockEnabled,
    checkoutEnabled: configured && provider === 'wechatpay',
    supported: ['wechatpay', 'stripe', 'alipay'],
    missing,
    note: configured
      ? '真实支付通道已配置。非 CDUT 普通订单会创建微信支付单，支付成功回调后进入平台托管状态。'
      : '真实支付机构尚未配置。生产环境不会把模拟付款当作真实托管。',
  }
}

export function assertEscrowPaymentCanBeRecorded(env = process.env) {
  const status = paymentGatewayStatus(env)
  if (status.mockEnabled || status.checkoutEnabled) return status

  if (status.configured && !status.checkoutEnabled) {
    throw new HttpError(501, 'payment_checkout_not_connected', '支付密钥已配置，但当前支付机构的下单接口还没有接入。', {
      provider: status.provider,
    })
  }

  throw new HttpError(501, 'payment_provider_not_configured', '真实支付通道尚未配置，暂时不能收取平台托管款。', {
    provider: status.provider,
    missing: status.missing,
  })
}

export async function createWechatPayTransaction(input, env = process.env) {
  const status = paymentGatewayStatus(env)
  if (!status.checkoutEnabled || status.provider !== 'wechatpay') {
    throw new HttpError(501, 'wechatpay_not_configured', '微信支付尚未配置完整，暂时不能创建真实付款单。', {
      missing: status.missing,
    })
  }

  const method = wechatPayMethod(input.method)
  const urlPath = method === 'wechatpay_h5' ? WECHAT_PAY_H5_PATH : WECHAT_PAY_NATIVE_PATH
  const amountCents = Number(input.amountCents)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new HttpError(400, 'invalid_amount', '微信支付金额必须是大于 0 的分。')
  }

  const payload = {
    appid: env.WECHAT_PAY_APP_ID,
    mchid: env.WECHAT_PAY_MCH_ID,
    description: cleanDescription(input.description),
    out_trade_no: input.outTradeNo,
    notify_url: notifyUrl(env),
    amount: {
      total: amountCents,
      currency: input.currency || 'CNY',
    },
  }

  if (method === 'wechatpay_h5') {
    payload.scene_info = {
      payer_client_ip: input.clientIp || '127.0.0.1',
      h5_info: { type: 'Wap' },
    }
  }

  const body = JSON.stringify(payload)
  const signed = signWechatPayRequest({ method: 'POST', urlPath, body, env })
  const response = await fetch(`${WECHAT_PAY_API_BASE}${urlPath}`, {
    method: 'POST',
    headers: {
      authorization: signed.authorization,
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'WhiteHive/1.0',
    },
    body,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new HttpError(response.status, 'wechatpay_create_failed', data.message || '微信支付下单失败。', {
      code: data.code,
    })
  }

  return {
    provider: 'wechatpay',
    method,
    status: 'pending',
    escrowStatus: 'none',
    checkoutUrl: method === 'wechatpay_h5' ? data.h5_url : data.code_url,
    h5Url: data.h5_url || '',
    codeUrl: data.code_url || '',
    providerPayload: data,
  }
}

export async function createWechatPayRefund(input, env = process.env) {
  const status = paymentGatewayStatus(env)
  if (!status.checkoutEnabled || status.provider !== 'wechatpay') {
    throw new HttpError(501, 'wechatpay_not_configured', '微信支付尚未配置完整，暂时不能发起退款。', {
      missing: status.missing,
    })
  }

  const amountCents = Number(input.amountCents)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new HttpError(400, 'invalid_refund_amount', '微信支付退款金额必须是大于 0 的分。')
  }

  const payload = {
    out_trade_no: input.outTradeNo,
    out_refund_no: input.outRefundNo,
    reason: cleanDescription(input.reason || 'WhiteHive 订单取消退款'),
    notify_url: refundNotifyUrl(env),
    amount: {
      refund: amountCents,
      total: amountCents,
      currency: input.currency || 'CNY',
    },
  }
  const body = JSON.stringify(payload)
  const signed = signWechatPayRequest({ method: 'POST', urlPath: WECHAT_PAY_REFUND_PATH, body, env })
  const response = await fetch(`${WECHAT_PAY_API_BASE}${WECHAT_PAY_REFUND_PATH}`, {
    method: 'POST',
    headers: {
      authorization: signed.authorization,
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'WhiteHive/1.0',
    },
    body,
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new HttpError(response.status, 'wechatpay_refund_failed', data.message || '微信支付退款申请失败。', {
      code: data.code,
    })
  }

  return {
    refundId: data.refund_id || '',
    outRefundNo: data.out_refund_no || input.outRefundNo,
    status: String(data.status || 'PROCESSING').toUpperCase(),
    providerPayload: data,
  }
}

export function verifyWechatPayNotifySignature({ headers, rawBody, env = process.env }) {
  const timestamp = headers.get('wechatpay-timestamp')
  const nonce = headers.get('wechatpay-nonce')
  const signature = headers.get('wechatpay-signature')
  const serial = headers.get('wechatpay-serial')
  const certificate = normalizeCertificate(env.WECHAT_PAY_PLATFORM_CERTIFICATE)

  if (!timestamp || !nonce || !signature || !serial || !certificate) {
    throw new HttpError(400, 'wechatpay_notify_signature_missing', '微信支付回调签名信息不完整。')
  }

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(skew) || skew > 5 * 60) {
    throw new HttpError(400, 'wechatpay_notify_expired', '微信支付回调时间戳已过期。')
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`
  const ok = crypto.verify('RSA-SHA256', Buffer.from(message), certificate, Buffer.from(signature, 'base64'))
  if (!ok) {
    throw new HttpError(400, 'wechatpay_notify_signature_invalid', '微信支付回调签名校验失败。')
  }
}

export function decryptWechatPayResource(resource, env = process.env) {
  const apiV3Key = Buffer.from(String(env.WECHAT_PAY_API_V3_KEY || ''), 'utf8')
  if (apiV3Key.length !== 32) {
    throw new HttpError(500, 'wechatpay_api_v3_key_invalid', '微信支付 APIv3 密钥长度不正确。')
  }

  const ciphertext = Buffer.from(resource?.ciphertext || '', 'base64')
  const nonce = Buffer.from(resource?.nonce || '', 'utf8')
  const associatedData = Buffer.from(resource?.associated_data || '', 'utf8')
  const authTag = ciphertext.subarray(ciphertext.length - 16)
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', apiV3Key, nonce)
  decipher.setAuthTag(authTag)
  decipher.setAAD(associatedData)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return JSON.parse(decrypted)
}
