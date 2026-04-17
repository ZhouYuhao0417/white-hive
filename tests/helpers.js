// Shared test helpers.
//
// The memory store uses a singleton on globalThis. Each test calls
// resetMemoryStore() to get a clean slate. We also clear env vars that
// would otherwise route calls to Postgres (tests are pure memory).

export function resetMemoryStore() {
  delete globalThis.__whitehiveMvpStore
}

export function clearProductionEnv() {
  delete process.env.DATABASE_URL
  delete process.env.POSTGRES_URL
  delete process.env.STORAGES_URL
  delete process.env.WHITEHIVE_REQUIRE_DATABASE
}

export function withoutDeepSeek(fn) {
  const prev = process.env.DEEPSEEK_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  try {
    return fn()
  } finally {
    if (prev !== undefined) process.env.DEEPSEEK_API_KEY = prev
  }
}

export function uniqueEmail(tag = 't') {
  return `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.whitehive.local`
}
