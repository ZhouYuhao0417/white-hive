// Profile shape · 用户信息的对外投影 + 信任分（纯逻辑）
//
// 不 call 任何 store, 只把传入的 user 对象按 viewerRole 剥掉内部字段。
// 用法:
//   import { publicUserShape, sellerCard, profileTrustScore } from './profile-shape.js'
//   return ok({ seller: sellerCard(user, reviewStats) })
//
// 字段约定（memory-store / postgres-store 里的 user 对象）:
//   { id, email, phone, role, displayName, avatarUrl, bio, city, school,
//     createdAt, verified, verificationStatus,
//     stats: { ordersCompleted, ordersCancelled, disputesOpened, disputesLost, avgRating } }

const DEFAULT_STATS = {
  ordersCompleted: 0,
  ordersCancelled: 0,
  disputesOpened: 0,
  disputesLost: 0,
  avgRating: null,
}

/**
 * 返回给 "我自己" 看的完整对象。
 * 只过滤掉绝对不应该下发的字段 (password hash 等)。
 */
export function selfUserShape(user) {
  if (!user) return null
  const { passwordHash, password, ...rest } = user
  return {
    ...rest,
    stats: { ...DEFAULT_STATS, ...(user.stats || {}) },
  }
}

/**
 * 返回给 "陌生人 / 列表页" 看的公开档案。
 * 不下发邮箱、手机、学校等 PII, 只保留展示所需字段 + 信任分。
 */
export function publicUserShape(user, { stats } = {}) {
  if (!user) return null
  const s = stats || user.stats || DEFAULT_STATS
  return {
    id: user.id,
    role: user.role || null,
    displayName: user.displayName || '匿名用户',
    avatarUrl: user.avatarUrl || null,
    bio: truncate(user.bio, 200),
    city: user.city || null,
    verified: !!user.verified,
    verificationStatus: user.verificationStatus || null,
    memberSince: user.createdAt || null,
    trustScore: profileTrustScore(user, s),
    badges: computeBadges(user, s),
    stats: {
      ordersCompleted: int(s.ordersCompleted),
      avgRating: Number.isFinite(s.avgRating) ? Math.round(s.avgRating * 10) / 10 : null,
    },
  }
}

/**
 * 给服务列表 / 匹配结果里的 "卖家小卡片" 用的轻量投影。
 *   只保留 id / displayName / avatarUrl / city / verified / avgRating / ordersCompleted。
 */
export function sellerCard(user, stats) {
  const s = stats || user?.stats || DEFAULT_STATS
  if (!user) return null
  const ordersCompleted = int(s.ordersCompleted)
  const avgRating = Number.isFinite(s.avgRating) ? Math.round(s.avgRating * 10) / 10 : null
  return {
    id: user.id,
    displayName: user.displayName || '匿名卖家',
    avatarUrl: user.avatarUrl || null,
    city: user.city || null,
    verified: !!user.verified,
    avgRating,
    ordersCompleted,
    trustScore: profileTrustScore(user, s),
    level: sellerLevelFor({ ordersCompleted, avgRating }),
  }
}

/**
 * 卖家等级 · 与 src/lib/sellerLevel.js 保持同步。
 * 返回 { key, tier, label, minOrders, minRating } —— 前端可以直接用来渲染徽章,
 * 不需要再掏 stats 自己算一遍。
 */
const SELLER_LEVELS = [
  { key: 'newcomer', tier: 0, label: '新秀',  minOrders: 0,   minRating: 0 },
  { key: 'regular',  tier: 1, label: '熟手',  minOrders: 5,   minRating: 4.0 },
  { key: 'gold',     tier: 2, label: '金牌',  minOrders: 20,  minRating: 4.3 },
  { key: 'diamond',  tier: 3, label: '钻石',  minOrders: 50,  minRating: 4.5 },
  { key: 'hall',     tier: 4, label: '殿堂',  minOrders: 100, minRating: 4.7 },
]

export function sellerLevelFor({ ordersCompleted = 0, avgRating = null }) {
  const orders = int(ordersCompleted)
  const rating = Number.isFinite(avgRating) ? avgRating : null
  let current = SELLER_LEVELS[0]
  for (let i = SELLER_LEVELS.length - 1; i >= 0; i -= 1) {
    const lv = SELLER_LEVELS[i]
    if (orders >= lv.minOrders && (rating == null || rating >= lv.minRating)) {
      current = lv
      break
    }
  }
  return { ...current }
}

/**
 * 给 admin 看的脱敏扩展信息。比 public 多 email / phone 末 4 位、verificationStatus 细节。
 */
export function adminUserShape(user) {
  if (!user) return null
  const self = selfUserShape(user)
  return {
    ...self,
    email: maskEmail(user.email),
    phone: maskPhone(user.phone),
  }
}

/**
 * 信任分 0-100。纯函数, 不访问 store。规则:
 *   + 基础分 20
 *   + 实名认证通过 +20
 *   + 每完成 1 单 +2, 最多 +40
 *   + 平均评分 ≥ 4.5 再加 +15; ≥ 4.0 加 +8
 *   - 每起 dispute 扣 4 分; 败诉 dispute 再多扣 6 分
 *   - 取消订单率 > 30% 扣 10 分
 *   clamp 到 [0, 100]
 */
export function profileTrustScore(user, statsArg) {
  if (!user) return 0
  const s = { ...DEFAULT_STATS, ...(statsArg || user.stats || {}) }
  let score = 20
  if (user.verified || user.verificationStatus === 'approved') score += 20
  score += Math.min(40, int(s.ordersCompleted) * 2)
  if (Number.isFinite(s.avgRating)) {
    if (s.avgRating >= 4.5) score += 15
    else if (s.avgRating >= 4.0) score += 8
  }
  score -= Math.min(20, int(s.disputesOpened) * 4)
  score -= Math.min(30, int(s.disputesLost) * 6)
  const total = int(s.ordersCompleted) + int(s.ordersCancelled)
  if (total >= 5 && int(s.ordersCancelled) / total > 0.3) score -= 10
  if (score < 0) score = 0
  if (score > 100) score = 100
  return score
}

/**
 * 从 user + stats 计算徽章列表。纯展示, 不影响权限。
 *   例: ['verified', 'top_rated', 'early_adopter']
 */
export function computeBadges(user, statsArg) {
  const s = { ...DEFAULT_STATS, ...(statsArg || user?.stats || {}) }
  const badges = []
  if (user?.verified) badges.push('verified')
  if (Number.isFinite(s.avgRating) && s.avgRating >= 4.8 && int(s.ordersCompleted) >= 10) {
    badges.push('top_rated')
  }
  if (int(s.ordersCompleted) >= 50) badges.push('veteran')
  if (int(s.ordersCompleted) >= 100) badges.push('hundred_club')
  if (user?.createdAt && Date.parse(user.createdAt) < Date.parse('2026-06-01')) {
    badges.push('early_adopter')
  }
  return badges
}

function truncate(s, max) {
  if (!s) return ''
  const str = String(s)
  return str.length > max ? str.slice(0, max) + '…' : str
}

function int(n) {
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return null
  const [u, d] = email.split('@')
  if (!d) return '***'
  const head = u.slice(0, 2)
  return `${head}***@${d}`
}

function maskPhone(phone) {
  if (!phone) return null
  const s = String(phone)
  if (s.length < 4) return '***'
  return `***${s.slice(-4)}`
}
