import { test, expect, describe } from 'bun:test'
import {
  orderStatuses,
  canTransition,
  assertTransition,
  applyTransition,
  availableActions,
  orderProgressPercent,
  isTerminalOrderStatus,
} from '../api/_lib/order-machine.js'

describe('order-machine · canTransition', () => {
  test('seller can accept submitted order', () => {
    expect(canTransition('submitted', 'accepted', 'seller').ok).toBe(true)
  })
  test('buyer cannot accept', () => {
    const r = canTransition('submitted', 'accepted', 'buyer')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('actor_not_allowed')
  })
  test('seller cannot jump submitted → completed', () => {
    expect(canTransition('submitted', 'completed', 'seller').ok).toBe(false)
  })
  test('buyer confirms delivered → completed', () => {
    expect(canTransition('delivered', 'completed', 'buyer').ok).toBe(true)
  })
  test('system can auto-complete delivered', () => {
    expect(canTransition('delivered', 'completed', 'system').ok).toBe(true)
  })
  test('cannot leave terminal states', () => {
    expect(canTransition('completed', 'cancelled', 'admin').ok).toBe(false)
    expect(canTransition('cancelled', 'accepted', 'admin').ok).toBe(false)
  })
  test('disputed can be resolved only by admin', () => {
    expect(canTransition('disputed', 'completed', 'admin').ok).toBe(true)
    expect(canTransition('disputed', 'completed', 'buyer').ok).toBe(false)
  })
  test('rejects unknown status', () => {
    expect(canTransition('bogus', 'completed', 'admin').ok).toBe(false)
    expect(canTransition('submitted', 'bogus', 'admin').ok).toBe(false)
  })
  test('rejects unknown actor', () => {
    expect(canTransition('submitted', 'accepted', 'alien').ok).toBe(false)
  })
  test('same status rejected', () => {
    expect(canTransition('accepted', 'accepted', 'seller').ok).toBe(false)
  })
})

describe('order-machine · assertTransition', () => {
  test('throws HttpError 409 on illegal transition', () => {
    try {
      assertTransition('completed', 'accepted', 'admin')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err.status).toBe(409)
      expect(err.code).toBe('order_transition_rejected')
    }
  })
  test('passes silently on legal transition', () => {
    expect(() => assertTransition('submitted', 'accepted', 'seller')).not.toThrow()
  })
})

describe('order-machine · applyTransition', () => {
  const base = {
    id: 'ord_1',
    status: 'submitted',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }

  test('does not mutate input', () => {
    const before = JSON.stringify(base)
    applyTransition(base, { toStatus: 'accepted', actorRole: 'seller', now: '2026-01-02T00:00:00Z' })
    expect(JSON.stringify(base)).toBe(before)
  })

  test('records history + timestamps', () => {
    const o1 = applyTransition(base, {
      toStatus: 'accepted',
      actorRole: 'seller',
      actorId: 'usr_seller',
      note: '没问题, 明天开工',
      now: '2026-01-02T00:00:00Z',
    })
    expect(o1.status).toBe('accepted')
    expect(o1.acceptedAt).toBe('2026-01-02T00:00:00Z')
    expect(o1.updatedAt).toBe('2026-01-02T00:00:00Z')
    expect(o1.statusHistory).toHaveLength(1)
    expect(o1.statusHistory[0]).toMatchObject({
      from: 'submitted',
      to: 'accepted',
      actorRole: 'seller',
      actorId: 'usr_seller',
      note: '没问题, 明天开工',
    })
  })

  test('sets specific timestamp per target status', () => {
    const accepted = applyTransition(base, {
      toStatus: 'accepted',
      actorRole: 'seller',
      now: '2026-01-02T00:00:00Z',
    })
    const delivered = applyTransition(accepted, {
      toStatus: 'delivered',
      actorRole: 'seller',
      now: '2026-01-05T00:00:00Z',
    })
    expect(delivered.deliveredAt).toBe('2026-01-05T00:00:00Z')
    expect(delivered.acceptedAt).toBe('2026-01-02T00:00:00Z') // preserved
    expect(delivered.statusHistory).toHaveLength(2)
  })

  test('throws on missing order', () => {
    expect(() => applyTransition(null, { toStatus: 'accepted', actorRole: 'seller' })).toThrow()
  })

  test('truncates long notes', () => {
    const o = applyTransition(base, {
      toStatus: 'accepted',
      actorRole: 'seller',
      note: 'x'.repeat(1000),
      now: '2026-01-02T00:00:00Z',
    })
    expect(o.statusHistory[0].note.length).toBe(400)
  })
})

describe('order-machine · availableActions', () => {
  test('seller sees accept/cancel/dispute from submitted', () => {
    const a = availableActions({ status: 'submitted' }, 'seller')
    expect(a).toContain('accepted')
    expect(a).toContain('cancelled')
  })
  test('buyer sees no actions on completed order', () => {
    expect(availableActions({ status: 'completed' }, 'buyer')).toEqual([])
  })
  test('empty on missing order', () => {
    expect(availableActions(null, 'buyer')).toEqual([])
  })
})

describe('order-machine · helpers', () => {
  test('progress percent matches status', () => {
    expect(orderProgressPercent('submitted')).toBe(10)
    expect(orderProgressPercent('completed')).toBe(100)
    expect(orderProgressPercent('bogus')).toBe(0)
  })
  test('isTerminalOrderStatus', () => {
    expect(isTerminalOrderStatus('completed')).toBe(true)
    expect(isTerminalOrderStatus('cancelled')).toBe(true)
    expect(isTerminalOrderStatus('disputed')).toBe(false)
    expect(isTerminalOrderStatus('submitted')).toBe(false)
  })
  test('orderStatuses frozen', () => {
    expect(() => (orderStatuses[0] = 'x')).toThrow()
    expect(orderStatuses).toContain('submitted')
    expect(orderStatuses).toContain('disputed')
  })
})
