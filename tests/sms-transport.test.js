import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { sendSmsVerification, smsStatus } from '../api/_lib/sms.js'
import { clearProductionEnv } from './helpers.js'

const originalFetch = globalThis.fetch

describe('sms transport · Spug', () => {
  beforeEach(() => {
    clearProductionEnv()
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    clearProductionEnv()
    globalThis.fetch = originalFetch
  })

  test('defaults to Spug and reports missing template URL safely', () => {
    const status = smsStatus()

    expect(status.provider).toBe('spug')
    expect(status.configured).toBe(false)
    expect(status.missing).toContain('SPUG_SMS_URL or SPUG_SMS_TEMPLATE_ID')
    expect(status.spug.urlConfigured).toBe(false)
  })

  test('sends verification code to Spug with the copied template URL', async () => {
    process.env.WHITEHIVE_SMS_PROVIDER = 'spug'
    process.env.SPUG_SMS_URL = 'https://push.spug.cc/send/template_123'
    process.env.SPUG_SMS_APP_NAME = 'WhiteHive'
    let captured
    globalThis.fetch = async (url, options) => {
      captured = { url: String(url), options }
      return new Response(JSON.stringify({ code: 0, message: 'success', data: { id: 'sms_1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await sendSmsVerification({ to: '+86 139 1234 5678', code: '123456' })

    expect(result).toMatchObject({
      provider: 'spug',
      delivered: true,
      mock: false,
      requestId: 'sms_1',
    })
    expect(captured.url).toBe('https://push.spug.cc/send/template_123')
    expect(captured.options.method).toBe('POST')
    expect(JSON.parse(captured.options.body)).toEqual({
      name: 'WhiteHive',
      code: '123456',
      targets: '13912345678',
    })
  })

  test('supports Spug template id and legacy code 200 success response', async () => {
    process.env.SPUG_SMS_TEMPLATE_ID = 'template_456'
    globalThis.fetch = async (url) => {
      expect(String(url)).toBe('https://push.spug.cc/send/template_456')
      return new Response(JSON.stringify({ code: 200, msg: '请求成功' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await sendSmsVerification({ to: '13812345678', code: '654321' })

    expect(result.delivered).toBe(true)
    expect(result.provider).toBe('spug')
  })

  test('supports Spug sms query URL with to/code/number placeholders', async () => {
    process.env.SPUG_SMS_URL = 'https://push.spug.cc/sms/template_789?to=&name=&code=&number='
    process.env.SPUG_SMS_APP_NAME = 'WhiteHive'
    let captured
    globalThis.fetch = async (url, options) => {
      captured = { url: new URL(String(url)), options }
      return new Response(JSON.stringify({ code: 0, message: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await sendSmsVerification({ to: '+86 139 1234 5678', code: '123456' })

    expect(result.delivered).toBe(true)
    expect(captured.options.method).toBe('GET')
    expect(captured.url.searchParams.get('to')).toBe('13912345678')
    expect(captured.url.searchParams.get('name')).toBe('WhiteHive')
    expect(captured.url.searchParams.get('code')).toBe('123456')
    expect(captured.url.searchParams.get('number')).toBe('5')
  })

  test('returns unavailable details when Spug rejects the request', async () => {
    process.env.SPUG_SMS_URL = 'https://push.spug.cc/send/template_789'
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ code: 400, message: '余额不足' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const result = await sendSmsVerification({ to: '13812345678', code: '654321' })

    expect(result.delivered).toBe(false)
    expect(result.provider).toBe('spug')
    expect(result.message).toBe('余额不足')
  })
})
