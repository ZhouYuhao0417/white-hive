import { test, expect, describe } from 'bun:test'
import {
  orderDeadline,
  timeUntil,
  isOverdue,
  slaDeadline,
  autoReleaseAt,
  reviewEditDeadline,
  nextSlaMilestone,
  windowStart,
  humanizeRelative,
} from '../api/_lib/deadline.js'

describe('deadline · orderDeadline', () => {
  test('createdAt + deliveryDays', () => {
    const d = orderDeadline({ createdAt: '2026-01-01T00:00:00Z', deliveryDays: 3 })
    expect(d).toBe('2026-01-04T00:00:00.000Z')
  })
  test('startedAt overrides createdAt', () => {
    const d = orderDeadline({
      createdAt: '2026-01-01T00:00:00Z',
      startedAt: '2026-01-02T00:00:00Z',
      deliveryDays: 3,
    })
    expect(d).toBe('2026-01-05T00:00:00.000Z')
  })
  test('null on missing data', () => {
    expect(orderDeadline({})).toBeNull()
    expect(orderDeadline({ createdAt: '2026-01-01T00:00:00Z' })).toBeNull()
    expect(orderDeadline({ createdAt: '2026-01-01T00:00:00Z', deliveryDays: -1 })).toBeNull()
  })
})

describe('deadline · timeUntil / isOverdue', () => {
  test('future deadline → positive', () => {
    const r = timeUntil('2026-01-10T00:00:00Z', '2026-01-08T00:00:00Z')
    expect(r.overdue).toBe(false)
    expect(r.days).toBe(2)
  })
  test('past deadline → overdue', () => {
    const r = timeUntil('2026-01-01T00:00:00Z', '2026-01-05T00:00:00Z')
    expect(r.overdue).toBe(true)
    expect(isOverdue('2026-01-01T00:00:00Z', '2026-01-05T00:00:00Z')).toBe(true)
  })
  test('null deadline', () => {
    expect(timeUntil(null, '2026-01-01T00:00:00Z')).toEqual({ ms: null, days: null, overdue: false })
    expect(isOverdue(null, '2026-01-01T00:00:00Z')).toBe(false)
  })
  test('invalid date throws', () => {
    expect(() => timeUntil('2026-01-10T00:00:00Z', 'bogus')).toThrow()
  })
})

describe('deadline · slaDeadline / autoReleaseAt / reviewEditDeadline', () => {
  test('sla 48h from fromIso', () => {
    expect(slaDeadline({ fromIso: '2026-01-01T00:00:00Z', hours: 48 })).toBe(
      '2026-01-03T00:00:00.000Z',
    )
  })
  test('autoRelease default 7d', () => {
    const d = autoReleaseAt({ deliveredAt: '2026-01-01T00:00:00Z' })
    expect(d).toBe('2026-01-08T00:00:00.000Z')
  })
  test('autoRelease custom hours', () => {
    expect(autoReleaseAt({ deliveredAt: '2026-01-01T00:00:00Z', hours: 24 })).toBe(
      '2026-01-02T00:00:00.000Z',
    )
  })
  test('reviewEdit default 48h', () => {
    expect(reviewEditDeadline({ createdAt: '2026-01-01T00:00:00Z' })).toBe(
      '2026-01-03T00:00:00.000Z',
    )
  })
  test('nulls when missing', () => {
    expect(autoReleaseAt({})).toBeNull()
    expect(reviewEditDeadline({})).toBeNull()
    expect(slaDeadline({ hours: -1 })).toBeNull()
  })
})

describe('deadline · nextSlaMilestone', () => {
  test('delivered → auto_release milestone', () => {
    const m = nextSlaMilestone(
      { status: 'delivered', deliveredAt: '2026-01-01T00:00:00Z' },
      '2026-01-02T00:00:00Z',
    )
    expect(m.kind).toBe('auto_release')
    expect(m.overdue).toBe(false)
    expect(m.hoursRemaining).toBeGreaterThan(140)
  })
  test('accepted with deliveryDays → delivery_due', () => {
    const m = nextSlaMilestone(
      {
        status: 'accepted',
        createdAt: '2026-01-01T00:00:00Z',
        deliveryDays: 3,
      },
      '2026-01-05T00:00:00Z',
    )
    expect(m.kind).toBe('delivery_due')
    expect(m.overdue).toBe(true)
  })
  test('completed returns null (no next)', () => {
    expect(nextSlaMilestone({ status: 'completed' }, '2026-01-01T00:00:00Z')).toBeNull()
  })
  test('null on missing order', () => {
    expect(nextSlaMilestone(null, '2026-01-01T00:00:00Z')).toBeNull()
  })
})

describe('deadline · windowStart / humanizeRelative', () => {
  test('windowStart day', () => {
    expect(windowStart({ kind: 'day', now: '2026-01-02T00:00:00Z' })).toBe(
      '2026-01-01T00:00:00.000Z',
    )
  })
  test('windowStart unknown kind throws', () => {
    expect(() => windowStart({ kind: 'century' })).toThrow()
  })
  test('humanize fresh → 刚刚', () => {
    expect(humanizeRelative('2026-01-01T00:00:00Z', '2026-01-01T00:00:30Z')).toBe('刚刚')
  })
  test('humanize minutes / hours / yesterday / days', () => {
    const base = '2026-01-10T12:00:00Z'
    expect(humanizeRelative('2026-01-10T11:55:00Z', base)).toMatch(/分钟前/)
    expect(humanizeRelative('2026-01-10T09:00:00Z', base)).toMatch(/小时前/)
    expect(humanizeRelative('2026-01-09T12:00:00Z', base)).toBe('昨天')
    expect(humanizeRelative('2026-01-05T12:00:00Z', base)).toMatch(/天前/)
    expect(humanizeRelative('2025-10-01T00:00:00Z', base)).toMatch(/\d{4}-\d{2}-\d{2}/)
  })
  test('humanize future returns 即将', () => {
    expect(humanizeRelative('2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe('即将')
  })
  test('humanize null safe', () => {
    expect(humanizeRelative(null, '2026-01-01T00:00:00Z')).toBe('')
  })
})
