import { test, expect, describe } from 'bun:test'
import { HttpError, fail, ok, methodNotAllowed, withApiErrors, readBody, getQuery } from '../api/_lib/http.js'

describe('http · HttpError', () => {
  test('HttpError carries status, code, message, details', () => {
    const err = new HttpError(418, 'teapot', 'short and stout', { kettle: true })
    expect(err.status).toBe(418)
    expect(err.code).toBe('teapot')
    expect(err.message).toBe('short and stout')
    expect(err.details).toEqual({ kettle: true })
    expect(err).toBeInstanceOf(Error)
  })
})

describe('http · response helpers', () => {
  test('ok() returns 200 JSON Response with { ok, data } envelope', async () => {
    const res = ok({ hello: 'world' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data).toEqual({ hello: 'world' })
  })

  test('fail() returns status + coded error body', async () => {
    const res = fail(400, 'bad_input', 'you goofed')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error?.code).toBe('bad_input')
    expect(body.error?.message).toBe('you goofed')
  })

  test('methodNotAllowed() returns 405 + Allow header', async () => {
    const res = methodNotAllowed('DELETE', ['GET', 'POST'])
    expect(res.status).toBe(405)
    const allow = res.headers.get('allow') || res.headers.get('Allow')
    expect(allow).toContain('GET')
    expect(allow).toContain('POST')
  })
})

describe('http · withApiErrors wrapper', () => {
  test('passes through successful Response', async () => {
    const res = await withApiErrors(async () => ok({ a: 1 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data?.a).toBe(1)
  })

  test('converts HttpError to structured fail() response', async () => {
    const res = await withApiErrors(async () => {
      throw new HttpError(403, 'forbidden', '走开')
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error?.code).toBe('forbidden')
  })

  test('converts unknown Error to 500', async () => {
    const res = await withApiErrors(async () => {
      throw new Error('boom')
    })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error?.code).toBeDefined()
  })
})

describe('http · request parsers', () => {
  test('getQuery returns URLSearchParams-like', () => {
    const req = new Request('https://w.example/api/x?id=abc&foo=bar')
    const q = getQuery(req)
    expect(q.get('id')).toBe('abc')
    expect(q.get('foo')).toBe('bar')
    expect(q.get('missing')).toBeNull()
  })

  test('readBody parses JSON body', async () => {
    const req = new Request('https://w.example/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    })
    const body = await readBody(req)
    expect(body).toEqual({ hello: 'world' })
  })

  test('readBody tolerates empty body', async () => {
    const req = new Request('https://w.example/api/x', { method: 'POST' })
    const body = await readBody(req)
    expect(body).toEqual({})
  })
})
