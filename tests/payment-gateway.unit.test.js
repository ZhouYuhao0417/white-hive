import { describe, expect, test } from 'bun:test'
import { assertEscrowPaymentCanBeRecorded, paymentGatewayStatus } from '../api/_lib/payment-gateway.js'
import { HttpError } from '../api/_lib/http.js'

const requiredWechatEnv = {
  WHITEHIVE_PAYMENT_PROVIDER: 'wechatpay',
  WHITEHIVE_SITE_URL: 'https://www.whitehive.cn',
  WECHAT_PAY_APP_ID: 'wx_demo_app',
  WECHAT_PAY_MCH_ID: '1900000001',
  WECHAT_PAY_API_V3_KEY: '12345678901234567890123456789012',
  WECHAT_PAY_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----',
  WECHAT_PAY_CERT_SERIAL_NO: 'demo-cert-serial',
  WECHAT_PAY_PLATFORM_CERTIFICATE: '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----',
}

describe('payment gateway status', () => {
  test('production requires a configured provider before escrow collection', () => {
    const env = {
      NODE_ENV: 'production',
      WHITEHIVE_PAYMENT_PROVIDER: 'wechatpay',
    }

    const status = paymentGatewayStatus(env)
    expect(status.provider).toBe('wechatpay')
    expect(status.configured).toBe(false)
    expect(status.checkoutEnabled).toBe(false)
    expect(status.missing).toContain('WECHAT_PAY_API_V3_KEY')
    expect(() => assertEscrowPaymentCanBeRecorded(env)).toThrow(HttpError)
  })

  test('configured WeChat Pay enables live checkout', () => {
    const env = {
      NODE_ENV: 'production',
      ...requiredWechatEnv,
    }

    const status = paymentGatewayStatus(env)
    expect(status.provider).toBe('wechatpay')
    expect(status.mode).toBe('live')
    expect(status.configured).toBe(true)
    expect(status.checkoutEnabled).toBe(true)
    expect(status.missing).toEqual([])
    expect(assertEscrowPaymentCanBeRecorded(env).checkoutEnabled).toBe(true)
  })
})
