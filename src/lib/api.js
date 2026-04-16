const API_BASE = '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.ok === false) {
    const message = payload?.error?.message || `请求失败 (${response.status})`
    throw new Error(message)
  }

  return payload?.data
}

export function createSession({ email, password, mode }) {
  return request('/auth/session', {
    method: 'POST',
    body: JSON.stringify({ email, password, mode }),
  })
}

export function getSession() {
  return request('/auth/session')
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
