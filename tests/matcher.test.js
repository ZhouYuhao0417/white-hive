// Matcher tests — rule layer only.
// We aggressively clear DEEPSEEK_API_KEY so createMatch falls back to the
// deterministic rule engine. The LLM layer has its own unit tests in
// deepseek.test.js; here we verify the shape + scoring behaviour a caller
// (UI, tests, E2E) can rely on when DeepSeek is unavailable.

import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { createMatch } from '../api/_lib/matcher.js'
import { HttpError } from '../api/_lib/http.js'
import { resetMemoryStore, clearProductionEnv } from './helpers.js'

const savedDeepSeekKey = process.env.DEEPSEEK_API_KEY

describe('matcher · rule fallback (no LLM)', () => {
  beforeEach(() => {
    resetMemoryStore()
    clearProductionEnv()
    delete process.env.DEEPSEEK_API_KEY
  })

  afterEach(() => {
    if (savedDeepSeekKey !== undefined) {
      process.env.DEEPSEEK_API_KEY = savedDeepSeekKey
    }
  })

  test('returns legacy shape with engine tag + matches + clarifying questions', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '我想做一个创业项目官网，需要预约表单和品牌首屏',
      budgetCents: 300000,
      deadline: '一周',
    })

    expect(result.engine).toBe('whitehive-rule-match-v1')
    expect(result.engineDetails.llmUsed).toBe(false)
    expect(result.engineDetails.llmReason).toBe('not_configured')
    expect(Array.isArray(result.matches)).toBe(true)
    expect(result.matches.length).toBeGreaterThan(0)
    expect(Array.isArray(result.clarifyingQuestions)).toBe(true)
    expect(['low', 'medium', 'high']).toContain(result.confidence)
    expect(result.id.startsWith('mat_')).toBe(true)
    expect(result.createdAt).toBeTruthy()
  })

  test('each match has service + score + fit + reasons arrays', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '需要一个官网落地页',
      budgetCents: 300000,
    })

    for (const match of result.matches) {
      expect(match.service).toBeTruthy()
      expect(typeof match.service.id).toBe('string')
      expect(typeof match.score).toBe('number')
      expect(match.score).toBeGreaterThanOrEqual(0)
      expect(match.score).toBeLessThanOrEqual(100)
      expect(['strong', 'possible', 'weak']).toContain(match.fit)
      expect(Array.isArray(match.reasons)).toBe(true)
      expect(Array.isArray(match.warnings)).toBe(true)
    }
  })

  test('matches are sorted by score descending', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '官网 落地页 品牌',
      budgetCents: 500000,
    })

    for (let i = 1; i < result.matches.length; i += 1) {
      expect(result.matches[i - 1].score).toBeGreaterThanOrEqual(result.matches[i].score)
    }
  })

  test('limit caps the number of matches', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '官网',
      limit: 2,
    })

    expect(result.matches.length).toBeLessThanOrEqual(2)
  })

  test('category match outscores unrelated categories', async () => {
    const webResult = await createMatch({
      category: 'web',
      brief: '需要一个创业项目官网',
      budgetCents: 300000,
    })

    // The top match for a web-category query should itself be in category web
    // (seed data has svc_web_landing, which is category=web).
    expect(webResult.matches[0].service.category).toBe('web')
  })

  test('suggestedOrderDraft uses top match + buyer inputs', async () => {
    const result = await createMatch({
      category: 'web',
      title: '我的创业官网',
      brief: '需要预约表单',
      budgetCents: 250000,
    })

    expect(result.suggestedOrderDraft).toBeTruthy()
    expect(result.suggestedOrderDraft.serviceId).toBe(result.matches[0].service.id)
    expect(result.suggestedOrderDraft.title).toBe('我的创业官网')
    expect(result.suggestedOrderDraft.budgetCents).toBe(250000)
  })

  test('clarifyingQuestions asks for budget when missing', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '想做一个官网',
    })

    const keys = result.clarifyingQuestions.map((q) => q.key)
    expect(keys).toContain('budget')
  })

  test('clarifyingQuestions asks for deadline when missing', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '想做一个官网',
    })

    const keys = result.clarifyingQuestions.map((q) => q.key)
    expect(keys).toContain('deadline')
  })

  test('clarifyingQuestions are category-specific for gaming services', async () => {
    const result = await createMatch({
      category: 'gaming',
      brief: '我想找游戏代肝',
      budgetCents: 80000,
      deadline: '3 天内',
    })

    const labels = result.clarifyingQuestions.map((q) => q.label).join(' ')
    expect(labels).toContain('哪款游戏')
    expect(labels).toContain('区服')
    expect(labels).toContain('代肝到什么目标')
    expect(labels).not.toContain('具体交付物')
    expect(labels).not.toContain('较小版本')
  })

  test('clarifyingQuestions infer gaming intent when category is not selected', async () => {
    const result = await createMatch({
      brief: '我想找王者荣耀排位代打，最好今晚能开始',
      budgetCents: 100000,
      deadline: '今天',
    })

    const keys = result.clarifyingQuestions.map((q) => q.key)
    expect(keys).toContain('game_context')
    expect(keys).toContain('gaming_goal')
  })

  test('clarifyingQuestions infer restaurant ordering app intent beyond generic web form', async () => {
    const result = await createMatch({
      category: 'any',
      brief: '我想要给我的餐厅做一个点餐小程序',
      budgetCents: 100000,
      deadline: '3 天内',
    })

    const labels = result.clarifyingQuestions.map((q) => q.label).join(' ')
    expect(labels).toContain('堂食扫码点餐')
    expect(labels).toContain('菜单')
    expect(labels).toContain('微信支付')
    expect(labels).toContain('店员后台')
    expect(labels).not.toContain('核心问题')
    expect(labels).not.toContain('交付物形式')
  })

  test('throws on totally empty input', async () => {
    await expect(createMatch({})).rejects.toThrow(HttpError)
  })

  test('engineDetails exposes candidate pool size', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '官网',
    })

    expect(typeof result.engineDetails.preFilterSize).toBe('number')
    expect(typeof result.engineDetails.totalCandidates).toBe('number')
    expect(result.engineDetails.totalCandidates).toBeGreaterThan(0)
    expect(result.engineDetails.preFilterSize).toBeLessThanOrEqual(
      result.engineDetails.totalCandidates,
    )
  })

  test('signals array is populated from free text', async () => {
    const result = await createMatch({
      category: 'web',
      brief: '我想做一个创业项目官网，用 Vercel 部署',
      budgetCents: 300000,
    })

    expect(Array.isArray(result.query.signals)).toBe(true)
    // At least one of the strong signals should surface.
    const signalsJoined = result.query.signals.join(' ').toLowerCase()
    expect(
      signalsJoined.includes('官网') ||
        signalsJoined.includes('vercel') ||
        signalsJoined.includes('web') ||
        signalsJoined.includes('创业'),
    ).toBe(true)
  })
})
