// Reviews · 订单完成后的评价系统（纯逻辑）
//
// 策略：
//   - 每张已完成订单允许 buyer + seller 各留一条评价（所以同一订单最多 2 条）
//   - 1-5 星, 必须整数
//   - 可选文字（≤ 600 字）+ 可选 tags（来自平台枚举）+ 可选 10 张附件 url
//   - 评价创建后 48 小时内可以编辑一次, 之后锁定
//   - 平台 flag 允许 admin 隐藏显著违规评价（hidden=true 后对外不展示）
//
// 不负责持久化 —— store 层把 validate + publicReviewShape 串起来即可。

import { HttpError } from './http.js'

export const reviewRoles = Object.freeze(['buyer', 'seller'])
const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000

// 平台统一的 tag 枚举（保持小而稳定，避免 tag 爆炸）
export const reviewTags = Object.freeze([
  'on_time', // 按时交付
  'great_communication', // 沟通顺畅
  'over_delivered', // 超出预期
  'exact_brief', // 完全贴合需求
  'late', // 延期交付
  'poor_communication', // 沟通不畅
  'off_brief', // 偏离需求
  'low_quality', // 质量一般
  'dispute_prone', // 易起争议
])

const POSITIVE_TAGS = new Set(['on_time', 'great_communication', 'over_delivered', 'exact_brief'])

/**
 * 校验 & 规整一条新评价。抛 HttpError(400) 表示入参不合法。
 *
 * @param {object} input
 * @param {string} input.orderId          必填
 * @param {'buyer'|'seller'} input.role   必填
 * @param {string} input.reviewerId       必填
 * @param {number} input.rating           必填 1-5 整数
 * @param {string} [input.body]
 * @param {string[]} [input.tags]
 * @param {string[]} [input.attachments]
 * @param {string} [input.now]            ISO, 默认 new Date().toISOString()
 */
export function normalizeReview(input = {}) {
  const { orderId, role, reviewerId, rating } = input
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpError(400, 'invalid_review', 'orderId 必填。')
  }
  if (!reviewerId || typeof reviewerId !== 'string') {
    throw new HttpError(400, 'invalid_review', 'reviewerId 必填。')
  }
  if (!reviewRoles.includes(role)) {
    throw new HttpError(400, 'invalid_review', 'role 必须是 buyer 或 seller。')
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'invalid_review', 'rating 必须是 1-5 的整数。')
  }

  const body = typeof input.body === 'string' ? input.body.trim() : ''
  if (body.length > 600) {
    throw new HttpError(400, 'invalid_review', '评价正文不能超过 600 字。')
  }

  const rawTags = Array.isArray(input.tags) ? input.tags : []
  const tags = Array.from(
    new Set(rawTags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)),
  ).filter((t) => reviewTags.includes(t)).slice(0, 6)

  const attachments = Array.isArray(input.attachments)
    ? input.attachments
        .map((u) => String(u || '').trim())
        .filter((u) => u.startsWith('https://'))
        .slice(0, 10)
    : []

  const createdAt = input.now || new Date().toISOString()

  return {
    orderId,
    reviewerId,
    role,
    rating,
    body,
    tags,
    attachments,
    hidden: false,
    createdAt,
    updatedAt: createdAt,
  }
}

/**
 * 判断一条已存在评价是否还能被 reviewer 编辑（仅限 48 小时内）。
 */
export function canEdit(review, { now } = {}) {
  if (!review || review.hidden) return false
  const anchor = new Date(review.createdAt || 0).getTime()
  if (!anchor) return false
  const cutoff = anchor + EDIT_WINDOW_MS
  const currentMs = now ? new Date(now).getTime() : Date.now()
  return currentMs <= cutoff
}

/**
 * 用新字段在旧评价上做一次合法编辑（只允许 rating / body / tags / attachments 变）。
 * 其它字段保留。createdAt 不动, updatedAt 刷新。
 */
export function applyEdit(review, patch, { now } = {}) {
  if (!review) {
    throw new HttpError(404, 'review_not_found', '评价不存在。')
  }
  if (!canEdit(review, { now })) {
    throw new HttpError(409, 'review_locked', '评价已超过 48 小时编辑窗口。')
  }

  const merged = normalizeReview({
    orderId: review.orderId,
    role: review.role,
    reviewerId: review.reviewerId,
    rating: patch.rating ?? review.rating,
    body: patch.body ?? review.body,
    tags: patch.tags ?? review.tags,
    attachments: patch.attachments ?? review.attachments,
    now: review.createdAt,
  })
  merged.createdAt = review.createdAt
  merged.hidden = review.hidden || false
  merged.updatedAt = now || new Date().toISOString()
  return merged
}

/**
 * 公共投影 —— 隐藏 reviewerId 的具体值, 只暴露 role。
 */
export function publicReviewShape(review) {
  if (!review) return null
  if (review.hidden) return null
  return {
    orderId: review.orderId,
    role: review.role,
    rating: review.rating,
    body: review.body || '',
    tags: review.tags || [],
    attachments: review.attachments || [],
    createdAt: review.createdAt,
    updatedAt: review.updatedAt || review.createdAt,
  }
}

/**
 * 在多条评价上计算统计，用于 service / seller 详情页展示。
 *
 * 输出：
 *   { count, average, distribution: {1,2,3,4,5}, positiveRate, topTags: [{tag,count}] }
 *
 * 只统计未隐藏的评价。
 */
export function aggregateReviews(reviews = []) {
  const visible = (reviews || []).filter((r) => r && !r.hidden && Number.isFinite(r.rating))
  const count = visible.length
  if (count === 0) {
    return {
      count: 0,
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      positiveRate: 0,
      topTags: [],
    }
  }

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const tagCounts = new Map()
  let sum = 0
  let positiveCount = 0

  for (const r of visible) {
    const bucket = Math.max(1, Math.min(5, Math.round(r.rating)))
    distribution[bucket] += 1
    sum += r.rating
    if (r.rating >= 4) positiveCount += 1
    for (const t of r.tags || []) {
      if (!reviewTags.includes(t)) continue
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
    }
  }

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, n]) => ({ tag, count: n, positive: POSITIVE_TAGS.has(tag) }))

  return {
    count,
    average: Math.round((sum / count) * 100) / 100,
    distribution,
    positiveRate: Math.round((positiveCount / count) * 100) / 100,
    topTags,
  }
}

/**
 * "某 role 在某 order 上是否已留过评价" —— 避免重复提交。
 * 调用方传入该订单已有评价列表即可。
 */
export function hasExistingReview(reviews, { orderId, role }) {
  if (!Array.isArray(reviews)) return false
  return reviews.some((r) => r?.orderId === orderId && r?.role === role)
}
