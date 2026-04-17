import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { deepSeekStatus, isDeepSeekConfigured, parseJsonFromLlm, callDeepSeek } from '../api/_lib/deepseek.js'

describe('deepseek · config', () => {
  let saved

  beforeEach(() => {
    saved = process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_KEY
  })

  afterEach(() => {
    if (saved !== undefined) process.env.DEEPSEEK_API_KEY = saved
  })

  test('isDeepSeekConfigured() is false without key', () => {
    expect(isDeepSeekConfigured()).toBe(false)
  })

  test('isDeepSeekConfigured() is true with key', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test'
    expect(isDeepSeekConfigured()).toBe(true)
  })

  test('deepSeekStatus() reports missing key', () => {
    const status = deepSeekStatus()
    expect(status.configured).toBe(false)
    expect(status.missing).toContain('DEEPSEEK_API_KEY')
    expect(status.provider).toBe('deepseek')
  })
})

describe('deepseek · callDeepSeek without key', () => {
  test('returns not_configured instead of throwing', async () => {
    delete process.env.DEEPSEEK_API_KEY
    const result = await callDeepSeek({ messages: [{ role: 'user', content: 'hi' }] })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not_configured')
  })

  test('returns no_messages for empty input', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-test-empty-check'
    const result = await callDeepSeek({ messages: [] })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_messages')
    delete process.env.DEEPSEEK_API_KEY
  })
})

describe('deepseek · parseJsonFromLlm', () => {
  test('parses plain JSON', () => {
    expect(parseJsonFromLlm('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonFromLlm('{"arr":[1,2,3]}')).toEqual({ arr: [1, 2, 3] })
  })

  test('strips ```json fences', () => {
    expect(parseJsonFromLlm('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonFromLlm('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  test('recovers JSON from surrounding prose', () => {
    expect(parseJsonFromLlm('Sure, here it is:\n{"a":1}\n— hope that helps!')).toEqual({
      a: 1,
    })
  })

  test('returns null on bad input, never throws', () => {
    expect(parseJsonFromLlm('')).toBeNull()
    expect(parseJsonFromLlm(null)).toBeNull()
    expect(parseJsonFromLlm('no json here')).toBeNull()
    expect(parseJsonFromLlm('{"incomplete": ')).toBeNull()
  })
})
