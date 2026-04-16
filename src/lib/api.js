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

export function getSession() {
  return request('/auth/session')
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

export function updateProfile(profile) {
  return request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(profile),
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

export function getVerificationProfile(userId = 'usr_demo_seller') {
  return request(`/verification?userId=${encodeURIComponent(userId)}`)
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
