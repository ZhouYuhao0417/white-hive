// SMS transport · 手机短信验证码
//
// 推荐配置（Spug 推送助手）:
//   WHITEHIVE_SMS_PROVIDER=spug
//   SPUG_SMS_URL           — 在 Spug 模板里复制的完整 URL, 例如 https://push.spug.cc/send/xxxx
//   SPUG_SMS_APP_NAME      — 可选, 默认 WhiteHive
//
// 兼容配置（阿里云 Dysmsapi 2017-05-25）:
//   WHITEHIVE_SMS_PROVIDER=aliyun_sms
//   ALIYUN_SMS_ACCESS_KEY_ID
//   ALIYUN_SMS_ACCESS_KEY_SECRET
//   ALIYUN_SMS_SIGN_NAME     — 已在阿里云审核通过的短信签名, 例如 "白蜂网"
//   ALIYUN_SMS_TEMPLATE_CODE — 已审核通过的模板 ID, 例如 "SMS_123456789"
//   ALIYUN_SMS_REGION        — 可选, 默认 cn-hangzhou
//
//   WHITEHIVE_SMS_MOCK=1     — 本地调试时跳过真实下发, verify 仍生效
//
// 模板内容约定: 必须有验证码 code 变量:
//   "您的白蜂网验证码是 ${code}, 5 分钟内有效, 请勿告知他人。"
//
// 返回形状与 email.js 对齐:
//   { provider, delivered, mock, message, requestId? }

import { createHash, createHmac, randomUUID } from 'node:crypto'

const ALIYUN_API_HOST = 'https://dysmsapi.aliyuncs.com/'
const SPUG_DEFAULT_ENDPOINT = 'https://push.spug.cc/send'

export function smsStatus() {
  const provider = selectedSmsProvider()
  const spug = spugStatus()
  const aliyun = aliyunStatus()
  const active = provider === 'aliyun_sms' ? aliyun : spug
  return {
    provider,
    configured: active.configured,
    mockEnabled: process.env.WHITEHIVE_SMS_MOCK === '1',
    missing: active.missing,
    spug,
    aliyun,
  }
}

/**
 * 下发 6 位短信验证码。
 * 模板里必须有 ${code} 占位, 这里只传 { code }。
 *
 * 返回 { provider, delivered, mock, message, requestId?, bizId? }
 */
export async function sendSmsVerification({ to, code }) {
  const status = smsStatus()
  const phone = normalizeCnPhone(to)
  if (!phone) {
    return {
      provider: status.provider,
      delivered: false,
      mock: false,
      message: '手机号格式不正确, 仅支持中国大陆 11 位手机号。',
    }
  }

  if (!status.configured) {
    if (!status.mockEnabled) {
      return {
        provider: 'not_configured',
        delivered: false,
        mock: false,
        message: missingSmsMessage(status),
      }
    }
    return {
      provider: 'mock',
      delivered: false,
      mock: true,
      message: '本地 mock 模式: 短信未真实下发, 控制台打印了验证码。',
    }
  }

  if (status.provider === 'spug') {
    return sendSpugSms({ phone, code })
  }

  return sendAliyunSms({ phone, code })
}

async function sendSpugSms({ phone, code }) {
  const config = spugConfig()
  const appName = process.env.SPUG_SMS_APP_NAME || 'WhiteHive'
  const ttlMinutes = String(process.env.SPUG_SMS_TTL_MINUTES || '5').trim()
  const payload = {
    name: appName,
    code,
    targets: phone,
  }
  const url = new URL(config.url)
  const method = resolveSpugMethod(url)
  let request

  if (method === 'GET') {
    url.searchParams.set('name', appName)
    url.searchParams.set('code', code)
    if (url.searchParams.has('to')) {
      url.searchParams.set('to', phone)
    } else {
      url.searchParams.set('targets', phone)
    }
    if (url.searchParams.has('targets')) url.searchParams.set('targets', phone)
    if (url.searchParams.has('number')) url.searchParams.set('number', ttlMinutes)
    request = {
      method: 'GET',
      headers: { accept: 'application/json' },
    }
  } else {
    request = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  }

  let response
  try {
    response = await fetch(url, request)
  } catch (err) {
    return {
      provider: 'spug',
      delivered: false,
      mock: false,
      message: `网络错误: ${err.message || '无法连接 Spug 推送助手。'}`,
    }
  }

  const payloadResult = await readResponsePayload(response)
  if (!spugResponseOk(response, payloadResult)) {
    return {
      provider: 'spug',
      delivered: false,
      mock: false,
      message: spugResponseMessage(payloadResult, `短信下发失败 (${response.status})。请稍后重试。`),
      requestId: payloadResult?.data?.id || payloadResult?.id || payloadResult?.requestId,
      code: payloadResult?.code,
    }
  }

  return {
    provider: 'spug',
    delivered: true,
    mock: false,
    message: '短信验证码已发送。',
    requestId: payloadResult?.data?.id || payloadResult?.id || payloadResult?.requestId,
  }
}

function resolveSpugMethod(url) {
  const configured = String(process.env.SPUG_SMS_METHOD || '').trim().toUpperCase()
  if (configured === 'GET' || configured === 'POST') return configured
  if (url.searchParams.has('to') || url.searchParams.has('number')) return 'GET'
  if (url.pathname.startsWith('/sms/')) return 'GET'
  return 'POST'
}

async function sendAliyunSms({ phone, code }) {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET
  const signName = process.env.ALIYUN_SMS_SIGN_NAME
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE
  const params = {
    // 公共参数
    AccessKeyId: accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    RegionId: process.env.ALIYUN_SMS_REGION || 'cn-hangzhou',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
    // 业务参数
    PhoneNumbers: phone,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
  }

  const signature = signAliyunRpc('POST', params, accessKeySecret)
  const body = toFormUrlencoded({ ...params, Signature: signature })

  let response
  try {
    response = await fetch(ALIYUN_API_HOST, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch (err) {
    return {
      provider: 'aliyun_sms',
      delivered: false,
      mock: false,
      message: `网络错误: ${err.message || '无法连接阿里云短信服务。'}`,
    }
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload || payload.Code !== 'OK') {
    return {
      provider: 'aliyun_sms',
      delivered: false,
      mock: false,
      message:
        payload?.Message ||
        `短信下发失败 (${payload?.Code || response.status})。请稍后重试或联系管理员。`,
      requestId: payload?.RequestId,
      code: payload?.Code,
    }
  }

  return {
    provider: 'aliyun_sms',
    delivered: true,
    mock: false,
    message: '短信验证码已发送。',
    requestId: payload.RequestId,
    bizId: payload.BizId,
  }
}

function selectedSmsProvider() {
  const configured = String(process.env.WHITEHIVE_SMS_PROVIDER || '').trim().toLowerCase()
  if (configured === 'aliyun' || configured === 'aliyun_sms') return 'aliyun_sms'
  if (configured === 'spug') return 'spug'

  const spug = spugConfig()
  const aliyun = aliyunStatus()
  if (spug.hasAny) return 'spug'
  if (aliyun.hasAny) return 'aliyun_sms'
  return 'spug'
}

function spugStatus() {
  const config = spugConfig()
  const missing = config.url ? [] : ['SPUG_SMS_URL or SPUG_SMS_TEMPLATE_ID']
  return {
    provider: 'spug',
    configured: missing.length === 0,
    missing,
    appName: process.env.SPUG_SMS_APP_NAME || 'WhiteHive',
    urlConfigured: Boolean(process.env.SPUG_SMS_URL),
    templateIdConfigured: Boolean(process.env.SPUG_SMS_TEMPLATE_ID),
  }
}

function spugConfig() {
  const explicitUrl = String(process.env.SPUG_SMS_URL || '').trim()
  const templateId = String(process.env.SPUG_SMS_TEMPLATE_ID || '').trim()
  const endpoint = String(process.env.SPUG_SMS_ENDPOINT || SPUG_DEFAULT_ENDPOINT).trim()
  return {
    url: explicitUrl || (templateId ? `${endpoint.replace(/\/+$/g, '')}/${encodeURIComponent(templateId)}` : ''),
    hasAny: Boolean(explicitUrl || templateId || process.env.SPUG_SMS_ENDPOINT || process.env.SPUG_SMS_APP_NAME),
  }
}

function aliyunStatus() {
  const missing = []
  if (!process.env.ALIYUN_SMS_ACCESS_KEY_ID) missing.push('ALIYUN_SMS_ACCESS_KEY_ID')
  if (!process.env.ALIYUN_SMS_ACCESS_KEY_SECRET) missing.push('ALIYUN_SMS_ACCESS_KEY_SECRET')
  if (!process.env.ALIYUN_SMS_SIGN_NAME) missing.push('ALIYUN_SMS_SIGN_NAME')
  if (!process.env.ALIYUN_SMS_TEMPLATE_CODE) missing.push('ALIYUN_SMS_TEMPLATE_CODE')
  return {
    provider: 'aliyun_sms',
    configured: missing.length === 0,
    missing,
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
    region: process.env.ALIYUN_SMS_REGION || 'cn-hangzhou',
    hasAny: Boolean(
      process.env.ALIYUN_SMS_ACCESS_KEY_ID ||
        process.env.ALIYUN_SMS_ACCESS_KEY_SECRET ||
        process.env.ALIYUN_SMS_SIGN_NAME ||
        process.env.ALIYUN_SMS_TEMPLATE_CODE ||
        process.env.ALIYUN_SMS_REGION,
    ),
  }
}

function missingSmsMessage(status) {
  if (status.provider === 'spug') {
    return '短信服务尚未配置, 请在 Vercel 添加 SPUG_SMS_URL, 或添加 SPUG_SMS_TEMPLATE_ID。'
  }
  return '短信服务尚未配置, 请在 Vercel 添加 ALIYUN_SMS_* 环境变量。'
}

async function readResponsePayload(response) {
  const text = await response.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function spugResponseOk(response, payload) {
  if (!response.ok) return false
  if (!payload || typeof payload !== 'object') return true
  if (payload.success === true || payload.ok === true) return true
  if (payload.success === false || payload.ok === false) return false
  if (payload.code === undefined && payload.status === undefined && payload.errcode === undefined) return true
  const code = payload.code ?? payload.status ?? payload.errcode
  return code === 0 || code === 200 || code === '0' || code === '200' || code === 'OK'
}

function spugResponseMessage(payload, fallback) {
  return payload?.message || payload?.msg || payload?.error || fallback
}

/**
 * 把 "+86 131 0000 0000" / "13100000000" 规整成 "13100000000"。返回 null 表示非法。
 */
export function normalizeCnPhone(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const s = String(raw).replace(/[\s\-()]/g, '').replace(/^\+?86/, '')
  return /^1[3-9]\d{9}$/.test(s) ? s : null
}

// ============================================================
//   Aliyun RPC v1.0 签名
//   https://help.aliyun.com/document_detail/315526.html
// ============================================================

function signAliyunRpc(httpMethod, params, accessKeySecret) {
  const sortedKeys = Object.keys(params).sort()
  const canonicalized = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&')
  const stringToSign =
    httpMethod.toUpperCase() + '&' + percentEncode('/') + '&' + percentEncode(canonicalized)
  return createHmac('sha1', accessKeySecret + '&').update(stringToSign).digest('base64')
}

/**
 * 阿里云要求的 RFC3986 URL 编码:
 *   - 保留字符: A-Z a-z 0-9 _ - . ~
 *   - 空格 → %20
 *   - * → %2A
 *   - + → %20 (encodeURIComponent 不会编码 +, 但有些 secret 里有 /, encodeURIComponent 已处理)
 *   - %7E (~) 还原
 */
function percentEncode(v) {
  return encodeURIComponent(String(v))
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
}

function toFormUrlencoded(params) {
  return Object.keys(params)
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&')
}

// internal: for tests
export const __internal = { signAliyunRpc, percentEncode, toFormUrlencoded }

// 供 sessionIdentifierHash 之类的地方复用, 跟 email.js 对齐风格
export function fingerprintPhone(phone) {
  const normalized = normalizeCnPhone(phone) || ''
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}
