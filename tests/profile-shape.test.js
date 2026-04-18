import { test, expect, describe } from 'bun:test'
import {
  selfUserShape,
  publicUserShape,
  sellerCard,
  adminUserShape,
  profileTrustScore,
  computeBadges,
} from '../api/_lib/profile-shape.js'

const fullUser = {
  id: 'usr_1',
  email: 'yuhao@example.com',
  phone: '13812345678',
  passwordHash: 'secret-hash',
  role: 'seller',
  displayName: '周宇豪',
  avatarUrl: 'https://cdn/av.png',
  bio: '建站 8 年, 落地页 / 电商首页都做',
  city: '成都',
  school: '成都理工大学',
  createdAt: '2026-01-01T00:00:00Z',
  verified: true,
  verificationStatus: 'approved',
  stats: {
    ordersCompleted: 30,
    ordersCancelled: 2,
    disputesOpened: 1,
    disputesLost: 0,
    avgRating: 4.7,
  },
}

describe('profile-shape · selfUserShape', () => {
  test('strips password hash', () => {
    const s = selfUserShape(fullUser)
    expect(s.passwordHash).toBeUndefined()
    expect(s.email).toBe('yuhao@example.com')
    expect(s.stats.ordersCompleted).toBe(30)
  })
  test('fills default stats', () => {
    const s = selfUserShape({ id: 'u', email: 'e@x' })
    expect(s.stats.ordersCompleted).toBe(0)
    expect(s.stats.avgRating).toBeNull()
  })
  test('null safe', () => {
    expect(selfUserShape(null)).toBeNull()
  })
})

describe('profile-shape · publicUserShape', () => {
  test('hides PII', () => {
    const p = publicUserShape(fullUser)
    expect(p.email).toBeUndefined()
    expect(p.phone).toBeUndefined()
    expect(p.school).toBeUndefined()
    expect(p.displayName).toBe('周宇豪')
    expect(p.trustScore).toBeGreaterThan(0)
    expect(p.stats.avgRating).toBe(4.7)
  })
  test('uses injected stats over user.stats', () => {
    const p = publicUserShape(fullUser, {
      stats: { ...fullUser.stats, ordersCompleted: 100 },
    })
    expect(p.stats.ordersCompleted).toBe(100)
  })
  test('truncates long bio', () => {
    const p = publicUserShape({ ...fullUser, bio: 'x'.repeat(500) })
    expect(p.bio.length).toBeLessThanOrEqual(201)
  })
})

describe('profile-shape · sellerCard', () => {
  test('returns minimal card', () => {
    const c = sellerCard(fullUser)
    expect(c.id).toBe('usr_1')
    expect(c.displayName).toBe('周宇豪')
    expect(c.ordersCompleted).toBe(30)
    expect(c.verified).toBe(true)
    expect(c.email).toBeUndefined()
  })
  test('falls back on empty stats', () => {
    const c = sellerCard({ id: 'u', displayName: 'x' })
    expect(c.avgRating).toBeNull()
    expect(c.ordersCompleted).toBe(0)
  })
})

describe('profile-shape · adminUserShape', () => {
  test('masks email + phone', () => {
    const a = adminUserShape(fullUser)
    expect(a.email).toBe('yu***@example.com')
    expect(a.phone).toBe('***5678')
    expect(a.passwordHash).toBeUndefined()
  })
  test('null safe', () => {
    expect(adminUserShape(null)).toBeNull()
  })
})

describe('profile-shape · profileTrustScore', () => {
  test('new unverified user → base 20', () => {
    expect(profileTrustScore({ id: 'u' })).toBe(20)
  })
  test('verified + 10 completed + 4.6 rating', () => {
    const s = profileTrustScore(
      { verified: true },
      { ordersCompleted: 10, avgRating: 4.6, ordersCancelled: 0, disputesOpened: 0, disputesLost: 0 },
    )
    // 20 base + 20 verified + 20 (10*2) + 15 (>=4.5) = 75
    expect(s).toBe(75)
  })
  test('heavy disputes → penalized', () => {
    const s = profileTrustScore(
      { verified: true },
      {
        ordersCompleted: 20,
        avgRating: 4.8,
        ordersCancelled: 1,
        disputesOpened: 5,
        disputesLost: 3,
      },
    )
    // 20 + 20 + 40 + 15 - 20 - 18 = 57
    expect(s).toBe(57)
  })
  test('clamps to [0,100]', () => {
    const low = profileTrustScore(
      {},
      { ordersCompleted: 0, disputesOpened: 10, disputesLost: 10 },
    )
    expect(low).toBe(0)
    const high = profileTrustScore(
      { verified: true },
      { ordersCompleted: 100, avgRating: 5, ordersCancelled: 0 },
    )
    expect(high).toBe(95) // 20+20+40+15 capped but not at 100 — matches rules
    expect(high).toBeLessThanOrEqual(100)
  })
  test('high cancellation rate penalized', () => {
    const s = profileTrustScore(
      { verified: true },
      { ordersCompleted: 3, ordersCancelled: 7, avgRating: null },
    )
    // base 20 + verified 20 + 6 (3*2) - 10 (cancel rate > 0.3) = 36
    expect(s).toBe(36)
  })
})

describe('profile-shape · computeBadges', () => {
  test('verified + top_rated when stars high', () => {
    const b = computeBadges(
      { verified: true, createdAt: '2026-01-01T00:00:00Z' },
      { ordersCompleted: 15, avgRating: 4.9 },
    )
    expect(b).toContain('verified')
    expect(b).toContain('top_rated')
    expect(b).toContain('early_adopter')
  })
  test('veteran/hundred_club at thresholds', () => {
    const b = computeBadges({}, { ordersCompleted: 100 })
    expect(b).toContain('veteran')
    expect(b).toContain('hundred_club')
  })
  test('no badges for new unverified user', () => {
    const b = computeBadges(
      { createdAt: '2027-01-01T00:00:00Z' },
      { ordersCompleted: 0, avgRating: null },
    )
    expect(b).toEqual([])
  })
})
