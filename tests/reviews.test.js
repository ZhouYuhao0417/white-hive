import { test, expect, describe } from 'bun:test'
import {
  reviewRoles,
  reviewTags,
  normalizeReview,
  canEdit,
  applyEdit,
  publicReviewShape,
  aggregateReviews,
  hasExistingReview,
} from '../api/_lib/reviews.js'
import { HttpError } from '../api/_lib/http.js'

const base = (over = {}) => ({
  orderId: 'ord_1',
  role: 'buyer',
  reviewerId: 'usr_1',
  rating: 5,
  body: '非常棒',
  tags: ['on_time', 'great_communication'],
  now: '2026-04-16T00:00:00.000Z',
  ...over,
})

describe('reviews · enums', () => {
  test('exposes role + tag enums', () => {
    expect(reviewRoles).toContain('buyer')
    expect(reviewRoles).toContain('seller')
    expect(reviewTags).toContain('on_time')
    expect(reviewTags).toContain('low_quality')
  })
})

describe('reviews · normalizeReview', () => {
  test('happy path', () => {
    const r = normalizeReview(base())
    expect(r.orderId).toBe('ord_1')
    expect(r.role).toBe('buyer')
    expect(r.rating).toBe(5)
    expect(r.tags).toEqual(['on_time', 'great_communication'])
    expect(r.hidden).toBe(false)
    expect(r.createdAt).toBe('2026-04-16T00:00:00.000Z')
  })

  test('rejects non-integer rating', () => {
    expect(() => normalizeReview(base({ rating: 4.5 }))).toThrow(HttpError)
  })

  test('rejects rating out of 1-5', () => {
    expect(() => normalizeReview(base({ rating: 0 }))).toThrow(HttpError)
    expect(() => normalizeReview(base({ rating: 6 }))).toThrow(HttpError)
  })

  test('rejects unknown role', () => {
    expect(() => normalizeReview(base({ role: 'admin' }))).toThrow(HttpError)
  })

  test('rejects oversize body', () => {
    expect(() => normalizeReview(base({ body: 'a'.repeat(601) }))).toThrow(HttpError)
  })

  test('dedupes and drops unknown tags', () => {
    const r = normalizeReview(
      base({ tags: ['on_time', 'ON_TIME', 'nope', 'over_delivered', 'garbage'] }),
    )
    expect(r.tags).toEqual(['on_time', 'over_delivered'])
  })

  test('caps tags to 6', () => {
    const r = normalizeReview(
      base({
        tags: [
          'on_time',
          'great_communication',
          'over_delivered',
          'exact_brief',
          'late',
          'poor_communication',
          'low_quality', // 7th
        ],
      }),
    )
    expect(r.tags.length).toBe(6)
  })

  test('only keeps https attachments, caps 10', () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://cdn.example.com/${i}.jpg`)
    urls.push('http://insecure.com/x.jpg', 'not-a-url')
    const r = normalizeReview(base({ attachments: urls }))
    expect(r.attachments.length).toBe(10)
    expect(r.attachments.every((u) => u.startsWith('https://'))).toBe(true)
  })
})

describe('reviews · canEdit / applyEdit', () => {
  test('canEdit returns true inside 48h window', () => {
    const r = normalizeReview(base())
    expect(canEdit(r, { now: '2026-04-17T00:00:00.000Z' })).toBe(true) // +24h
    expect(canEdit(r, { now: '2026-04-18T00:00:01.000Z' })).toBe(false) // > 48h
  })

  test('canEdit false for hidden review', () => {
    const r = { ...normalizeReview(base()), hidden: true }
    expect(canEdit(r, { now: '2026-04-16T01:00:00.000Z' })).toBe(false)
  })

  test('applyEdit updates rating + body inside window', () => {
    const r = normalizeReview(base())
    const edited = applyEdit(
      r,
      { rating: 4, body: '更理性一点的回忆' },
      { now: '2026-04-17T00:00:00.000Z' },
    )
    expect(edited.rating).toBe(4)
    expect(edited.body).toBe('更理性一点的回忆')
    expect(edited.createdAt).toBe(r.createdAt)
    expect(edited.updatedAt).toBe('2026-04-17T00:00:00.000Z')
  })

  test('applyEdit throws 409 after lock window', () => {
    const r = normalizeReview(base())
    expect(() =>
      applyEdit(r, { rating: 4 }, { now: '2026-04-20T00:00:00.000Z' }),
    ).toThrow(HttpError)
  })

  test('applyEdit throws 404 on null review', () => {
    expect(() => applyEdit(null, { rating: 4 })).toThrow(HttpError)
  })
})

describe('reviews · publicReviewShape', () => {
  test('null / hidden → null', () => {
    expect(publicReviewShape(null)).toBeNull()
    expect(publicReviewShape({ ...normalizeReview(base()), hidden: true })).toBeNull()
  })

  test('strips reviewerId, keeps role', () => {
    const r = normalizeReview(base())
    const shape = publicReviewShape(r)
    expect(shape.role).toBe('buyer')
    expect(shape.reviewerId).toBeUndefined()
    expect(shape.rating).toBe(5)
  })
})

describe('reviews · aggregateReviews', () => {
  test('empty list → zero stats', () => {
    const agg = aggregateReviews([])
    expect(agg.count).toBe(0)
    expect(agg.average).toBe(0)
    expect(agg.topTags).toEqual([])
  })

  test('computes average / distribution / positiveRate / topTags', () => {
    const reviews = [
      normalizeReview(base({ rating: 5, tags: ['on_time'] })),
      normalizeReview(base({ rating: 4, tags: ['on_time', 'great_communication'] })),
      normalizeReview(base({ rating: 2, tags: ['late'] })),
      normalizeReview(base({ rating: 5, tags: ['on_time'] })),
    ]
    const agg = aggregateReviews(reviews)
    expect(agg.count).toBe(4)
    expect(agg.average).toBe(4) // (5+4+2+5)/4 = 4
    expect(agg.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 2 })
    expect(agg.positiveRate).toBe(0.75) // 3/4 >= 4 stars
    expect(agg.topTags[0].tag).toBe('on_time')
    expect(agg.topTags[0].count).toBe(3)
    expect(agg.topTags[0].positive).toBe(true)
  })

  test('excludes hidden reviews', () => {
    const reviews = [
      normalizeReview(base({ rating: 5 })),
      { ...normalizeReview(base({ rating: 1 })), hidden: true },
    ]
    const agg = aggregateReviews(reviews)
    expect(agg.count).toBe(1)
    expect(agg.average).toBe(5)
  })
})

describe('reviews · hasExistingReview', () => {
  test('detects duplicate buyer review on same order', () => {
    const reviews = [normalizeReview(base({ role: 'buyer' }))]
    expect(hasExistingReview(reviews, { orderId: 'ord_1', role: 'buyer' })).toBe(true)
    expect(hasExistingReview(reviews, { orderId: 'ord_1', role: 'seller' })).toBe(false)
    expect(hasExistingReview(reviews, { orderId: 'ord_2', role: 'buyer' })).toBe(false)
  })

  test('handles non-array input', () => {
    expect(hasExistingReview(null, { orderId: 'x', role: 'buyer' })).toBe(false)
  })
})
