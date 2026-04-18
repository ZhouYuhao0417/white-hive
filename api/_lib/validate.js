// Small declarative validator for API bodies.
//
// This isn't a replacement for zod — it's a lightweight schema-ish helper that
// keeps api/*.js handlers from being a wall of if/throw. Throws HttpError(400)
// with a structured `details.issues` array when validation fails.
//
// Usage:
//   const body = validate(raw, {
//     title:    { type: 'string', required: true, maxLen: 80 },
//     brief:    { type: 'string', required: true, minLen: 4, maxLen: 4000 },
//     budgetCents: { type: 'int', min: 0 },
//     category: { type: 'enum', values: ['web','design','video'] },
//     tags:     { type: 'stringArray', maxItems: 8, maxItemLen: 16 },
//     email:    { type: 'email' },
//     url:      { type: 'url', protocols: ['https:'] },
//   })

import { HttpError } from './http.js'

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

function checkString(value, rule) {
  if (typeof value !== 'string') return { ok: false, msg: 'must be a string' }
  const trimmed = rule.trim === false ? value : value.trim()
  if (rule.minLen != null && trimmed.length < rule.minLen) {
    return { ok: false, msg: `must be at least ${rule.minLen} chars` }
  }
  if (rule.maxLen != null && trimmed.length > rule.maxLen) {
    return { ok: false, msg: `must be at most ${rule.maxLen} chars` }
  }
  if (rule.pattern && !rule.pattern.test(trimmed)) {
    return { ok: false, msg: 'has invalid format' }
  }
  return { ok: true, value: trimmed }
}

function checkInt(value, rule) {
  if (value === '' || value === null || value === undefined) {
    return { ok: false, msg: 'must be a number' }
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return { ok: false, msg: 'must be a number' }
  const int = Math.trunc(n)
  if (rule.min != null && int < rule.min) return { ok: false, msg: `must be ≥ ${rule.min}` }
  if (rule.max != null && int > rule.max) return { ok: false, msg: `must be ≤ ${rule.max}` }
  return { ok: true, value: int }
}

function checkEnum(value, rule) {
  const list = Array.isArray(rule.values) ? rule.values : []
  if (!list.includes(value)) {
    return { ok: false, msg: `must be one of ${list.join('|')}` }
  }
  return { ok: true, value }
}

function checkBool(value) {
  if (typeof value === 'boolean') return { ok: true, value }
  if (value === 'true') return { ok: true, value: true }
  if (value === 'false') return { ok: true, value: false }
  return { ok: false, msg: 'must be a boolean' }
}

function checkStringArray(value, rule) {
  if (!Array.isArray(value)) return { ok: false, msg: 'must be an array of strings' }
  if (rule.maxItems != null && value.length > rule.maxItems) {
    return { ok: false, msg: `must have at most ${rule.maxItems} items` }
  }
  const out = []
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false, msg: 'all items must be strings' }
    const trimmed = item.trim()
    if (!trimmed) continue
    if (rule.maxItemLen != null && trimmed.length > rule.maxItemLen) {
      return { ok: false, msg: `each item ≤ ${rule.maxItemLen} chars` }
    }
    out.push(trimmed)
  }
  return { ok: true, value: out }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function checkEmail(value) {
  if (typeof value !== 'string') return { ok: false, msg: 'must be a string' }
  const trimmed = value.trim().toLowerCase()
  if (!emailPattern.test(trimmed)) return { ok: false, msg: 'must be an email' }
  if (trimmed.length > 254) return { ok: false, msg: 'must be ≤ 254 chars' }
  return { ok: true, value: trimmed }
}

function checkUrl(value, rule) {
  if (typeof value !== 'string') return { ok: false, msg: 'must be a string' }
  let url
  try {
    url = new URL(value)
  } catch {
    return { ok: false, msg: 'must be a URL' }
  }
  const protocols = Array.isArray(rule.protocols) ? rule.protocols : ['http:', 'https:']
  if (!protocols.includes(url.protocol)) {
    return { ok: false, msg: `protocol must be ${protocols.join(' or ')}` }
  }
  return { ok: true, value: url.toString() }
}

const checkers = {
  string: checkString,
  int: checkInt,
  enum: checkEnum,
  bool: checkBool,
  stringArray: checkStringArray,
  email: checkEmail,
  url: checkUrl,
}

export function validate(body, schema) {
  if (!isObj(body)) {
    throw new HttpError(400, 'invalid_body', '请求体必须是 JSON 对象。')
  }
  if (!isObj(schema)) {
    throw new Error('validate(): schema must be an object')
  }

  const output = {}
  const issues = []

  for (const [field, rule] of Object.entries(schema)) {
    const raw = body[field]
    const present = raw !== undefined && raw !== null && raw !== ''

    if (!present) {
      if (rule.required) {
        issues.push({ field, msg: 'required' })
      } else if (rule.default !== undefined) {
        output[field] = typeof rule.default === 'function' ? rule.default() : rule.default
      }
      continue
    }

    const check = checkers[rule.type]
    if (!check) {
      issues.push({ field, msg: `unknown type ${rule.type}` })
      continue
    }

    const result = check(raw, rule)
    if (!result.ok) {
      issues.push({ field, msg: result.msg })
    } else {
      output[field] = result.value
    }
  }

  if (issues.length > 0) {
    throw new HttpError(400, 'validation_failed', '请求体字段校验失败。', { issues })
  }

  return output
}
