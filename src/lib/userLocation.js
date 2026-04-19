// 用户手动设置的所在地（精确到辖区）。
// 前端 MVP 阶段只做本地持久化 + 订阅, 后续可以在后端服务卡片加经纬度, 用 haversine 排序。
import { useEffect, useState } from 'react'

const KEY = 'whitehive.userLocation'
const EVENT = 'whitehive:userLocation'

export function readUserLocation() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const city = typeof parsed.city === 'string' ? parsed.city.trim() : ''
    const district = typeof parsed.district === 'string' ? parsed.district.trim() : ''
    if (!city) return null
    return { city, district }
  } catch {
    return null
  }
}

export function saveUserLocation(next) {
  if (typeof window === 'undefined') return
  const city = typeof next?.city === 'string' ? next.city.trim() : ''
  const district = typeof next?.district === 'string' ? next.district.trim() : ''
  if (!city) {
    window.localStorage.removeItem(KEY)
  } else {
    window.localStorage.setItem(KEY, JSON.stringify({ city, district }))
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function clearUserLocation() {
  saveUserLocation(null)
}

export function formatUserLocation(loc) {
  if (!loc?.city) return ''
  return loc.district ? `${loc.city} · ${loc.district}` : loc.city
}

export function useUserLocation() {
  const [loc, setLoc] = useState(() => readUserLocation())

  useEffect(() => {
    const update = () => setLoc(readUserLocation())
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  return [loc, saveUserLocation]
}
