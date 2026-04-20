const API_BASE = '/api'
const SESSION_TOKEN_KEY = 'whitehive.sessionToken'

function getStoredSessionToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(SESSION_TOKEN_KEY) || ''
}

export function hasSessionToken() {
  return Boolean(getStoredSessionToken())
}

function saveSessionToken(token) {
  if (typeof window === 'undefined' || !token) return
  window.localStorage.setItem(SESSION_TOKEN_KEY, token)
}

export function acceptSessionToken(token) {
  saveSessionToken(token)
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_TOKEN_KEY)
}

async function request(path, options = {}) {
  const token = getStoredSessionToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.ok === false) {
    const message = payload?.error?.message || `请求失败 (${response.status})`
    throw new Error(message)
  }

  return payload?.data
}

export async function createSession(payload) {
  const data = await request('/auth/session', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (data?.session?.token) {
    saveSessionToken(data.session.token)
  }

  return data
}

export async function createProviderSession(provider, payload = {}) {
  const data = await request('/auth/provider', {
    method: 'POST',
    body: JSON.stringify({ provider, ...payload }),
  })

  if (data?.session?.token) {
    saveSessionToken(data.session.token)
  }

  return data
}

export function oauthStartUrl(provider, params = {}) {
  const search = new URLSearchParams()
  if (params.role) search.set('role', params.role)
  if (params.returnTo) search.set('returnTo', params.returnTo)
  return `${API_BASE}/auth/oauth/${encodeURIComponent(provider)}/start${search.size ? `?${search.toString()}` : ''}`
}

export function getAuthProviders() {
  return request('/auth/providers')
}

export function getSession() {
  return request('/auth/session')
}

export function requestPhoneLogin(phone) {
  return request('/auth/phone-login', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function confirmPhoneLogin(payload) {
  const data = await request('/auth/phone-login/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (data?.session?.token) {
    saveSessionToken(data.session.token)
  }

  return data
}

export function requestEmailVerification() {
  return request('/auth/email-verification', {
    method: 'POST',
  })
}

export function confirmEmailVerification(code) {
  return request('/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function requestPhoneVerification(phone) {
  return request('/auth/phone-verification', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export function confirmPhoneVerification(phone, code) {
  return request('/auth/phone-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}

export function requestPasswordReset(email) {
  return request('/auth/password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function confirmPasswordReset(payload) {
  return request('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProfile(profile) {
  return request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  })
}

export function uploadAvatar({ dataUrl, fileName, contentType }) {
  return request('/uploads/avatar', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, fileName, contentType }),
  })
}

export function getCurrentVerificationProfile() {
  return request('/auth/verification')
}

export function submitCurrentVerification(payload) {
  return request('/auth/verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteAccount() {
  return request('/auth/account', {
    method: 'DELETE',
  })
}

export function listBackendServices(params = {}) {
  const search = new URLSearchParams(params)
  return request(`/services${search.size ? `?${search.toString()}` : ''}`)
}

export function createBackendService(service) {
  return request('/services', {
    method: 'POST',
    body: JSON.stringify(service),
  })
}

export function listOrders(params = {}) {
  const search = new URLSearchParams(params)
  return request(`/orders${search.size ? `?${search.toString()}` : ''}`)
}

export function createOrder(order) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  })
}

export function updateOrder(id, changes) {
  return request(`/orders?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export function listReviews(params = {}) {
  const search = new URLSearchParams(params)
  return request(`/reviews${search.size ? `?${search.toString()}` : ''}`)
}

export function createReview(review) {
  return request('/reviews', {
    method: 'POST',
    body: JSON.stringify(review),
  })
}

export function updateReview(id, changes) {
  return request(`/reviews?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export function matchServices(input) {
  return request('/matches', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listPayments(params = {}) {
  const search = new URLSearchParams(params)
  return request(`/payments${search.size ? `?${search.toString()}` : ''}`)
}

export function createPayment(payment) {
  return request('/payments', {
    method: 'POST',
    body: JSON.stringify(payment),
  })
}

export function listMessages(orderId) {
  return request(`/messages?orderId=${encodeURIComponent(orderId)}`)
}

export function createMessage(message) {
  return request('/messages', {
    method: 'POST',
    body: JSON.stringify(message),
  })
}

export function getVerificationProfile(userId) {
  const search = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  return request(`/verification${search}`)
}

export function listVerificationRequests(params = {}) {
  const search = new URLSearchParams({ scope: 'admin', ...params })
  return request(`/verification?${search.toString()}`)
}

export function submitVerification(payload) {
  return request('/verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function reviewVerification(id, changes) {
  return request(`/verification?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}
