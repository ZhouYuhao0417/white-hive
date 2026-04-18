import { test, expect, describe } from 'bun:test'
import { cascadeOnOrderTransition, canAutoComplete } from '../api/_lib/payment-cascade.js'

const basePayment = {
  id: 'pay_1',
  orderId: 'ord_1',
  escrowStatus: 'held',
  amountCents: 100000,
  buyerConfirmedAt: null,
  sellerReadyAt: null,
}

describe('payment-cascade · completed', () => {
  test('held → release on completed', () => {
    const r = cascadeOnOrderTransition({
      fromStatus: 'delivered',
      toStatus: 'completed',
      actorRole: 'buyer',
      payment: basePayment,
      now: '2026-02-01T00:00:00Z',
    })
    expect(r.skipped).toBe(false)
    expect(r.released).toBe(true)
    expect(r.paymentPatch.escrowStatus).toBe('released')
    expect(r.paymentPatch.releasedAt).toBe('2026-02-01T00:00:00Z')
  })
  test('already released → skipped', () => {
    const r = cascadeOnOrderTransition({
      fromStatus: 'delivered',
      toStatus: 'completed',
      actorRole: 'buyer',
      payment: { ...basePayment, escrowStatus: 'released', releasedAt: '2026-01-01' },
    })
    expect(r.skipped).toBe(true)
    expect(r.reason).toBe('already_released')
    expect(r.paymentPatch).toBeNull()
  })
  test('escrow not held → skipped', () => {
    const r = cascadeOnOrderTransition({
      fromStatus: 'accepted',
      toStatus: 'completed',
      actorRole: 'admin',
      payment: { ...basePayment, escrowStatus: 'none' },
    })
    expect(r.skipped).toBe(true)
    expect(r.reason).toBe('escrow_not_held')
  })
})

describe('payment-cascade · cancelled', () => {
  test('held → refund', () => {
    const r = cascadeOnOrderTransition({
      fromStatus: 'accepted',
      toStatus: 'cancelled',
      actorRole: 'buyer',
      payment: basePayment,
      now: '2026-02-01T00:00:00Z',
    })
    expect(r.refunded).toBe(true)
    expect(r.paymentPatch.escrowStatus).toBe('refunded')
    expect(r.paymentPatch.refundedAt).toBe('2026-02-01T00:00:00Z')
  })
  test('unfunded → skipped', () => {
    const r = cascadeOnOrderTransition({
      fromStatus: 'submitted',
      toStatus: 'cancelled',
      actorRole: 'buyer',
      payment: { ...basePayment, escrowStatus: 'none' },
    })
    expect(r.skipped).toBe(true)
    expect(r.reason).toBe('escrow_not_funded')
  })
  test('already released → cannot refund', () => {
    const r = cascadeOnOrderTransition({
      fromStatus: 'completed',
      toStatus: 'cancelled',
      actorRole: 'admin',
      payment: { ...basePayment, escrowStatus: 'released' },
    })
    expect(r.skipped).toBe(true)
    expect(r.reason).toBe('already_released')
  })
})

describe('payment-cascade · non-cascading transitions', () => {
  test('accepted / in_progress / delivered → nothing', () => {
    for (const target of ['accepted', 'in_progress', 'delivered', 'disputed']) {
      const r = cascadeOnOrderTransition({
        fromStatus: 'submitted',
        toStatus: target,
        actorRole: 'seller',
        payment: basePayment,
      })
      expect(r.skipped).toBe(true)
      expect(r.paymentPatch).toBeNull()
    }
  })
  test('null payment → skipped with no_payment', () => {
    const r = cascadeOnOrderTransition({
      fromStatus: 'delivered',
      toStatus: 'completed',
      payment: null,
    })
    expect(r.skipped).toBe(true)
    expect(r.reason).toBe('no_payment')
  })
})

describe('payment-cascade · canAutoComplete', () => {
  test('true when delivered + both confirmed', () => {
    expect(
      canAutoComplete(
        { status: 'delivered' },
        { escrowStatus: 'held', buyerConfirmedAt: '2026-01-01', sellerReadyAt: '2026-01-01' },
      ),
    ).toBe(true)
  })
  test('false if one side missing', () => {
    expect(
      canAutoComplete(
        { status: 'delivered' },
        { escrowStatus: 'held', buyerConfirmedAt: '2026-01-01', sellerReadyAt: null },
      ),
    ).toBe(false)
  })
  test('false if order not delivered', () => {
    expect(
      canAutoComplete(
        { status: 'accepted' },
        { escrowStatus: 'held', buyerConfirmedAt: '2026-01-01', sellerReadyAt: '2026-01-01' },
      ),
    ).toBe(false)
  })
  test('null safe', () => {
    expect(canAutoComplete(null, null)).toBe(false)
  })
})
