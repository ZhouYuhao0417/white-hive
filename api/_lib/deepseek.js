// Shared DeepSeek chat client for all AI features.
//
// Never throws on network/LLM failure — returns { ok: false, reason } so
// callers can transparently fall back to rule-based logic.
//
// Configure via:
//   DEEPSEEK_API_KEY — required for live calls
//   DEEPSEEK_MODEL   — optional override (default: deepseek-chat)

const endpoint = 'https://api.deepseek.com/v1/chat/completions'
const defaultModel = 'deepseek-chat'
const defaultTimeoutMs = 25000

export function deepSeekStatus() {
  const configured = Boolean(process.env.DEEPSEEK_API_KEY)
  return {
    provider: 'deepseek',
    configured,
    model: process.env.DEEPSEEK_MODEL || defaultModel,
    endpoint,
    missing: configured ? [] : ['DEEPSEEK_API_KEY'],
  }
}

export function isDeepSeekConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY)
}

/**
 * Call DeepSeek chat completions.
 *
 * @param {Object} opts
 * @param {Array<{role:string, content:string}>} opts.messages
 * @param {string} [opts.model]
 * @param {number} [opts.temperature]
 * @param {boolean} [opts.jsonMode]   — ask for strict JSON response_format
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ok:boolean, text:string, usage?:object, finishReason?:string, reason?:string, error?:string, model?:string}>}
 */
export async function callDeepSeek({
  messages,
  model = process.env.DEEPSEEK_MODEL || defaultModel,
  temperature = 0.3,
  jsonMode = false,
  maxTokens = 1400,
  timeoutMs = defaultTimeoutMs,
} = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return { ok: false, reason: 'not_configured', text: '' }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, reason: 'no_messages', text: '' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return {
        ok: false,
        reason: `http_${response.status}`,
        text: '',
        error: errText.slice(0, 500),
      }
    }

    const json = await response.json()
    const choice = json.choices?.[0]
    const content = choice?.message?.content || ''

    return {
      ok: true,
      text: content,
      usage: json.usage,
      finishReason: choice?.finish_reason,
      model,
    }
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : 'network_error'
    return {
      ok: false,
      reason,
      text: '',
      error: String(err?.message || err).slice(0, 500),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Tolerant JSON parser for LLM output.
 *
 * DeepSeek sometimes wraps JSON in ```json``` fences even with response_format,
 * or includes leading/trailing prose. This strips those and recovers.
 *
 * Returns parsed object on success, null on failure (never throws).
 */
export function parseJsonFromLlm(text) {
  if (!text || typeof text !== 'string') return null

  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try {
    return JSON.parse(stripped)
  } catch {
    // try to extract the first balanced {...} block
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    const candidate = stripped.slice(start, end + 1)
    try {
      return JSON.parse(candidate)
    } catch {
      return null
    }
  }
}
