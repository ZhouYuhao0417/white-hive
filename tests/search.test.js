import { test, expect, describe } from 'bun:test'
import {
  tokenize,
  scoreMatch,
  filterByQuery,
  applyFilters,
  sortServices,
  serviceSearchText,
} from '../api/_lib/search.js'

describe('search · tokenize', () => {
  test('extracts latin words (≥ 2 chars)', () => {
    const tokens = tokenize('React Vercel a Next.js')
    expect(tokens).toContain('react')
    expect(tokens).toContain('vercel')
    expect(tokens).toContain('next.js')
    expect(tokens).not.toContain('a') // too short
  })

  test('extracts CJK unigrams + bigrams', () => {
    const tokens = tokenize('官网落地页')
    expect(tokens).toContain('官')
    expect(tokens).toContain('官网')
    expect(tokens).toContain('落地')
  })

  test('empty input returns empty array', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize(null)).toEqual([])
  })

  test('deduplicates tokens', () => {
    const tokens = tokenize('react react react')
    expect(tokens.filter((t) => t === 'react').length).toBe(1)
  })

  test('skips stopwords', () => {
    const tokens = tokenize('the and of')
    expect(tokens.length).toBe(0)
  })
})

describe('search · scoreMatch', () => {
  test('returns 0 for empty query', () => {
    expect(scoreMatch('some text', '')).toBe(0)
    expect(scoreMatch('some text', null)).toBe(0)
  })

  test('returns 0 for no matches', () => {
    expect(scoreMatch('apple banana', 'zebra')).toBe(0)
  })

  test('scores longer matches higher', () => {
    const short = scoreMatch('react vercel nextjs', 'rea')
    const long = scoreMatch('react vercel nextjs', 'react')
    expect(long).toBeGreaterThan(short)
  })

  test('counts multiple keyword hits', () => {
    const one = scoreMatch('react app', 'react')
    const two = scoreMatch('react vercel', 'react vercel')
    expect(two).toBeGreaterThan(one)
  })

  test('works on CJK text', () => {
    const score = scoreMatch('我想做一个创业项目官网', '官网')
    expect(score).toBeGreaterThan(0)
  })
})

describe('search · filterByQuery', () => {
  const items = [
    { id: 'a', text: 'React Vercel 官网' },
    { id: 'b', text: 'Figma 设计 品牌' },
    { id: 'c', text: '视频剪辑 抖音' },
  ]

  test('filters items that match query, sorted by relevance', () => {
    const result = filterByQuery(items, '官网', (i) => i.text)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('a')
  })

  test('no query returns all items', () => {
    const result = filterByQuery(items, '', (i) => i.text)
    expect(result.length).toBe(3)
  })

  test('no matches returns empty array', () => {
    const result = filterByQuery(items, '不存在的词xyz', (i) => i.text)
    expect(result).toEqual([])
  })
})

describe('search · applyFilters', () => {
  const services = [
    { id: 's1', category: 'web', sellerId: 'u1', status: 'published', priceCents: 100000, tags: ['react', 'vercel'] },
    { id: 's2', category: 'design', sellerId: 'u2', status: 'published', priceCents: 200000, tags: ['figma'] },
    { id: 's3', category: 'web', sellerId: 'u1', status: 'draft', priceCents: 50000, tags: ['nextjs'] },
  ]

  test('filters by category', () => {
    const result = applyFilters(services, { category: 'web' })
    expect(result.length).toBe(2)
  })

  test('filters by sellerId', () => {
    const result = applyFilters(services, { sellerId: 'u1' })
    expect(result.length).toBe(2)
  })

  test('filters by status', () => {
    const result = applyFilters(services, { status: 'published' })
    expect(result.length).toBe(2)
  })

  test('filters by price range', () => {
    const result = applyFilters(services, { priceMin: 80000, priceMax: 150000 })
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('s1')
  })

  test('filters by tag intersection', () => {
    const result = applyFilters(services, { tags: ['react'] })
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('s1')
  })

  test('filters stack (category + status)', () => {
    const result = applyFilters(services, { category: 'web', status: 'published' })
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('s1')
  })
})

describe('search · sortServices', () => {
  const services = [
    { id: 's1', priceCents: 200000, deliveryDays: 10, createdAt: '2026-01-01' },
    { id: 's2', priceCents: 100000, deliveryDays: 3, createdAt: '2026-03-01' },
    { id: 's3', priceCents: 300000, deliveryDays: 7, createdAt: '2026-02-01' },
  ]

  test('price_asc', () => {
    const sorted = sortServices(services, 'price_asc')
    expect(sorted.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
  })

  test('price_desc', () => {
    const sorted = sortServices(services, 'price_desc')
    expect(sorted.map((s) => s.id)).toEqual(['s3', 's1', 's2'])
  })

  test('delivery_fast', () => {
    const sorted = sortServices(services, 'delivery_fast')
    expect(sorted.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })

  test('newest (default)', () => {
    const sorted = sortServices(services, 'newest')
    expect(sorted.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })
})

describe('search · serviceSearchText', () => {
  test('concatenates all searchable fields', () => {
    const text = serviceSearchText({
      title: '官网',
      summary: 'landing page',
      category: 'web',
      tags: ['react'],
      seller: { displayName: '张三' },
    })
    expect(text).toContain('官网')
    expect(text).toContain('landing page')
    expect(text).toContain('web')
    expect(text).toContain('react')
    expect(text).toContain('张三')
  })

  test('handles missing fields', () => {
    expect(serviceSearchText(null)).toBe('')
    expect(serviceSearchText({})).toBe('')
  })
})
