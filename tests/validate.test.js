import { test, expect, describe } from 'bun:test'
import { validate } from '../api/_lib/validate.js'
import { HttpError } from '../api/_lib/http.js'

describe('validate · basic shape', () => {
  test('throws if body is not an object', () => {
    expect(() => validate(null, {})).toThrow(HttpError)
    expect(() => validate('string', {})).toThrow(HttpError)
    expect(() => validate([], {})).toThrow(HttpError)
  })

  test('passes empty body when no required fields', () => {
    const result = validate({}, { name: { type: 'string' } })
    expect(result).toEqual({})
  })

  test('applies defaults when field missing', () => {
    const result = validate(
      {},
      { role: { type: 'enum', values: ['buyer', 'seller'], default: 'buyer' } },
    )
    expect(result.role).toBe('buyer')
  })
})

describe('validate · string', () => {
  test('trims + returns string', () => {
    const result = validate({ name: '  hello  ' }, { name: { type: 'string' } })
    expect(result.name).toBe('hello')
  })

  test('rejects non-string', () => {
    expect(() => validate({ name: 123 }, { name: { type: 'string' } })).toThrow(HttpError)
  })

  test('enforces maxLen', () => {
    expect(() =>
      validate({ name: 'a'.repeat(50) }, { name: { type: 'string', maxLen: 10 } }),
    ).toThrow(HttpError)
  })

  test('enforces minLen', () => {
    expect(() => validate({ name: 'ab' }, { name: { type: 'string', minLen: 5 } })).toThrow(
      HttpError,
    )
  })

  test('required field throws if missing', () => {
    expect(() => validate({}, { name: { type: 'string', required: true } })).toThrow(HttpError)
  })
})

describe('validate · int', () => {
  test('coerces string to integer', () => {
    const result = validate({ age: '25' }, { age: { type: 'int' } })
    expect(result.age).toBe(25)
  })

  test('enforces min/max', () => {
    expect(() => validate({ n: -5 }, { n: { type: 'int', min: 0 } })).toThrow(HttpError)
    expect(() => validate({ n: 200 }, { n: { type: 'int', max: 100 } })).toThrow(HttpError)
  })

  test('rejects non-numeric', () => {
    expect(() => validate({ n: 'abc' }, { n: { type: 'int' } })).toThrow(HttpError)
  })
})

describe('validate · enum', () => {
  test('accepts whitelisted value', () => {
    const result = validate(
      { role: 'buyer' },
      { role: { type: 'enum', values: ['buyer', 'seller'] } },
    )
    expect(result.role).toBe('buyer')
  })

  test('rejects non-whitelisted value', () => {
    expect(() =>
      validate({ role: 'admin' }, { role: { type: 'enum', values: ['buyer', 'seller'] } }),
    ).toThrow(HttpError)
  })
})

describe('validate · stringArray', () => {
  test('accepts + trims items', () => {
    const result = validate(
      { tags: ['  react  ', 'vercel', ''] },
      { tags: { type: 'stringArray' } },
    )
    expect(result.tags).toEqual(['react', 'vercel'])
  })

  test('enforces maxItems', () => {
    expect(() =>
      validate(
        { tags: ['a', 'b', 'c', 'd'] },
        { tags: { type: 'stringArray', maxItems: 2 } },
      ),
    ).toThrow(HttpError)
  })

  test('enforces maxItemLen', () => {
    expect(() =>
      validate(
        { tags: ['abcdefghij'] },
        { tags: { type: 'stringArray', maxItemLen: 3 } },
      ),
    ).toThrow(HttpError)
  })
})

describe('validate · email', () => {
  test('normalizes email', () => {
    const result = validate({ email: '  Foo@EXAMPLE.com  ' }, { email: { type: 'email' } })
    expect(result.email).toBe('foo@example.com')
  })

  test('rejects invalid shape', () => {
    expect(() => validate({ email: 'not-an-email' }, { email: { type: 'email' } })).toThrow(
      HttpError,
    )
  })
})

describe('validate · url', () => {
  test('accepts https', () => {
    const result = validate(
      { site: 'https://example.com' },
      { site: { type: 'url', protocols: ['https:'] } },
    )
    expect(result.site).toBe('https://example.com/')
  })

  test('rejects disallowed protocol', () => {
    expect(() =>
      validate(
        { site: 'javascript:alert(1)' },
        { site: { type: 'url', protocols: ['https:'] } },
      ),
    ).toThrow(HttpError)
  })

  test('rejects bad URL', () => {
    expect(() => validate({ site: 'not-a-url' }, { site: { type: 'url' } })).toThrow(HttpError)
  })
})

describe('validate · bool', () => {
  test('accepts true/false literal + string', () => {
    expect(validate({ a: true }, { a: { type: 'bool' } }).a).toBe(true)
    expect(validate({ a: 'true' }, { a: { type: 'bool' } }).a).toBe(true)
    expect(validate({ a: 'false' }, { a: { type: 'bool' } }).a).toBe(false)
  })

  test('rejects non-bool', () => {
    expect(() => validate({ a: 'maybe' }, { a: { type: 'bool' } })).toThrow(HttpError)
  })
})

describe('validate · error shape', () => {
  test('HttpError includes issues array in details', () => {
    try {
      validate({ n: 'abc' }, { n: { type: 'int', required: true } })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect(err.status).toBe(400)
      expect(err.code).toBe('validation_failed')
      expect(Array.isArray(err.details?.issues)).toBe(true)
      expect(err.details.issues[0].field).toBe('n')
    }
  })
})
