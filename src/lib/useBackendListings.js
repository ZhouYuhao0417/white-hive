// useBackendListings · 从 /api/services 拉真实上架服务, 映射成前端 layout 想要的 shape
//
// 用在 ServiceDetail / CDUT / Home featured 等地方。返回 { listings, loading, error, reload }。
// 接入后端前是空数组 —— 前端会渲染"暂无上架服务"的空态。

import { useCallback, useEffect, useState } from 'react'
import { listBackendServices } from './api.js'

/**
 * 把后端 service 映射为 layout views 里用的 listing 结构。
 * 后端 service: { id, category, title, summary, priceCents, deliveryDays, tags, seller, createdAt }
 * 前端 listing: { id, title, desc, price, priceUnit, days, kind, tags, rating, seller }
 */
export function normalizeBackendService(s) {
  if (!s) return null
  const priceYuan = Number.isFinite(s.priceCents) ? Math.round(s.priceCents / 100) : 0
  const firstTag = Array.isArray(s.tags) && s.tags.length > 0 ? s.tags[0] : '服务'
  const seller = s.seller || {}
  return {
    id: s.id,
    title: s.title,
    desc: s.summary,
    price: priceYuan,
    priceUnit: '起',
    days: s.deliveryDays || 7,
    kind: firstTag,
    tags: Array.isArray(s.tags) ? s.tags : [],
    rating: Number.isFinite(seller.avgRating) ? seller.avgRating : null,
    seller: {
      id: seller.id || s.sellerId || null,
      name: seller.displayName || '创作者',
      avatarUrl: seller.avatarUrl || null,
      verified: !!seller.verified,
    },
    createdAt: s.createdAt || null,
    // 展示层兜底 —— layout views 里用过这些字段 (mock 阶段遗留)
    icon: 'cube',
    grad: pickGradient(s.id || s.category),
    raw: s, // 透出原始对象给详情页 / 下单逻辑用
  }
}

const GRADIENTS = [
  ['#38BDF8', '#A78BFA', '#34D399'],
  ['#F472B6', '#FBBF24', '#FB7185'],
  ['#34D399', '#22D3EE', '#818CF8'],
  ['#FBBF24', '#F472B6', '#A78BFA'],
  ['#60A5FA', '#C084FC', '#F472B6'],
]

function pickGradient(seed) {
  if (!seed) return GRADIENTS[0]
  let h = 0
  for (let i = 0; i < String(seed).length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]
}

/**
 * 拉一个分类下的已上架服务。category 为空则拉全部。
 *   { listings, loading, error, reload, total }
 */
export function useBackendListings(category, opts = {}) {
  const [state, setState] = useState({
    listings: [],
    loading: true,
    error: null,
    total: 0,
  })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const params = category ? { category } : {}
      if (opts.sellerId) params.sellerId = opts.sellerId
      const raw = await listBackendServices(params)
      const arr = Array.isArray(raw) ? raw : raw?.services || []
      const listings = arr.map(normalizeBackendService).filter(Boolean)
      setState({ listings, loading: false, error: null, total: listings.length })
    } catch (err) {
      setState({ listings: [], loading: false, error: err, total: 0 })
    }
  }, [category, opts.sellerId])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}
