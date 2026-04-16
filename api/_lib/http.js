const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

export function json(payload, init = {}) {
  const status = init.status || 200
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...baseHeaders,
      ...(init.headers || {}),
    },
  })
}

export function ok(data, meta = undefined) {
  return json({
    ok: true,
    data,
    ...(meta ? { meta } : {}),
  })
}

export function fail(status, code, message, details = undefined) {
  return json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  )
}

export function methodNotAllowed(method, allowed) {
  return json(
    {
      ok: false,
      error: {
        code: 'method_not_allowed',
        message: `Method ${method} is not allowed for this endpoint.`,
      },
    },
    {
      status: 405,
      headers: {
        allow: allowed.join(', '),
      },
    },
  )
}

export async function readBody(request) {
  const contentType = request.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return {}
  }

  try {
    return await request.json()
  } catch {
    throw new HttpError(400, 'invalid_json', '请求体不是合法 JSON。')
  }
}

export function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = body[field]
    return value === undefined || value === null || value === ''
  })

  if (missing.length > 0) {
    throw new HttpError(400, 'missing_fields', '缺少必要字段。', { missing })
  }
}

export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function withApiErrors(work) {
  try {
    return await work()
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(error.status, error.code, error.message, error.details)
    }

    console.error('[whitehive-api] unexpected error', error)
    return fail(500, 'internal_error', '服务器暂时无法处理请求。')
  }
}

export function getQuery(request) {
  return new URL(request.url).searchParams
}
