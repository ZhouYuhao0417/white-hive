// Standard pagination helpers — shared between list endpoints.
//
// Parses limit/offset from query or body, clamps them to sane ranges, and
// produces a consistent `{ items, pagination: { total, limit, offset, hasMore } }`
// envelope so the frontend never has to guess shape.
//
// No external dependencies; no store access.

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function toInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
}

export function parsePagination(source = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const rawLimit = toInt(source.limit, defaultLimit)
  const rawOffset = toInt(source.offset, 0)

  const limit = Math.min(Math.max(1, rawLimit), maxLimit)
  const offset = Math.max(0, rawOffset)

  return { limit, offset }
}

export function paginate(items, { limit, offset }) {
  const list = Array.isArray(items) ? items : []
  const total = list.length
  const start = Math.min(Math.max(0, offset || 0), total)
  const end = Math.min(start + Math.max(1, limit || DEFAULT_LIMIT), total)
  const slice = list.slice(start, end)

  return {
    items: slice,
    pagination: {
      total,
      limit,
      offset: start,
      hasMore: end < total,
      nextOffset: end < total ? end : null,
    },
  }
}

// Convenience: parse + slice in one call.
export function paginateFrom(source, items, opts) {
  const pager = parsePagination(source, opts)
  return paginate(items, pager)
}
