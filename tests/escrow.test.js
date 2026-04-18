import { test, expect, describe } from 'bun:test'
import {
  escrowStatuses,
  escrowActions,
  validateAction,
  assertAction,
  applyAction,
  publicEscrowShape,
  canRelease,
} from '../api/_lib/escrow.js'
import { HttpError } from '../api/_lib/http.js'

const base = () => ({
  escrowStatus: 'held',
  buyerConfirmedAt: null,
  sellerReadyAt: null,
  releasedAt: null,
  refundedAt: null,
  releaseRequestedBy: null,
})

describe('escrow · constants', () => {
  test('exposes status + action enums', () => {
    expect(escrowStatuses).toEqual(['none', 'held', 'released', 'refunded'])
    expect(escrowActions).toContain('confirm_delivery')
    expect(escrowActions).toContain('ready_for_release')
    expect(escrowActions).toContain('force_release')
    expect(escrowActions).toContain('force_refund')
  })
})

describe('escrow · validateAction', () => {
  test('buyer can confirm_delivery on held payment', () => {
    expect(
      validateAction({
        escrowStatus: 'held',
        action: 'confirm_delivery',
        actorRole: 'buyer',
      }),
    ).toBeNull()
  })

  test('seller CANNOT confirm_delivery', () => {
    expect(
      validateAction({
        escrowStatus: 'held',
        action: 'confirm_delivery',
        actorRole: 'seller',
      }),
    ).toBe('only_buyer_can_confirm_delivery')
  })

  test('non-participant cannot ready_for_release', () => {
    expect(
      validateAction({
        escrowStatus: 'held',
        action: 'ready_for_release',
        actorRole: 'buyer',
      }),
    ).toBe('only_seller_can_mark_ready')
  })

  test('rejects actions on terminal state', () => {
    expect(
      validateAction({
        escrowStatus: 'released',
        action: 'confirm_delivery',
        actorRole: 'buyer',
      }),
    ).toBe('escrow_terminal')
    expect(
      validateAction({
        escrowStatus: 'refunded',
        action: 'ready_for_release',
        actorRole: 'seller',
      }),
    ).toBe('escrow_terminal')
  })

  test('rejects actions on unfunded escrow', () => {
    expect(
      validateAction({
        escrowStatus: 'none',
        action: 'confirm_delivery',
        actorRole: 'buyer',
      }),
    ).toBe('escrow_not_funded')
  })

  test('only admin can force release / refund', () => {
    expect(
      validateAction({
        escrowStatus: 'held',
        action: 'force_release',
        actorRole: 'buyer',
      }),
    ).toBe('only_admin_can_force')
    expect(
      validateAction({
        escrowStatus: 'held',
        action: 'force_release',
        actorRole: 'admin',
      }),
    ).toBeNull()
  })
})

describe('escrow · assertAction', () => {
  test('throws HttpError 409 with reason in details', () => {
    try {
      assertAction({
        escrowStatus: 'held',
        action: 'confirm_delivery',
        actorRole: 'seller',
      })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect(err.status).toBe(409)
      expect(err.details?.reason).toBe('only_buyer_can_confirm_delivery')
    }
  })
})

describe('escrow · applyAction · dual-confirm release flow', () => {
  test('buyer confirm alone does NOT release', () => {
    const { payment, released, dualConfirmed } = applyAction(base(), {
      action: 'confirm_delivery',
      actorRole: 'buyer',
      actorId: 'usr_buyer',
      now: '2026-04-16T10:00:00.000Z',
    })
    expect(payment.escrowStatus).toBe('held')
    expect(payment.buyerConfirmedAt).toBe('2026-04-16T10:00:00.000Z')
    expect(payment.sellerReadyAt).toBeNull()
    expect(released).toBe(false)
    expect(dualConfirmed).toBe(false)
  })

  test('seller ready alone does NOT release', () => {
    const { payment, released } = applyAction(base(), {
      action: 'ready_for_release',
      actorRole: 'seller',
      actorId: 'usr_seller',
      now: '2026-04-16T10:30:00.000Z',
    })
    expect(payment.escrowStatus).toBe('held')
    expect(payment.sellerReadyAt).toBe('2026-04-16T10:30:00.000Z')
    expect(released).toBe(false)
  })

  test('buyer + seller confirm → auto-release', () => {
    const first = applyAction(base(), {
      action: 'ready_for_release',
      actorRole: 'seller',
      now: '2026-04-16T10:30:00.000Z',
    })
    expect(first.released).toBe(false)

    const second = applyAction(first.payment, {
      action: 'confirm_delivery',
      actorRole: 'buyer',
      now: '2026-04-16T11:00:00.000Z',
    })
    expect(second.payment.escrowStatus).toBe('released')
    expect(second.payment.releasedAt).toBe('2026-04-16T11:00:00.000Z')
    expect(second.payment.releaseRequestedBy).toBe('buyer')
    expect(second.released).toBe(true)
    expect(second.dualConfirmed).toBe(true)
  })

  test('confirm_delivery is idempotent', () => {
    const first = applyAction(base(), {
      action: 'confirm_delivery',
      actorRole: 'buyer',
      now: '2026-04-16T10:00:00.000Z',
    })
    const second = applyAction(first.payment, {
      action: 'confirm_delivery',
      actorRole: 'buyer',
      now: '2026-04-16T11:00:00.000Z',
    })
    expect(second.payment.buyerConfirmedAt).toBe('2026-04-16T10:00:00.000Z')
  })

  test('cancel_confirmation rolls back that side', () => {
    const confirmed = applyAction(base(), {
      action: 'confirm_delivery',
      actorRole: 'buyer',
      now: '2026-04-16T10:00:00.000Z',
    })
    const cancelled = applyAction(confirmed.payment, {
      action: 'cancel_confirmation',
      actorRole: 'buyer',
      now: '2026-04-16T10:15:00.000Z',
    })
    expect(cancelled.payment.buyerConfirmedAt).toBeNull()
    expect(cancelled.payment.escrowStatus).toBe('held')
  })

  test('cannot cancel after release', () => {
    // get to released
    const a = applyAction(base(), {
      action: 'ready_for_release',
      actorRole: 'seller',
    })
    const b = applyAction(a.payment, {
      action: 'confirm_delivery',
      actorRole: 'buyer',
    })
    expect(b.payment.escrowStatus).toBe('released')
    expect(() =>
      applyAction(b.payment, {
        action: 'cancel_confirmation',
        actorRole: 'buyer',
      }),
    ).toThrow(HttpError)
  })
})

describe('escrow · applyAction · admin force', () => {
  test('admin force_release sets released even without dual-confirm', () => {
    const { payment, released } = applyAction(base(), {
      action: 'force_release',
      actorRole: 'admin',
      now: '2026-04-16T12:00:00.000Z',
    })
    expect(payment.escrowStatus).toBe('released')
    expect(payment.releasedAt).toBe('2026-04-16T12:00:00.000Z')
    expect(payment.releaseRequestedBy).toBe('admin')
    expect(released).toBe(true)
  })

  test('admin force_refund sets refunded', () => {
    const { payment, refunded } = applyAction(base(), {
      action: 'force_refund',
      actorRole: 'admin',
      now: '2026-04-16T12:00:00.000Z',
    })
    expect(payment.escrowStatus).toBe('refunded')
    expect(payment.refundedAt).toBe('2026-04-16T12:00:00.000Z')
    expect(refunded).toBe(true)
  })

  test('force_refund wins even if dual-confirmed', () => {
    // Dual-confirmed but not yet released (hypothetical edge case)
    const p = {
      ...base(),
      buyerConfirmedAt: '2026-04-16T10:00:00.000Z',
      sellerReadyAt: '2026-04-16T10:30:00.000Z',
    }
    const { payment } = applyAction(p, {
      action: 'force_refund',
      actorRole: 'admin',
      now: '2026-04-16T12:00:00.000Z',
    })
    expect(payment.escrowStatus).toBe('refunded')
  })
})

describe('escrow · publicEscrowShape', () => {
  test('returns null for null input', () => {
    expect(publicEscrowShape(null)).toBeNull()
  })

  test('exposes dualConfirmed flag', () => {
    const shape = publicEscrowShape({
      escrowStatus: 'held',
      buyerConfirmedAt: '2026-04-16T10:00:00.000Z',
      sellerReadyAt: '2026-04-16T10:30:00.000Z',
    })
    expect(shape.dualConfirmed).toBe(true)
    expect(shape.escrowStatus).toBe('held')
  })

  test('defaults escrowStatus to "none" if missing', () => {
    const shape = publicEscrowShape({})
    expect(shape.escrowStatus).toBe('none')
    expect(shape.dualConfirmed).toBe(false)
  })
})

describe('escrow · canRelease', () => {
  test('true only when held + buyer + seller all confirmed', () => {
    expect(canRelease(null)).toBe(false)
    expect(canRelease({ escrowStatus: 'held' })).toBe(false)
    expect(
      canRelease({
        escrowStatus: 'held',
        buyerConfirmedAt: '2026-04-16T10:00:00.000Z',
      }),
    ).toBe(false)
    expect(
      canRelease({
        escrowStatus: 'held',
        buyerConfirmedAt: '2026-04-16T10:00:00.000Z',
        sellerReadyAt: '2026-04-16T10:30:00.000Z',
      }),
    ).toBe(true)
    expect(
      canRelease({
        escrowStatus: 'released',
        buyerConfirmedAt: '2026-04-16T10:00:00.000Z',
        sellerReadyAt: '2026-04-16T10:30:00.000Z',
      }),
    ).toBe(false)
  })
})
