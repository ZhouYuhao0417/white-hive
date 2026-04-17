import { fail, getQuery, HttpError, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { createMatch } from './_lib/matcher.js'
import {
  createMessage,
  createOrder,
  createPayment,
  createService,
  checkRateLimit,
  confirmEmailVerification,
  confirmPasswordReset,
  deleteUserAccount,
  getDemoUser,
  getOrder,
  getPayment,
  getSessionByToken,
  getService,
  getVerificationProfile,
  listMessages,
  listOrders,
  listPayments,
  listServices,
  requestEmailVerification,
  requestPasswordReset,
  reviewVerification,
  storeInfo,
  submitVerification,
  updateOrder,
  updateUserProfile,
  upsertDemoSession,
  upsertProviderSession,
} from './_lib/store.js'

function routePath(request) {
  const url = new URL(request.url)
  const fromQuery = url.searchParams.get('path')
  const fromPathname = url.pathname.replace(/^\/api\/?/, '')
  return String(fromQuery || fromPathname || 'health')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

function clientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const firstForwardedIp = forwardedFor.split(',')[0]?.trim()
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    firstForwardedIp ||
    'unknown'
  )
}

function rateLimitEmail(email) {
  return String(email || '').trim().toLowerCase() || 'unknown-email'
}

function rateLimitSessionIdentifier(request, token = bearerToken(request)) {
  return token || `ip:${clientIp(request)}`
}

async function enforceAuthSessionRateLimit(request, body = {}) {
  const action = body.action || (body.mode === 'signin' ? 'signin' : 'signup')
  const isSignin = action === 'signin'
  await checkRateLimit({
    bucket: `auth_session_${isSignin ? 'signin' : 'signup'}_ip`,
    identifier: clientIp(request),
    limit: isSignin ? 30 : 15,
    windowSeconds: 15 * 60,
    message: '注册/登录请求太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: `auth_session_${isSignin ? 'signin' : 'signup'}_email`,
    identifier: rateLimitEmail(body.email),
    limit: isSignin ? 8 : 5,
    windowSeconds: 15 * 60,
    message: isSignin ? '登录尝试过多，请稍后再试。' : '注册尝试过多，请稍后再试。',
  })
}

async function enforceEmailVerificationSendRateLimit(request, token) {
  await checkRateLimit({
    bucket: 'email_verification_send_ip',
    identifier: clientIp(request),
    limit: 20,
    windowSeconds: 10 * 60,
    message: '验证码发送太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'email_verification_send_session',
    identifier: rateLimitSessionIdentifier(request, token),
    limit: 4,
    windowSeconds: 10 * 60,
    message: '这个账号的验证码发送太频繁，请稍后再试。',
  })
}

async function enforceEmailVerificationConfirmRateLimit(request, token) {
  await checkRateLimit({
    bucket: 'email_verification_confirm_ip',
    identifier: clientIp(request),
    limit: 40,
    windowSeconds: 10 * 60,
    message: '验证码校验太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'email_verification_confirm_session',
    identifier: rateLimitSessionIdentifier(request, token),
    limit: 8,
    windowSeconds: 10 * 60,
    message: '验证码尝试次数过多，请稍后重新发送。',
  })
}

async function enforceProviderAuthRateLimit(request, body = {}) {
  const provider = String(body.provider || 'unknown').trim().toLowerCase()
  await checkRateLimit({
    bucket: `auth_provider_${provider}_ip`,
    identifier: clientIp(request),
    limit: 30,
    windowSeconds: 15 * 60,
    message: '第三方登录请求太频繁，请稍后再试。',
  })
}

async function enforcePasswordResetSendRateLimit(request, body = {}) {
  await checkRateLimit({
    bucket: 'password_reset_send_ip',
    identifier: clientIp(request),
    limit: 12,
    windowSeconds: 15 * 60,
    message: '密码重置请求太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'password_reset_send_email',
    identifier: rateLimitEmail(body.email),
    limit: 4,
    windowSeconds: 15 * 60,
    message: '这个邮箱的密码重置请求太频繁，请稍后再试。',
  })
}

async function enforcePasswordResetConfirmRateLimit(request, body = {}) {
  await checkRateLimit({
    bucket: 'password_reset_confirm_ip',
    identifier: clientIp(request),
    limit: 30,
    windowSeconds: 15 * 60,
    message: '密码重置校验太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'password_reset_confirm_email',
    identifier: rateLimitEmail(body.email),
    limit: 8,
    windowSeconds: 15 * 60,
    message: '验证码尝试次数过多，请重新发送。',
  })
}

async function enforceVerificationSubmitRateLimit(request, userId) {
  await checkRateLimit({
    bucket: 'verification_submit_user',
    identifier: userId || clientIp(request),
    limit: 6,
    windowSeconds: 60 * 60,
    message: '实名认证提交太频繁，请稍后再试。',
  })
}

async function optionalSessionUser(request) {
  const token = bearerToken(request)
  if (!token) return null
  const session = await getSessionByToken(token)
  return session.user || null
}

async function requireSessionUser(request) {
  const token = bearerToken(request)
  if (!token) {
    throw new HttpError(401, 'missing_session', '请先登录。')
  }
  const session = await getSessionByToken(token)
  return session.user
}

function ensureOrderParticipant(user, order) {
  if (!user || !order) return
  if (order.buyerId === user.id || order.sellerId === user.id || user.role === 'admin') return
  throw new HttpError(403, 'not_order_participant', '你不是这个订单的参与方。')
}

function ensureOrderBuyer(user, order) {
  if (!user || !order) return
  if (order.buyerId === user.id || user.role === 'admin') return
  throw new HttpError(403, 'not_order_buyer', '只有买家可以发起付款。')
}

export default {
  async fetch(request) {
    return withApiErrors(async () => {
      const path = routePath(request)
      const query = getQuery(request)

      if (path === 'health') {
        if (request.method !== 'GET') return methodNotAllowed(request.method, ['GET'])
        return ok({
          service: 'whitehive-api',
          status: 'ok',
          time: new Date().toISOString(),
          storage: await storeInfo(),
        })
      }

      if (path === 'auth/session') {
        if (request.method === 'GET') {
          const token = bearerToken(request)
          if (token) {
            return ok(await getSessionByToken(token))
          }

          return ok({
            user: await getDemoUser(),
            session: {
              mode: 'demo',
              token: 'demo_usr_demo_buyer',
              expiresAt: null,
            },
          })
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          await enforceAuthSessionRateLimit(request, body)
          return ok(await upsertDemoSession(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'auth/provider') {
        if (request.method === 'POST') {
          const body = await readBody(request)
          await enforceProviderAuthRateLimit(request, body)
          return ok(await upsertProviderSession(body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      if (path === 'auth/password-reset') {
        if (request.method === 'POST') {
          const body = await readBody(request)
          await enforcePasswordResetSendRateLimit(request, body)
          return ok(await requestPasswordReset(body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      if (path === 'auth/password-reset/confirm') {
        if (request.method === 'POST') {
          const body = await readBody(request)
          await enforcePasswordResetConfirmRateLimit(request, body)
          return ok(await confirmPasswordReset(body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      if (path === 'auth/profile') {
        const token = bearerToken(request)
        if (request.method === 'GET') {
          return ok(await getSessionByToken(token))
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          return ok(await updateUserProfile(token, body))
        }

        return methodNotAllowed(request.method, ['GET', 'PATCH'])
      }

      if (path === 'auth/verification') {
        const user = await requireSessionUser(request)

        if (request.method === 'GET') {
          return ok(await getVerificationProfile(user.id))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          await enforceVerificationSubmitRateLimit(request, user.id)
          return ok(
            await submitVerification({
              ...body,
              userId: user.id,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'auth/account') {
        if (request.method === 'DELETE') {
          const token = bearerToken(request)
          return ok(await deleteUserAccount(token))
        }

        return methodNotAllowed(request.method, ['DELETE'])
      }

      if (path === 'auth/email-verification') {
        const token = bearerToken(request)

        if (request.method === 'GET' || request.method === 'POST') {
          await enforceEmailVerificationSendRateLimit(request, token)
          return ok(await requestEmailVerification(token))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'auth/email-verification/confirm') {
        if (request.method === 'POST') {
          const token = bearerToken(request)
          const body = await readBody(request)
          await enforceEmailVerificationConfirmRateLimit(request, token)
          return ok(await confirmEmailVerification(token, body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      if (path === 'services') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) return ok(await getService(id))

          return ok(
            await listServices({
              category: query.get('category') || undefined,
              status: query.get('status') || 'published',
              sellerId: query.get('sellerId') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await optionalSessionUser(request)
          await enforceVerificationSubmitRateLimit(request, user?.id || body.userId)
          return ok(
            await createService({
              ...body,
              sellerId: user?.id || body.sellerId,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'orders') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) return ok(await getOrder(id))

          return ok(
            await listOrders({
              userId: query.get('userId') || undefined,
              status: query.get('status') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await optionalSessionUser(request)
          return ok(
            await createOrder({
              ...body,
              buyerId: user?.id || body.buyerId,
            }),
          )
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          return ok(await updateOrder(query.get('id'), body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
      }

      if (path === 'matches') {
        if (request.method === 'GET') {
          return ok(
            await createMatch({
              brief: query.get('q') || query.get('brief') || '',
              category: query.get('category') || undefined,
              budgetCents: query.get('budgetCents') || undefined,
              deadline: query.get('deadline') || undefined,
              limit: query.get('limit') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(await createMatch(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'payments') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) return ok(await getPayment(id))

          return ok(
            await listPayments({
              orderId: query.get('orderId') || undefined,
              status: query.get('status') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await optionalSessionUser(request)
          if (user) {
            const order = await getOrder(body.orderId)
            ensureOrderBuyer(user, order)
          }
          return ok(
            await createPayment({
              ...body,
              buyerId: user?.id || body.buyerId,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'messages') {
        if (request.method === 'GET') {
          return ok(await listMessages(query.get('orderId')))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await optionalSessionUser(request)
          if (user) {
            const order = await getOrder(body.orderId)
            ensureOrderParticipant(user, order)
          }
          return ok(
            await createMessage({
              ...body,
              senderId: user?.id || body.senderId,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'verification') {
        if (request.method === 'GET') {
          const user = await optionalSessionUser(request)
          return ok(await getVerificationProfile(user?.id || query.get('userId') || 'usr_demo_seller'))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await optionalSessionUser(request)
          return ok(
            await submitVerification({
              ...body,
              userId: user?.id || body.userId,
            }),
          )
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          return ok(await reviewVerification(query.get('id'), body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
      }

      return fail(404, 'api_route_not_found', '没有找到这个 API 路由。', { path })
    })
  },
}
