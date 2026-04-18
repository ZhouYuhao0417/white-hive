// Dispute domain helpers — state machine + SLA + evidence model.
//
// Pure logic, no store access. When Codex commits his changes we wire these
// into new /api dispute endpoints (Task A).
//
// Dispute lifecycle:
//   opened      -> buyer or seller files a dispute
//   evidence    -> both sides upload evidence / testimonies
//   under_review-> admin is looking at it
//   resolved    -> admin picked an action (refund_buyer | release_seller | split)
//   withdrawn   -> filer withdrew
//
// Allowed actors for each transition are enforced here.

import { HttpError } from './http.js'

export const disputeStatuses = ['opened', 'evidence', 'under_review', 'resolved', 'withdrawn']

export const disputeActions = [
  'refund_buyer',
  'release_seller',
  'split', // partial refund — requires a split percentage in the payload
  'request_more_evidence',
]

export const disputeReasons = [
  'not_delivered', // 卖家没交付
  'quality_issue', // 交付物质量问题
  'scope_mismatch', // 交付物与约定不符
  'buyer_changed_mind', // 买家反悔
  'payment_issue', // 付款 / 退款问题
  'communication_breakdown', // 沟通破裂
  'other',
]

// Who can move the dispute from state → state. 'admin' bypasses these.
const transitions = {
  opened: {
    evidence: ['buyer', 'seller', 'admin'],
    under_review: ['admin'],
    withdrawn: ['filer', 'admin'],
  },
  evidence: {
    under_review: ['admin'],
    withdrawn: ['filer', 'admin'],
  },
  under_review: {
    resolved: ['admin'],
    evidence: ['admin'],
  },
  resolved: {},
  withdrawn: {},
}

// Hours a side has to upload evidence before the dispute auto-advances.
const slaHours = {
  opened: 48,
  evidence: 72,
  under_review: 120,
}

export function normalizeDisputeReason(reason) {
  const v = String(reason || '').trim().toLowerCase()
  return disputeReasons.includes(v) ? v : 'other'
}

export function canTransition(fromStatus, toStatus, actorRole) {
  if (!disputeStatuses.includes(fromStatus)) return false
  if (!disputeStatuses.includes(toStatus)) return false

  // Terminal states — not even admin can re-open.
  const allowed = transitions[fromStatus] || {}
  if (Object.keys(allowed).length === 0) return false

  if (actorRole === 'admin') {
    // Admin can take any legal transition from a non-terminal state.
    return Object.prototype.hasOwnProperty.call(allowed, toStatus)
  }

  const actors = allowed[toStatus]
  if (!Array.isArray(actors)) return false
  return actors.includes(actorRole)
}

export function assertTransition(fromStatus, toStatus, actorRole) {
  if (!canTransition(fromStatus, toStatus, actorRole)) {
    throw new HttpError(409, 'invalid_dispute_transition', '当前纠纷状态不能这样流转。', {
      from: fromStatus,
      to: toStatus,
      actor: actorRole,
    })
  }
}

// Validate a buyer/seller/admin evidence upload entry.
export function normalizeEvidence(input = {}) {
  const type = String(input.type || 'note').trim().toLowerCase()
  const allowedTypes = ['note', 'screenshot', 'file', 'link', 'chat_excerpt']
  const body = String(input.body || '').trim()

  if (!body) {
    throw new HttpError(400, 'missing_evidence_body', '证据内容不能为空。')
  }

  if (body.length > 4000) {
    throw new HttpError(400, 'evidence_too_long', '单条证据内容超过 4000 字。')
  }

  return {
    type: allowedTypes.includes(type) ? type : 'note',
    body,
    url: input.url ? String(input.url).slice(0, 500) : null,
  }
}

// Given a resolution action, produce the financial outcome.
// splitPercent is "how much of the escrow refunds to the buyer" (0–100).
export function resolveFinancialOutcome(action, escrowCents, splitPercent) {
  if (!disputeActions.includes(action)) {
    throw new HttpError(400, 'invalid_dispute_action', '不支持的处理动作。', {
      allowed: disputeActions,
    })
  }

  const amount = Number(escrowCents)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, 'invalid_escrow_amount', '托管金额不合法。')
  }

  if (action === 'refund_buyer') {
    return { refundBuyerCents: amount, releaseSellerCents: 0 }
  }

  if (action === 'release_seller') {
    return { refundBuyerCents: 0, releaseSellerCents: amount }
  }

  if (action === 'split') {
    const pct = Number(splitPercent)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new HttpError(400, 'invalid_split_percent', 'split 动作需要 0-100 的 splitPercent。')
    }
    const refundBuyer = Math.round((amount * pct) / 100)
    return {
      refundBuyerCents: refundBuyer,
      releaseSellerCents: amount - refundBuyer,
    }
  }

  // request_more_evidence — no money moves
  return { refundBuyerCents: 0, releaseSellerCents: 0 }
}

export function computeSlaDeadline(status, fromIso) {
  const hours = slaHours[status]
  if (!hours) return null
  const base = fromIso ? new Date(fromIso).getTime() : Date.now()
  if (!Number.isFinite(base)) return null
  return new Date(base + hours * 3600 * 1000).toISOString()
}

export function publicDisputeShape(dispute) {
  if (!dispute) return null
  return {
    id: dispute.id,
    orderId: dispute.orderId,
    filerRole: dispute.filerRole,
    filerId: dispute.filerId,
    reason: normalizeDisputeReason(dispute.reason),
    status: disputeStatuses.includes(dispute.status) ? dispute.status : 'opened',
    summary: String(dispute.summary || '').slice(0, 500),
    evidence: Array.isArray(dispute.evidence)
      ? dispute.evidence.slice(0, 40).map((e) => ({
          type: e.type,
          body: e.body,
          url: e.url || null,
          byRole: e.byRole || null,
          byId: e.byId || null,
          createdAt: e.createdAt || null,
        }))
      : [],
    resolution: dispute.resolution
      ? {
          action: dispute.resolution.action,
          reason: dispute.resolution.reason || '',
          splitPercent: dispute.resolution.splitPercent ?? null,
          refundBuyerCents: dispute.resolution.refundBuyerCents ?? 0,
          releaseSellerCents: dispute.resolution.releaseSellerCents ?? 0,
          resolvedAt: dispute.resolution.resolvedAt || null,
        }
      : null,
    slaDeadline: dispute.slaDeadline || null,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt || dispute.createdAt,
  }
}
