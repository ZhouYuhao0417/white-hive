// 卖家等级制度 · 纯函数
//
// 以「累计完成订单数」为主轴, 「平均评分」做门槛:
// 完成订单数够了但评分没达到门槛 → 停留在上一级
// 没有评分(null) → 不卡门槛, 按订单数直升
//
// 5 档, 从低到高:
//   L0 · 新秀   0-4 单
//   L1 · 熟手   ≥5 单 + avgRating ≥ 4.0
//   L2 · 金牌   ≥20 单 + avgRating ≥ 4.3
//   L3 · 钻石   ≥50 单 + avgRating ≥ 4.5
//   L4 · 殿堂   ≥100 单 + avgRating ≥ 4.7
//
// 前端用 computeSellerLevel(stats) 拿到 { key, label, tier, color, minOrders, minRating, next }
// 后端 api/_lib/profile-shape.js 里也可以拼同样的规则返回给客户端。

export const SELLER_LEVELS = [
  {
    key: 'newcomer',
    tier: 0,
    label: '新秀',
    labelEn: 'Newcomer',
    color: '#9CA3AF', // gray
    minOrders: 0,
    minRating: 0,
  },
  {
    key: 'regular',
    tier: 1,
    label: '熟手',
    labelEn: 'Regular',
    color: '#7FD3FF', // ice blue
    minOrders: 5,
    minRating: 4.0,
  },
  {
    key: 'gold',
    tier: 2,
    label: '金牌',
    labelEn: 'Gold',
    color: '#FBBF24', // amber
    minOrders: 20,
    minRating: 4.3,
  },
  {
    key: 'diamond',
    tier: 3,
    label: '钻石',
    labelEn: 'Diamond',
    color: '#5EEAD4', // mint
    minOrders: 50,
    minRating: 4.5,
  },
  {
    key: 'hall',
    tier: 4,
    label: '殿堂',
    labelEn: 'Hall of Fame',
    color: '#A5B4FC', // indigo
    minOrders: 100,
    minRating: 4.7,
  },
]

/**
 * 给定 stats 计算卖家等级.
 * @param {object} stats
 * @param {number} stats.ordersCompleted
 * @param {number|null} stats.avgRating  null 表示还没被评分过
 * @returns 当前等级对象 + 下一级目标 next(null 表示已封顶)
 */
export function computeSellerLevel(stats = {}) {
  const orders = Number.isFinite(stats.ordersCompleted) ? Math.max(0, Math.floor(stats.ordersCompleted)) : 0
  const rating = Number.isFinite(stats.avgRating) ? stats.avgRating : null

  // 自上而下找第一个满足条件的档位
  let current = SELLER_LEVELS[0]
  for (let i = SELLER_LEVELS.length - 1; i >= 0; i -= 1) {
    const lv = SELLER_LEVELS[i]
    if (orders >= lv.minOrders && (rating == null || rating >= lv.minRating)) {
      current = lv
      break
    }
  }

  const next = SELLER_LEVELS[current.tier + 1] || null
  const progress = next
    ? {
        ordersNeeded: Math.max(0, next.minOrders - orders),
        ratingNeeded: rating != null ? Math.max(0, +(next.minRating - rating).toFixed(2)) : 0,
        ordersPct: Math.min(1, orders / next.minOrders),
      }
    : null

  return { ...current, orders, rating, next, progress }
}

/**
 * 简写描述: "金牌 · 28 单 · ★ 4.5"
 */
export function describeSellerLevel(stats) {
  const lv = computeSellerLevel(stats)
  const parts = [lv.label, `${lv.orders} 单`]
  if (lv.rating != null) parts.push(`★ ${lv.rating.toFixed(1)}`)
  return parts.join(' · ')
}
