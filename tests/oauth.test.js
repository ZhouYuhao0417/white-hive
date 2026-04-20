import { describe, expect, test, beforeEach } from 'bun:test'
import {
  buildOAuthStartUrl,
  createOAuthState,
  oauthProviderStatus,
  verifyOAuthState,
} from '../api/_lib/oauth.js'
import { HttpError } from '../api/_lib/http.js'
import { clearProductionEnv } from './helpers.js'

const request = new Request('https://www.whitehive.cn/api/auth/oauth/wechat/start')

describe('oauth · provider status', () => {
  beforeEach(() => {
    clearProductionEnv()
  })

  test('reports unavailable when provider credentials are missing', () => {
    expect(oauthProviderStatus('wechat')).toEqual({
      mode: 'unavailable',
      configured: false,
      missing: ['WECHAT_CLIENT_ID', 'WECHAT_CLIENT_SECRET'],
    })
  })

  test('reports live when provider credentials are present', () => {
    process.env.QQ_CLIENT_ID = 'qq-app-id'
    process.env.QQ_CLIENT_SECRET = 'qq-secret'
    expect(oauthProviderStatus('qq')).toEqual({
      mode: 'live',
      configured: true,
      missing: [],
    })
  })
})

describe('oauth · state', () => {
  beforeEach(() => {
    clearProductionEnv()
    process.env.WHITEHIVE_OAUTH_STATE_SECRET = 'test-state-secret'
  })

  test('round-trips signed state and sanitizes returnTo', () => {
    const state = createOAuthState({
      provider: 'wechat',
      role: 'seller',
      returnTo: '/dashboard',
    })
    const parsed = verifyOAuthState(state, 'wechat')
    expect(parsed.provider).toBe('wechat')
    expect(parsed.role).toBe('seller')
    expect(parsed.returnTo).toBe('/dashboard')
  })

  test('rejects tampered or mismatched state', () => {
    const state = createOAuthState({ provider: 'qq' })
    expect(() => verifyOAuthState(`${state}x`, 'qq')).toThrow(HttpError)
    expect(() => verifyOAuthState(state, 'wechat')).toThrow(HttpError)
  })
})

describe('oauth · authorize URLs', () => {
  beforeEach(() => {
    clearProductionEnv()
    process.env.WHITEHIVE_SITE_URL = 'https://www.whitehive.cn'
    process.env.WHITEHIVE_OAUTH_STATE_SECRET = 'test-state-secret'
  })

  test('builds WeChat qrconnect authorize URL', () => {
    process.env.WECHAT_CLIENT_ID = 'wx-app-id'
    process.env.WECHAT_CLIENT_SECRET = 'wx-secret'
    const url = buildOAuthStartUrl(request, 'wechat', { role: 'buyer' })
    expect(url.startsWith('https://open.weixin.qq.com/connect/qrconnect?')).toBe(true)
    expect(url).toContain('appid=wx-app-id')
    expect(url).toContain('scope=snsapi_login')
    expect(url).toContain(encodeURIComponent('https://www.whitehive.cn/api/auth/oauth/wechat/callback'))
    expect(url.endsWith('#wechat_redirect')).toBe(true)
  })

  test('builds QQ authorize URL', () => {
    process.env.QQ_CLIENT_ID = 'qq-app-id'
    process.env.QQ_CLIENT_SECRET = 'qq-secret'
    const url = buildOAuthStartUrl(request, 'qq', { role: 'buyer' })
    expect(url.startsWith('https://graph.qq.com/oauth2.0/authorize?')).toBe(true)
    expect(url).toContain('client_id=qq-app-id')
    expect(url).toContain('scope=get_user_info')
    expect(url).toContain(encodeURIComponent('https://www.whitehive.cn/api/auth/oauth/qq/callback'))
  })

  test('throws when credentials are missing', () => {
    expect(() => buildOAuthStartUrl(request, 'github')).toThrow(HttpError)
  })
})
