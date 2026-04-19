// SMS transport · 阿里云短信服务 (Dysmsapi 2017-05-25)
//
// 配置:
//   ALIYUN_SMS_ACCESS_KEY_ID
//   ALIYUN_SMS_ACCESS_KEY_SECRET
//   ALIYUN_SMS_SIGN_NAME     — 已在阿里云审核通过的短信签名, 例如 "白蜂网"
//   ALIYUN_SMS_TEMPLATE_CODE — 已审核通过的模板 ID, 例如 "SMS_123456789"
//   ALIYUN_SMS_REGION        — 可选, 默认 cn-hangzhou
//   WHITEHIVE_SMS_MOCK=1     — 本地调试时跳过真实下发, verify 仍生效
//
// 模板内容约定: 必须有且只有 ${code} 占位:
//   "您的白蜂网验证码是 ${code}, 5 分钟内有效, 请勿告知他人。"
//
// 返回形状与 email.js 对齐:
//   { provider, delivered, mock, message, requestId? }

import { createHash, createHmac, randomUUID } from 'node:crypto'

const API_HOST = 'https://dysmsapi.aliyuncs.com/'

export function smsStatus() {
  const missing = []
  if (!process.env.ALIYUN_SMS_ACCESS_KEY_ID) missing.push('ALIYUN_SMS_ACCESS_KEY_ID')
  if (!process.env.ALIYUN_SMS_ACCESS_KEY_SECRET) missing.push('ALIYUN_SMS_ACCESS_KEY_SECRET')
  if (!process.env.ALIYUN_SMS_SIGN_NAME) missing.push('ALIYUN_SMS_SIGN_NAME')
  if (!process.env.ALIYUN_SMS_TEMPLATE_CODE) missing.push('ALIYUN_SMS_TEMPLATE_CODE')
  return {
    provider: 'aliyun_sms',
    configured: missing.length === 0,
    mockEnabled: process.env.WHITEHIVE_SMS_MOCK === '1',
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
    region: process.env.ALIYUN_SMS_REGION || 'cn-hangzhou',
    missing,
  }
}

/**
 * 下发 6 位短信验证码。
 * 模板里必须有 ${code} 占位, 这里只传 { code }。
 *
 * 返回 { provider, delivered, mock, message, requestId?, bizId? }
 */
export async function sendSmsVerification({ to, code }) {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET
  const signName = process.env.ALIYUN_SMS_SIGN_NAME
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE
  const allowMock = process.env.WHITEHIVE_SMS_MOCK === '1'

  const phone = normalizeCnPhone(to)
  if (!phone) {
    return {
      provider: 'aliyun_sms',
      delivered: false,
      mock: false,
      message: '手机号格式不正确, 仅支持中国大陆 11 位手机号。',
    }
  }

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    if (!allowMock) {
      return {
        provider: 'not_configured',
        delivered: false,
        mock: false,
        message: '短信服务尚未配置, 请在 Vercel 添加 ALIYUN_SMS_* 环境变量。',
      }
    }
    return {
      provider: 'mock',
      delivered: false,
      mock: true,
      message: '本地 mock 模式: 短信未真实下发, 控制台打印了验证码。',
    }
  }

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
    response = await fetch(API_HOST, {
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
