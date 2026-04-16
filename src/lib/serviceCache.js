const serviceListKey = 'whitehive:mvp:services'

export function cacheService(service) {
  if (!service?.id || typeof window === 'undefined') return

  const current = readCachedServices()
  const next = [service, ...current.filter((item) => item.id !== service.id)].slice(0, 12)
  window.localStorage.setItem(serviceListKey, JSON.stringify(next))
}

export function readCachedServices() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(serviceListKey)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
