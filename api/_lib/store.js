import * as memory from './memory-store.js'
import * as postgres from './postgres-store.js'
import { HttpError } from './http.js'

const requireDatabase = process.env.WHITEHIVE_REQUIRE_DATABASE === '1'

function shouldUsePostgres() {
  return postgres.hasDatabase()
}

async function callStore(name, args) {
  if (!shouldUsePostgres()) {
    return memory[name](...args)
  }

  try {
    return await postgres[name](...args)
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }

    if (requireDatabase) {
      throw error
    }

    console.error(`[whitehive-api] postgres ${name} failed, falling back to memory`, error)
    return memory[name](...args)
  }
}

export async function storeInfo() {
  if (!shouldUsePostgres()) {
    return memory.storeInfo()
  }

  try {
    return await postgres.storeInfo()
  } catch (error) {
    if (requireDatabase) {
      throw error
    }

    console.error('[whitehive-api] postgres health failed, falling back to memory', error)
    return {
      ...memory.storeInfo(),
      driver: 'memory-fallback',
      note: 'DATABASE_URL 已配置，但数据库暂时不可用，当前自动回退到内存演示数据。',
    }
  }
}

export function getDemoUser() {
  return callStore('getDemoUser', [])
}

export function upsertDemoSession(input) {
  return callStore('upsertDemoSession', [input])
}

export function upsertProviderSession(input) {
  return callStore('upsertProviderSession', [input])
}

export function requestPasswordReset(input) {
  return callStore('requestPasswordReset', [input])
}

export function confirmPasswordReset(input) {
  return callStore('confirmPasswordReset', [input])
}

export function getSessionByToken(token) {
  return callStore('getSessionByToken', [token])
}

export function requestEmailVerification(token) {
  return callStore('requestEmailVerification', [token])
}

export function confirmEmailVerification(token, input) {
  return callStore('confirmEmailVerification', [token, input])
}

export function deleteUserAccount(token) {
  return callStore('deleteUserAccount', [token])
}

export function checkRateLimit(input) {
  return callStore('checkRateLimit', [input])
}

export function updateUserProfile(token, input) {
  return callStore('updateUserProfile', [token, input])
}

export function listServices(input) {
  return callStore('listServices', [input])
}

export function getService(id) {
  return callStore('getService', [id])
}

export function createService(input) {
  return callStore('createService', [input])
}

export function listOrders(input) {
  return callStore('listOrders', [input])
}

export function getOrder(id) {
  return callStore('getOrder', [id])
}

export function createOrder(input) {
  return callStore('createOrder', [input])
}

export function updateOrder(id, input) {
  return callStore('updateOrder', [id, input])
}

export function listPayments(input) {
  return callStore('listPayments', [input])
}

export function getPayment(id) {
  return callStore('getPayment', [id])
}

export function createPayment(input) {
  return callStore('createPayment', [input])
}

export function listMessages(orderId) {
  return callStore('listMessages', [orderId])
}

export function createMessage(input) {
  return callStore('createMessage', [input])
}

export function getVerificationProfile(userId) {
  return callStore('getVerificationProfile', [userId])
}

export function submitVerification(input) {
  return callStore('submitVerification', [input])
}

export function reviewVerification(id, input) {
  return callStore('reviewVerification', [id, input])
}
