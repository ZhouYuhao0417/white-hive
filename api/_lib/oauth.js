import { createHmac, randomBytes } from 'node:crypto'
import { HttpError } from './http.js'
import { normalizeAuthProvider, normalizeRole } from './auth.js'

const oauthProviders = ['github', 'wechat', 'qq']
const stateMaxAgeMs = 10 * 60 * 1000

function siteUrl(request) {
  const configured = String(process.env.WHITEHIVE_SITE_URL || '').replace(/\/+$/g, '')
  if (configured) return configured
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

function callbackUrl(request, provider) {
  return `${siteUrl(request)}/api/auth/oauth/${provider}/callback`
}

function stateSecret() {
  return (
    process.env.WHITEHIVE_OAUTH_STATE_SECRET ||
    process.env.WHITEHIVE_ADMIN_REVIEW_TOKEN ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGES_URL ||
    'whitehive-local-oauth-state'
  )
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signState(encoded) {
  return createHmac('sha256', stateSecret()).update(encoded).digest('base64url')
}

function providerCredentials(provider) {
  if (provider === 'github') {
    return {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      missing: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'].filter((key) => !process.env[key]),
    }
  }

  if (provider === 'wechat') {
    return {
      clientId: process.env.WECHAT_CLIENT_ID || '',
      clientSecret: process.env.WECHAT_CLIENT_SECRET || '',
      missing: ['WECHAT_CLIENT_ID', 'WECHAT_CLIENT_SECRET'].filter((key) => !process.env[key]),
    }
  }

  if (provider === 'qq') {
    return {
      clientId: process.env.QQ_CLIENT_ID || '',
      clientSecret: process.env.QQ_CLIENT_SECRET || '',
      missing: ['QQ_CLIENT_ID', 'QQ_CLIENT_SECRET'].filter((key) => !process.env[key]),
    }
  }

  throw new HttpError(400, 'invalid_oauth_provider', '暂不支持这个授权登录方式。')
}

export function oauthProviderStatus(provider) {
  const normalized = normalizeAuthProvider(provider)
  if (!oauthProviders.includes(normalized)) {
    return {
      mode: 'unavailable',
      configured: false,
      missing: [],
    }
  }
  const credentials = providerCredentials(normalized)
  return {
    mode: credentials.missing.length === 0 ? 'live' : 'unavailable',
    configured: credentials.missing.length === 0,
    missing: credentials.missing,
  }
}

export function createOAuthState(input = {}) {
  const provider = normalizeAuthProvider(input.provider)
  const payload = {
    provider,
    role: normalizeRole(input.role),
    returnTo: sanitizeReturnTo(input.returnTo),
    iat: Date.now(),
    nonce: randomBytes(12).toString('base64url'),
  }
  const encoded = base64urlJson(payload)
  return `${encoded}.${signState(encoded)}`
}

export function verifyOAuthState(state, expectedProvider) {
  const expected = normalizeAuthProvider(expectedProvider)
  const [encoded, signature] = String(state || '').split('.')
  if (!encoded || !signature || signState(encoded) !== signature) {
    throw new HttpError(400, 'invalid_oauth_state', '授权状态已失效，请重新发起登录。')
  }

  let payload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    throw new HttpError(400, 'invalid_oauth_state', '授权状态已失效，请重新发起登录。')
  }

  const provider = normalizeAuthProvider(payload.provider)
  if (provider !== expected) {
    throw new HttpError(400, 'oauth_provider_mismatch', '授权登录方式不匹配，请重新发起登录。')
  }

  if (!Number.isFinite(payload.iat) || Date.now() - payload.iat > stateMaxAgeMs) {
    throw new HttpError(400, 'oauth_state_expired', '授权已超时，请重新发起登录。')
  }

  return {
    provider,
    role: normalizeRole(payload.role),
    returnTo: sanitizeReturnTo(payload.returnTo),
  }
}

export function buildOAuthStartUrl(request, provider, input = {}) {
  const normalized = normalizeAuthProvider(provider)
  if (!oauthProviders.includes(normalized)) {
    throw new HttpError(400, 'invalid_oauth_provider', '这个登录方式暂不支持真实授权。')
  }

  const credentials = providerCredentials(normalized)
  if (credentials.missing.length) {
    throw new HttpError(501, 'oauth_not_configured', '这个第三方登录还没有配置平台凭据。', {
      missing: credentials.missing,
    })
  }

  const redirectUri = callbackUrl(request, normalized)
  const state = createOAuthState({
    provider: normalized,
    role: input.role,
    returnTo: input.returnTo,
  })

  if (normalized === 'github') {
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', credentials.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'read:user user:email')
    url.searchParams.set('state', state)
    return url.toString()
  }

  if (normalized === 'wechat') {
    const url = new URL('https://open.weixin.qq.com/connect/qrconnect')
    url.searchParams.set('appid', credentials.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'snsapi_login')
    url.searchParams.set('state', state)
    return `${url.toString()}#wechat_redirect`
  }

  const url = new URL('https://graph.qq.com/oauth2.0/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', credentials.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'get_user_info')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function resolveOAuthProfile(provider, code, request) {
  const normalized = normalizeAuthProvider(provider)
  if (!oauthProviders.includes(normalized)) {
    throw new HttpError(400, 'invalid_oauth_provider', '这个登录方式暂不支持真实授权。')
  }
  if (!code) {
    throw new HttpError(400, 'missing_oauth_code', '授权回调缺少 code。')
  }

  if (normalized === 'github') return resolveGitHubProfile(code, request)
  if (normalized === 'wechat') return resolveWeChatProfile(code, request)
  return resolveQQProfile(code, request)
}

async function resolveGitHubProfile(code, request) {
  const credentials = requireProviderCredentials('github')
  const token = await fetchJson('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: callbackUrl(request, 'github'),
    }),
  })
  if (!token.access_token) {
    throw new HttpError(502, 'oauth_token_failed', 'GitHub 授权换取 token 失败。', token)
  }

  const user = await fetchJson('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token.access_token}`,
      'user-agent': 'WhiteHive OAuth',
    },
  })

  return {
    provider: 'github',
    providerUserId: String(user.id || user.login || ''),
    displayName: user.name || user.login || 'GitHub 用户',
    avatarUrl: normalizeAvatarUrl(user.avatar_url),
    bio: user.bio || '',
  }
}

async function resolveWeChatProfile(code, request) {
  const credentials = requireProviderCredentials('wechat')
  const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
  tokenUrl.searchParams.set('appid', credentials.clientId)
  tokenUrl.searchParams.set('secret', credentials.clientSecret)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('grant_type', 'authorization_code')
  const token = await fetchJson(tokenUrl.toString())
  if (!token.access_token || !token.openid) {
    throw new HttpError(502, 'oauth_token_failed', '微信授权换取 token 失败。', token)
  }

  const userUrl = new URL('https://api.weixin.qq.com/sns/userinfo')
  userUrl.searchParams.set('access_token', token.access_token)
  userUrl.searchParams.set('openid', token.openid)
  userUrl.searchParams.set('lang', 'zh_CN')
  const user = await fetchJson(userUrl.toString())

  return {
    provider: 'wechat',
    providerUserId: String(user.unionid || user.openid || token.openid),
    displayName: user.nickname || '微信用户',
    avatarUrl: normalizeAvatarUrl(user.headimgurl),
    city: [user.country, user.province, user.city].filter(Boolean).join(' '),
    bio: '',
  }
}

async function resolveQQProfile(code, request) {
  const credentials = requireProviderCredentials('qq')
  const tokenUrl = new URL('https://graph.qq.com/oauth2.0/token')
  tokenUrl.searchParams.set('grant_type', 'authorization_code')
  tokenUrl.searchParams.set('client_id', credentials.clientId)
  tokenUrl.searchParams.set('client_secret', credentials.clientSecret)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('redirect_uri', callbackUrl(request, 'qq'))
  tokenUrl.searchParams.set('fmt', 'json')
  const token = await fetchQQPayload(tokenUrl.toString())
  if (!token.access_token) {
    throw new HttpError(502, 'oauth_token_failed', 'QQ 授权换取 token 失败。', token)
  }

  const openidUrl = new URL('https://graph.qq.com/oauth2.0/me')
  openidUrl.searchParams.set('access_token', token.access_token)
  openidUrl.searchParams.set('fmt', 'json')
  const openid = await fetchQQPayload(openidUrl.toString())
  if (!openid.openid) {
    throw new HttpError(502, 'oauth_openid_failed', 'QQ 授权换取 openid 失败。', openid)
  }

  const userUrl = new URL('https://graph.qq.com/user/get_user_info')
  userUrl.searchParams.set('access_token', token.access_token)
  userUrl.searchParams.set('oauth_consumer_key', credentials.clientId)
  userUrl.searchParams.set('openid', openid.openid)
  const user = await fetchJson(userUrl.toString())

  return {
    provider: 'qq',
    providerUserId: String(openid.openid),
    displayName: user.nickname || 'QQ 用户',
    avatarUrl: normalizeAvatarUrl(user.figureurl_qq_2 || user.figureurl_qq_1 || user.figureurl_2 || user.figureurl_1),
    city: [user.province, user.city].filter(Boolean).join(' '),
    bio: '',
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new HttpError(502, 'oauth_bad_response', '第三方授权服务返回了无法解析的数据。', {
      status: response.status,
      body: text.slice(0, 200),
    })
  }
  if (!response.ok) {
    throw new HttpError(502, 'oauth_request_failed', '第三方授权服务请求失败。', {
      status: response.status,
      payload,
    })
  }
  return payload
}

async function fetchQQPayload(url) {
  const response = await fetch(url)
  const text = await response.text()
  let body = text.trim()
  const callbackMatch = body.match(/^callback\((.*)\);?$/)
  if (callbackMatch) body = callbackMatch[1]

  const payload = (() => {
    try {
      return JSON.parse(body)
    } catch {
      return Object.fromEntries(new URLSearchParams(body))
    }
  })()

  if (!response.ok) {
    throw new HttpError(502, 'oauth_request_failed', 'QQ 授权服务请求失败。', {
      status: response.status,
      payload,
    })
  }

  return payload
}

function requireProviderCredentials(provider) {
  const credentials = providerCredentials(provider)
  if (credentials.missing.length) {
    throw new HttpError(501, 'oauth_not_configured', '这个第三方登录还没有配置平台凭据。', {
      missing: credentials.missing,
    })
  }
  return credentials
}

function sanitizeReturnTo(value) {
  const text = String(value || '/dashboard').trim()
  if (!text.startsWith('/') || text.startsWith('//')) return '/dashboard'
  return text.length > 120 ? text.slice(0, 120) : text
}

function normalizeAvatarUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.startsWith('https://')) return text
  if (text.startsWith('http://')) return `https://${text.slice('http://'.length)}`
  return ''
}
