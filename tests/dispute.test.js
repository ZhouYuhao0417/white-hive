import { test, expect, describe } from 'bun:test'
import {
  disputeStatuses,
  disputeActions,
  disputeReasons,
  normalizeDisputeReason,
  canTransition,
  assertTransition,
  normalizeEvidence,
  resolveFinancialOutcome,
  computeSlaDeadline,
  publicDisputeShape,
} from '../api/_lib/dispute.js'
import { HttpError } from '../api/_lib/http.js'

describe('dispute · constants', () => {
  test('exposes status / action / reason enums', () => {
    expect(disputeStatuses).toContain('opened')
    expect(disputeStatuses).toContain('resolved')
    expect(disputeActions).toContain('refund_buyer')
    expect(disputeActions).toContain('split')
    expect(disputeReasons).toContain('not_delivered')
  })
})

describe('dispute · normalizeDisputeReason', () => {
  test('keeps allowed reason', () => {
    expect(normalizeDisputeReason('quality_issue')).toBe('quality_issue')
  })

  test('falls back to "other" for unknown', () => {
    expect(normalizeDisputeReason('xxx')).toBe('other')
    expect(normalizeDisputeReason('')).toBe('other')
    expect(normalizeDisputeReason(null)).toBe('other')
  })
})

describe('dispute · state machine', () => {
  test('buyer can move opened → evidence', () => {
    expect(canTransition('opened', 'evidence', 'buyer')).toBe(true)
  })

  test('seller can move opened → evidence', () => {
    expect(canTransition('opened', 'evidence', 'seller')).toBe(true)
  })

  test('admin can take any edge defined in the state machine', () => {
    expect(canTransition('opened', 'under_review', 'admin')).toBe(true)
    expect(canTransition('evidence', 'under_review', 'admin')).toBe(true)
    expect(canTransition('under_review', 'resolved', 'admin')).toBe(true)
    // Admin still can't skip across the graph (must go through under_review).
    expect(canTransition('opened', 'resolved', 'admin')).toBe(false)
  })

  test('buyer CANNOT move opened → resolved', () => {
    expect(canTransition('opened', 'resolved', 'buyer')).toBe(false)
  })

  test('buyer CANNOT move evidence → under_review (admin only)', () => {
    expect(canTransition('evidence', 'under_review', 'buyer')).toBe(false)
    expect(canTransition('evidence', 'under_review', 'admin')).toBe(true)
  })

  test('resolved / withdrawn are terminal', () => {
    expect(canTransition('resolved', 'opened', 'admin')).toBe(false)
    expect(canTransition('withdrawn', 'opened', 'admin')).toBe(false)
  })

  test('assertTransition throws HttpError 409 on illegal', () => {
    expect(() => assertTransition('opened', 'resolved', 'buyer')).toThrow(HttpError)
  })
})

describe('dispute · normalizeEvidence', () => {
  test('accepts minimum valid note', () => {
    const ev = normalizeEvidence({ type: 'note', body: '我已按约交付了稿件' })
    expect(ev.type).toBe('note')
    expect(ev.body).toBe('我已按约交付了稿件')
  })

  test('unknown type falls back to note', () => {
    const ev = normalizeEvidence({ type: 'invalid_type', body: 'x' })
    expect(ev.type).toBe('note')
  })

  test('rejects empty body', () => {
    expect(() => normalizeEvidence({ body: '' })).toThrow(HttpError)
    expect(() => normalizeEvidence({ body: '   ' })).toThrow(HttpError)
  })

  test('rejects oversize body (> 4000 chars)', () => {
    expect(() => normalizeEvidence({ body: 'a'.repeat(4001) })).toThrow(HttpError)
  })

  test('truncates url to 500 chars', () => {
    const ev = normalizeEvidence({
      body: 'see screenshot',
      type: 'screenshot',
      url: 'https://example.com/' + 'a'.repeat(600),
    })
    expect(ev.url.length).toBeLessThanOrEqual(500)
  })
})

describe('dispute · resolveFinancialOutcome', () => {
  test('refund_buyer returns full amount to buyer', () => {
    const out = resolveFinancialOutcome('refund_buyer', 100000)
    expect(out.refundBuyerCents).toBe(100000)
    expect(out.releaseSellerCents).toBe(0)
  })

  test('release_seller gives full amount to seller', () => {
    const out = resolveFinancialOutcome('release_seller', 100000)
    expect(out.refundBuyerCents).toBe(0)
    expect(out.releaseSellerCents).toBe(100000)
  })

  test('split with 30% refunds 30% to buyer', () => {
    const out = resolveFinancialOutcome('split', 100000, 30)
    expect(out.refundBuyerCents).toBe(30000)
    expect(out.releaseSellerCents).toBe(70000)
  })

  test('split without splitPercent throws', () => {
    expect(() => resolveFinancialOutcome('split', 100000)).toThrow(HttpError)
    expect(() => resolveFinancialOutcome('split', 100000, 150)).toThrow(HttpError)
  })

  test('request_more_evidence moves no money', () => {
    const out = resolveFinancialOutcome('request_more_evidence', 100000)
    expect(out.refundBuyerCents).toBe(0)
    expect(out.releaseSellerCents).toBe(0)
  })

  test('unknown action throws', () => {
    expect(() => resolveFinancialOutcome('nuke_from_orbit', 100000)).toThrow(HttpError)
  })

  test('invalid escrow amount throws', () => {
    expect(() => resolveFinancialOutcome('refund_buyer', -100)).toThrow(HttpError)
    expect(() => resolveFinancialOutcome('refund_buyer', 'abc')).toThrow(HttpError)
  })
})

describe('dispute · computeSlaDeadline', () => {
  test('opened has a deadline in the future', () => {
    const from = '2026-04-16T00:00:00.000Z'
    const deadline = computeSlaDeadline('opened', from)
    expect(deadline).toBeTruthy()
    expect(new Date(deadline).getTime()).toBeGreaterThan(new Date(from).getTime())
  })

  test('resolved / withdrawn have no deadline', () => {
    expect(computeSlaDeadline('resolved', '2026-01-01T00:00:00.000Z')).toBeNull()
    expect(computeSlaDeadline('withdrawn', '2026-01-01T00:00:00.000Z')).toBeNull()
  })
})

describe('dispute · publicDisputeShape', () => {
  test('returns null for falsy input', () => {
    expect(publicDisputeShape(null)).toBeNull()
    expect(publicDisputeShape(undefined)).toBeNull()
  })

  test('exposes normalized shape', () => {
    const shape = publicDisputeShape({
      id: 'dsp_1',
      orderId: 'ord_1',
      filerRole: 'buyer',
      filerId: 'usr_1',
      reason: 'quality_issue',
      status: 'opened',
      summary: '交付物未达到约定',
      evidence: [
        { type: 'note', body: '第一次证据', byRole: 'buyer', byId: 'usr_1', createdAt: '2026-04-16T01:00:00Z' },
      ],
      createdAt: '2026-04-16T00:00:00Z',
    })
    expect(shape.id).toBe('dsp_1')
    expect(shape.reason).toBe('quality_issue')
    expect(shape.evidence.length).toBe(1)
    expect(shape.evidence[0].type).toBe('note')
    expect(shape.resolution).toBeNull()
  })

  test('normalizes unknown status to opened', () => {
    const shape = publicDisputeShape({
      id: 'd',
      orderId: 'o',
      status: 'some_bad_status',
      createdAt: '2026-04-16T00:00:00Z',
    })
    expect(shape.status).toBe('opened')
  })
})
