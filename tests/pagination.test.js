import { test, expect, describe } from 'bun:test'
import { parsePagination, paginate, paginateFrom } from '../api/_lib/pagination.js'

describe('pagination · parsePagination', () => {
  test('defaults: limit 20, offset 0', () => {
    const p = parsePagination({})
    expect(p.limit).toBe(20)
    expect(p.offset).toBe(0)
  })

  test('parses string numbers from query params', () => {
    const p = parsePagination({ limit: '5', offset: '10' })
    expect(p.limit).toBe(5)
    expect(p.offset).toBe(10)
  })

  test('clamps limit to max (100)', () => {
    expect(parsePagination({ limit: '999' }).limit).toBe(100)
  })

  test('clamps limit minimum to 1', () => {
    expect(parsePagination({ limit: '-5' }).limit).toBe(1)
  })

  test('clamps offset to 0 minimum', () => {
    expect(parsePagination({ offset: '-10' }).offset).toBe(0)
  })

  test('ignores non-numeric values and uses defaults', () => {
    const p = parsePagination({ limit: 'abc', offset: 'xyz' })
    expect(p.limit).toBe(20)
    expect(p.offset).toBe(0)
  })

  test('respects custom defaultLimit and maxLimit', () => {
    const p = parsePagination({ limit: '200' }, { defaultLimit: 10, maxLimit: 50 })
    expect(p.limit).toBe(50)
  })
})

describe('pagination · paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }))

  test('returns correct slice and pagination meta', () => {
    const result = paginate(items, { limit: 10, offset: 0 })
    expect(result.items.length).toBe(10)
    expect(result.items[0].id).toBe(1)
    expect(result.pagination.total).toBe(25)
    expect(result.pagination.hasMore).toBe(true)
    expect(result.pagination.nextOffset).toBe(10)
  })

  test('last page has hasMore=false and nextOffset=null', () => {
    const result = paginate(items, { limit: 10, offset: 20 })
    expect(result.items.length).toBe(5)
    expect(result.pagination.hasMore).toBe(false)
    expect(result.pagination.nextOffset).toBeNull()
  })

  test('offset beyond length returns empty items', () => {
    const result = paginate(items, { limit: 10, offset: 100 })
    expect(result.items).toEqual([])
    expect(result.pagination.hasMore).toBe(false)
  })

  test('handles empty array', () => {
    const result = paginate([], { limit: 10, offset: 0 })
    expect(result.items).toEqual([])
    expect(result.pagination.total).toBe(0)
    expect(result.pagination.hasMore).toBe(false)
  })
})

describe('pagination · paginateFrom', () => {
  test('parses source and paginates in one call', () => {
    const items = Array.from({ length: 15 }, (_, i) => i)
    const result = paginateFrom({ limit: '5', offset: '5' }, items)
    expect(result.items).toEqual([5, 6, 7, 8, 9])
    expect(result.pagination.total).toBe(15)
    expect(result.pagination.hasMore).toBe(true)
  })
})
