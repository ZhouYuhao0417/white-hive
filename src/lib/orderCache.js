const orderListKey = 'whitehive:mvp:orders'
const cacheKey = (id) => `whitehive:mvp:order:${id}`

export function cacheOrder(order) {
  if (!order?.id || typeof window === 'undefined') return
  window.localStorage.setItem(cacheKey(order.id), JSON.stringify(order))

  const current = readCachedOrders()
  const next = [order, ...current.filter((item) => item.id !== order.id)].slice(0, 20)
  window.localStorage.setItem(orderListKey, JSON.stringify(next))
}

export function readCachedOrder(id) {
  if (!id || typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(cacheKey(id))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function readCachedOrders() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(orderListKey)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
