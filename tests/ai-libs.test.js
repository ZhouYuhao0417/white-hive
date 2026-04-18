// AI lib unit tests.
//
// We cover:
//  - Graceful behavior when DEEPSEEK_API_KEY is absent (all AI libs return
//    {ok:false, reason:'not_configured'} without throwing)
//  - Input gating (insufficient_input)
//  - Moderation rule layer (deterministic, no LLM)
//
// Live LLM calls are deliberately NOT tested here — that's handled by
// tests/matcher.live.test.js (skipped unless DEEPSEEK_API_KEY is set).

import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { reviewBrief, hasEnoughInput } from '../api/_lib/ai-brief.js'
import { suggestPricing } from '../api/_lib/ai-price.js'
import { polishListing } from '../api/_lib/ai-listing.js'
import { summarizeDispute } from '../api/_lib/ai-dispute.js'
import { moderateMessage, quickCheck } from '../api/_lib/ai-moderation.js'

const savedKey = process.env.DEEPSEEK_API_KEY

function withoutKey(fn) {
  return async () => {
    delete process.env.DEEPSEEK_API_KEY
    try {
      await fn()
    } finally {
      if (savedKey !== undefined) process.env.DEEPSEEK_API_KEY = savedKey
    }
  }
}

describe('ai-brief', () => {
  test('hasEnoughInput requires at least 8 chars of text', () => {
    expect(hasEnoughInput({})).toBe(false)
    expect(hasEnoughInput({ brief: '短' })).toBe(false)
    expect(hasEnoughInput({ brief: '我想做一个官网' })).toBe(true)
  })

  test(
    'reviewBrief returns not_configured without key',
    withoutKey(async () => {
      const result = await reviewBrief({
        category: 'web',
        title: '官网',
        brief: '我想做一个创业项目官网，需要预约表单',
      })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('not_configured')
    }),
  )

  test(
    'reviewBrief returns insufficient_input for empty brief',
    withoutKey(async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-fake'
      const result = await reviewBrief({ category: 'web' })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('insufficient_input')
      delete process.env.DEEPSEEK_API_KEY
    }),
  )
})

describe('ai-price', () => {
  test(
    'suggestPricing returns not_configured without key',
    withoutKey(async () => {
      const result = await suggestPricing({
        category: 'web',
        title: '官网',
        summary: '从零帮你上线官网',
        deliveryDays: 7,
      })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('not_configured')
    }),
  )

  test(
    'suggestPricing returns insufficient_input when category missing',
    withoutKey(async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-fake'
      const result = await suggestPricing({ title: 'x' })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('insufficient_input')
      delete process.env.DEEPSEEK_API_KEY
    }),
  )
})

describe('ai-listing', () => {
  test(
    'polishListing returns not_configured without key',
    withoutKey(async () => {
      const result = await polishListing({
        category: 'web',
        title: '建站',
        summary: '会做网站',
      })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('not_configured')
    }),
  )

  test(
    'polishListing returns insufficient_input when missing core fields',
    withoutKey(async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-fake'
      const result = await polishListing({})
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('insufficient_input')
      delete process.env.DEEPSEEK_API_KEY
    }),
  )
})

describe('ai-dispute', () => {
  test(
    'summarizeDispute returns not_configured without key',
    withoutKey(async () => {
      const result = await summarizeDispute({
        order: { id: 'ord_1', status: 'delivered', budgetCents: 100000 },
        messages: [{ senderId: 'buyer', body: '稿件有问题', createdAt: '2026-04-16T00:00:00Z' }],
      })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('not_configured')
    }),
  )

  test(
    'summarizeDispute returns insufficient_input on empty messages',
    withoutKey(async () => {
      process.env.DEEPSEEK_API_KEY = 'sk-fake'
      const result = await summarizeDispute({ order: { id: 'x' }, messages: [] })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('insufficient_input')
      delete process.env.DEEPSEEK_API_KEY
    }),
  )
})

describe('ai-moderation · quickCheck (rule-only)', () => {
  test('clean message passes', () => {
    const r = quickCheck('你好，我可以开始吗？')
    expect(r.flagged).toBe(false)
    expect(r.severity).toBe('none')
    expect(r.hits).toEqual([])
  })

  test('flags wechat handle', () => {
    const r = quickCheck('加我微信 abc_123456 吧')
    expect(r.flagged).toBe(true)
    const cats = r.hits.map((h) => h.category)
    expect(cats).toContain('offplatform')
  })

  test('flags QQ number', () => {
    const r = quickCheck('我 qq 是 12345678')
    expect(r.flagged).toBe(true)
    expect(r.hits.map((h) => h.id)).toContain('offplatform-qq')
  })

  test('flags phone number', () => {
    const r = quickCheck('我的电话是 13812345678')
    expect(r.flagged).toBe(true)
  })

  test('flags off-platform payment phrasing', () => {
    const r = quickCheck('你先直接转给我吧不走平台')
    expect(r.flagged).toBe(true)
    const cats = r.hits.map((h) => h.category)
    expect(cats).toContain('scam')
    expect(r.severity).toBe('high')
  })

  test('flags abuse', () => {
    const r = quickCheck('你这个废物骗子')
    expect(r.flagged).toBe(true)
    expect(r.hits.map((h) => h.category)).toContain('abuse')
  })

  test('flags 18-digit ID card number', () => {
    // Valid-format (structural) Chinese ID number. Synthetic.
    const r = quickCheck('我的身份证是 110101199003071234')
    expect(r.flagged).toBe(true)
    expect(r.hits.map((h) => h.category)).toContain('pii')
  })

  test('severity high overrides lower hits', () => {
    const r = quickCheck('加我微信 abc12345 请直接转账不走平台')
    expect(r.severity).toBe('high')
  })

  test('empty string not flagged', () => {
    const r = quickCheck('')
    expect(r.flagged).toBe(false)
    expect(r.severity).toBe('none')
  })
})

describe('ai-moderation · moderateMessage without key (rule fallback)', () => {
  test(
    'empty body returns empty_input',
    withoutKey(async () => {
      const r = await moderateMessage({ body: '' })
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('empty_input')
    }),
  )

  test(
    'clean message is allowed',
    withoutKey(async () => {
      const r = await moderateMessage({ body: '你好，请问什么时候能开始？' })
      expect(r.ok).toBe(true)
      expect(r.allow).toBe(true)
      expect(r.source).toBe('rules')
      expect(r.severity).toBe('none')
    }),
  )

  test(
    'high-severity rule hit blocks the message',
    withoutKey(async () => {
      const r = await moderateMessage({ body: '加我微信 abcdef123 不走平台直接转我' })
      expect(r.ok).toBe(true)
      expect(r.source).toBe('rules')
      expect(r.allow).toBe(false)
      expect(r.severity).toBe('high')
      expect(Array.isArray(r.ruleHits)).toBe(true)
      expect(r.ruleHits.length).toBeGreaterThan(0)
    }),
  )
})
