import { fail, getQuery, HttpError, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { createMatch } from './_lib/matcher.js'
import { blobStatus, uploadAvatarToBlob } from './_lib/blob.js'
import { deepSeekStatus } from './_lib/deepseek.js'
import { emailStatus } from './_lib/email.js'
import {
  decryptWechatPayResource,
  paymentGatewayStatus,
  verifyWechatPayNotifySignature,
} from './_lib/payment-gateway.js'
import { smsStatus } from './_lib/sms.js'
import {
  buildOAuthStartUrl,
  oauthProviderStatus,
  resolveOAuthProfile,
  verifyOAuthState,
} from './_lib/oauth.js'
import {
  createMessage,
  createOrder,
  createPayment,
  createReview,
  createService,
  checkRateLimit,
  confirmEmailVerification,
  confirmPasswordReset,
  confirmPhoneLogin,
  confirmPhoneVerification,
  confirmWechatPayment,
  confirmWechatRefund,
  deleteUserAccount,
  getDemoUser,
  getOrder,
  getPayment,
  getSessionByToken,
  getService,
  getVerificationProfile,
  listMessages,
  listNotifications,
  listOrders,
  listPayments,
  listReviews,
  listServices,
  listVerificationRequests,
  markNotificationsRead,
  requestEmailVerification,
  requestPhoneLogin,
  requestPasswordReset,
  requestPhoneVerification,
  reviewService,
  reviewVerification,
  storeInfo,
  submitVerification,
  updateOrder,
  updateReview,
  updateService,
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

function rateLimitPhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '') || 'unknown-phone'
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

async function enforcePhoneVerificationSendRateLimit(request, token) {
  await checkRateLimit({
    bucket: 'phone_verification_send_ip',
    identifier: clientIp(request),
    limit: 20,
    windowSeconds: 10 * 60,
    message: '短信验证码发送太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'phone_verification_send_session',
    identifier: rateLimitSessionIdentifier(request, token),
    limit: 4,
    windowSeconds: 10 * 60,
    message: '这个账号的短信验证码发送太频繁，请稍后再试。',
  })
}

async function enforcePhoneVerificationConfirmRateLimit(request, token) {
  await checkRateLimit({
    bucket: 'phone_verification_confirm_ip',
    identifier: clientIp(request),
    limit: 40,
    windowSeconds: 10 * 60,
    message: '短信验证码校验太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'phone_verification_confirm_session',
    identifier: rateLimitSessionIdentifier(request, token),
    limit: 8,
    windowSeconds: 10 * 60,
    message: '短信验证码尝试次数过多，请稍后重新发送。',
  })
}

async function enforcePhoneLoginSendRateLimit(request, body = {}) {
  await checkRateLimit({
    bucket: 'phone_login_send_ip',
    identifier: clientIp(request),
    limit: 20,
    windowSeconds: 10 * 60,
    message: '手机号验证码发送太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'phone_login_send_phone',
    identifier: rateLimitPhone(body.phone),
    limit: 4,
    windowSeconds: 15 * 60,
    message: '这个手机号的验证码发送太频繁，请稍后再试。',
  })
}

async function enforcePhoneLoginConfirmRateLimit(request, body = {}) {
  await checkRateLimit({
    bucket: 'phone_login_confirm_ip',
    identifier: clientIp(request),
    limit: 40,
    windowSeconds: 10 * 60,
    message: '手机号验证码校验太频繁，请稍后再试。',
  })
  await checkRateLimit({
    bucket: 'phone_login_confirm_phone',
    identifier: rateLimitPhone(body.phone),
    limit: 10,
    windowSeconds: 10 * 60,
    message: '验证码尝试次数过多，请重新发送。',
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
  if (!user || !order) {
    throw new HttpError(401, 'missing_session', '请先登录。')
  }
  if (order.buyerId === user.id || order.sellerId === user.id || user.role === 'admin') return
  throw new HttpError(403, 'not_order_participant', '你不是这个订单的参与方。')
}

function ensureOrderBuyer(user, order) {
  if (!user || !order) {
    throw new HttpError(401, 'missing_session', '请先登录。')
  }
  if (order.buyerId === user.id || user.role === 'admin') return
  throw new HttpError(403, 'not_order_buyer', '只有买家可以发起付款。')
}

function ensureOrderStatusActor(user, order, nextStatus) {
  ensureOrderParticipant(user, order)
  if (!nextStatus || user.role === 'admin') return

  const sellerStatuses = ['accepted', 'in_progress', 'delivered', 'cancelled']
  const buyerStatuses = ['completed', 'cancelled']

  if (order.sellerId === user.id && sellerStatuses.includes(nextStatus)) return
  if (order.buyerId === user.id && buyerStatuses.includes(nextStatus)) return

  throw new HttpError(403, 'order_status_forbidden', '当前账号不能执行这个订单状态操作。')
}

async function requireAdminReviewer(request) {
  const configuredReviewToken = process.env.WHITEHIVE_ADMIN_REVIEW_TOKEN || ''
  const reviewToken = request.headers.get('x-whitehive-admin-token') || ''
  if (configuredReviewToken && reviewToken && reviewToken === configuredReviewToken) {
    return {
      id: 'usr_admin_token',
      email: 'admin-token@whitehive.local',
      role: 'admin',
    }
  }

  const user = await requireSessionUser(request)

  const adminEmails = String(process.env.WHITEHIVE_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  if (user?.role === 'admin' || (user?.email && adminEmails.includes(user.email.toLowerCase()))) return user

  throw new HttpError(403, 'admin_required', '只有管理员可以执行审核操作。')
}

function authProviderStatus() {
  const sms = smsStatus()
  return {
    password: { mode: 'active', configured: true },
    phone: {
      mode: sms.configured ? 'live' : sms.mockEnabled ? 'mock' : 'unavailable',
      configured: sms.configured,
      provider: sms.provider,
      mockEnabled: sms.mockEnabled,
      missing: sms.missing,
    },
    github: {
      ...oauthProviderStatus('github'),
    },
    wechat: {
      ...oauthProviderStatus('wechat'),
    },
    qq: {
      ...oauthProviderStatus('qq'),
    },
  }
}

function allowLegacyProviderBridge() {
  return process.env.WHITEHIVE_ALLOW_PROVIDER_BRIDGE === '1'
}

async function anonymousSession() {
  if (process.env.WHITEHIVE_ALLOW_DEMO_SESSION === '1') {
    return {
      user: await getDemoUser(),
      session: {
        mode: 'demo',
        token: 'demo_usr_demo_buyer',
        expiresAt: null,
      },
    }
  }

  return {
    user: null,
    session: {
      mode: 'anonymous',
      token: null,
      expiresAt: null,
    },
  }
}

function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      location,
      'cache-control': 'no-store',
    },
  })
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
          email: emailStatus(),
          uploads: {
            avatar: blobStatus(),
          },
          ai: {
            deepseek: deepSeekStatus(),
          },
          payments: paymentGatewayStatus(),
          authProviders: authProviderStatus(),
        })
      }

      if (path === 'payments/wechat/notify') {
        if (request.method !== 'POST') return methodNotAllowed(request.method, ['POST'])

        const rawBody = await request.text()
        verifyWechatPayNotifySignature({ headers: request.headers, rawBody })
        const body = JSON.parse(rawBody)
        const resource = decryptWechatPayResource(body.resource)
        if (resource.trade_state === 'SUCCESS') {
          await confirmWechatPayment({
            outTradeNo: resource.out_trade_no,
            transactionId: resource.transaction_id,
            successTime: resource.success_time,
            amountCents: resource.amount?.total,
          })
        }

        return new Response(JSON.stringify({ code: 'SUCCESS', message: '成功' }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      }

      if (path === 'payments/wechat/refund-notify') {
        if (request.method !== 'POST') return methodNotAllowed(request.method, ['POST'])

        const rawBody = await request.text()
        verifyWechatPayNotifySignature({ headers: request.headers, rawBody })
        const body = JSON.parse(rawBody)
        const resource = decryptWechatPayResource(body.resource)
        if (resource.refund_status === 'SUCCESS') {
          await confirmWechatRefund({
            outTradeNo: resource.out_trade_no,
            outRefundNo: resource.out_refund_no,
            successTime: resource.success_time,
          })
        }

        return new Response(JSON.stringify({ code: 'SUCCESS', message: '成功' }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      }

      if (path === 'auth/session') {
        if (request.method === 'GET') {
          const token = bearerToken(request)
          if (token) {
            return ok(await getSessionByToken(token))
          }

          return ok(await anonymousSession())
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
          if (!allowLegacyProviderBridge()) {
            throw new HttpError(
              410,
              'provider_bridge_disabled',
              '第三方登录需要通过真实平台授权，当前入口不可用。',
            )
          }
          const body = await readBody(request)
          await enforceProviderAuthRateLimit(request, body)
          return ok(await upsertProviderSession(body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      if (path === 'auth/phone-login') {
        if (request.method === 'POST') {
          const body = await readBody(request)
          await enforcePhoneLoginSendRateLimit(request, body)
          return ok(await requestPhoneLogin(body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      if (path === 'auth/phone-login/confirm') {
        if (request.method === 'POST') {
          const body = await readBody(request)
          await enforcePhoneLoginConfirmRateLimit(request, body)
          return ok(await confirmPhoneLogin(body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      const oauthMatch = path.match(/^auth\/oauth\/([^/]+)\/(start|callback)$/)
      if (oauthMatch) {
        const [, provider, action] = oauthMatch
        if (request.method !== 'GET') return methodNotAllowed(request.method, ['GET'])

        if (action === 'start') {
          const url = buildOAuthStartUrl(request, provider, {
            role: query.get('role'),
            returnTo: query.get('returnTo'),
          })
          return redirect(url)
        }

        const error = query.get('error')
        if (error) {
          return redirect(`/auth/callback?provider=${encodeURIComponent(provider)}&error=${encodeURIComponent(error)}`)
        }

        const state = verifyOAuthState(query.get('state'), provider)
        const profile = await resolveOAuthProfile(provider, query.get('code'), request)
        const session = await upsertProviderSession({
          ...profile,
          role: state.role,
        })
        const hash = new URLSearchParams({
          token: session.session.token,
          provider,
          returnTo: state.returnTo,
        }).toString()
        return redirect(`/auth/callback#${hash}`)
      }

      if (path === 'auth/providers') {
        if (request.method === 'GET') {
          return ok(authProviderStatus())
        }

        return methodNotAllowed(request.method, ['GET'])
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

      if (path === 'uploads/avatar') {
        if (request.method === 'POST') {
          const token = bearerToken(request)
          const user = await requireSessionUser(request)
          const body = await readBody(request)
          const upload = await uploadAvatarToBlob({
            userId: user.id,
            fileName: body.fileName,
            contentType: body.contentType,
            dataUrl: body.dataUrl || body.avatarUrl,
          })
          const profile = await updateUserProfile(token, { avatarUrl: upload.url })
          return ok({
            upload,
            user: profile.user,
          })
        }

        return methodNotAllowed(request.method, ['POST'])
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

      if (path === 'auth/phone-verification') {
        const token = bearerToken(request)

        if (request.method === 'GET' || request.method === 'POST') {
          const body = request.method === 'POST' ? await readBody(request) : {}
          await enforcePhoneVerificationSendRateLimit(request, token)
          return ok(await requestPhoneVerification(token, body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'auth/phone-verification/confirm') {
        if (request.method === 'POST') {
          const token = bearerToken(request)
          const body = await readBody(request)
          await enforcePhoneVerificationConfirmRateLimit(request, token)
          return ok(await confirmPhoneVerification(token, body))
        }

        return methodNotAllowed(request.method, ['POST'])
      }

      if (path === 'services') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) {
            const user = await optionalSessionUser(request)
            const service = await getService(id)
            if (service.status !== 'published' && service.sellerId !== user?.id && user?.role !== 'admin') {
              throw new HttpError(404, 'service_not_found', '没有找到这个服务。')
            }
            return ok(service)
          }

          const user = await optionalSessionUser(request)
          const requestedStatus = query.get('status') || 'published'
          const requestedSellerId = query.get('sellerId') || undefined
          const ownsSellerFilter = Boolean(user?.id && requestedSellerId === user.id)
          if (requestedStatus !== 'published' && !ownsSellerFilter) {
            await requireAdminReviewer(request)
          }
          return ok(
            await listServices({
              category: query.get('category') || undefined,
              status: requestedStatus,
              sellerId: requestedSellerId,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          if (!['seller', 'admin'].includes(user.role)) {
            throw new HttpError(403, 'seller_required', '只有创作者账号可以发布服务。')
          }
          await enforceVerificationSubmitRateLimit(request, user?.id || body.userId)
          return ok(
            await createService({
              ...body,
              sellerId: user.id,
              status: user.role === 'admin' ? body.status : 'pending_review',
            }),
          )
        }

        if (request.method === 'PUT') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          return ok(
            await updateService(query.get('id'), {
              ...body,
              actorId: user.id,
              actorRole: user.role,
            }),
          )
        }

        if (request.method === 'PATCH') {
          const user = await requireAdminReviewer(request)
          const body = await readBody(request)
          return ok(
            await reviewService(query.get('id'), {
              ...body,
              reviewerId: user.id,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST', 'PUT', 'PATCH'])
      }

      if (path === 'notifications') {
        const user = await requireSessionUser(request)

        if (request.method === 'GET') {
          return ok(await listNotifications({ userId: user.id, limit: query.get('limit') || 30 }))
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          return ok(await markNotificationsRead({ userId: user.id, ids: body.ids || [] }))
        }

        return methodNotAllowed(request.method, ['GET', 'PATCH'])
      }

      if (path === 'orders') {
        if (request.method === 'GET') {
          const user = await optionalSessionUser(request)
          const id = query.get('id')
          if (id) {
            const order = await getOrder(id)
            ensureOrderParticipant(user, order)
            return ok(order)
          }

          if (!user) return ok([])

          return ok(
            await listOrders({
              userId: user.role === 'admin' ? query.get('userId') || undefined : user.id,
              status: query.get('status') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          return ok(
            await createOrder({
              ...body,
              buyerId: user.id,
            }),
          )
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          const order = await getOrder(query.get('id'))
          ensureOrderStatusActor(user, order, body.status)
          if (body.paymentStatus !== undefined && user.role !== 'admin') {
            throw new HttpError(403, 'payment_status_admin_only', '付款状态只能由支付流程或管理员更新。')
          }
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
          const user = await requireSessionUser(request)
          const id = query.get('id')
          if (id) {
            const payment = await getPayment(id)
            const order = await getOrder(payment.orderId)
            ensureOrderParticipant(user, order)
            return ok(payment)
          }

          const orderId = query.get('orderId') || undefined
          if (orderId) {
            const order = await getOrder(orderId)
            ensureOrderParticipant(user, order)
          }

          const payments = await listPayments({
            orderId,
            status: query.get('status') || undefined,
          })

          return ok(
            user.role === 'admin'
              ? payments
              : payments.filter((payment) => payment.buyerId === user.id || payment.sellerId === user.id),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          const order = await getOrder(body.orderId)
          ensureOrderBuyer(user, order)
          return ok(
            await createPayment({
              ...body,
              buyerId: user.id,
              clientIp: clientIp(request),
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'messages') {
        if (request.method === 'GET') {
          const user = await requireSessionUser(request)
          const order = await getOrder(query.get('orderId'))
          ensureOrderParticipant(user, order)
          return ok(await listMessages(query.get('orderId')))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          const order = await getOrder(body.orderId)
          ensureOrderParticipant(user, order)
          return ok(
            await createMessage({
              ...body,
              senderId: user.id,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'verification') {
        if (request.method === 'GET') {
          const user = await requireSessionUser(request)
          if (query.get('scope') === 'admin') {
            await requireAdminReviewer(request)
            return ok(
              await listVerificationRequests({
                status: query.get('status') || 'pending',
                limit: query.get('limit') || undefined,
              }),
            )
          }

          const requestedUserId = query.get('userId') || user.id
          if (requestedUserId !== user.id) {
            await requireAdminReviewer(request)
          }
          return ok(await getVerificationProfile(requestedUserId))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          await enforceVerificationSubmitRateLimit(request, user.id)
          return ok(
            await submitVerification({
              ...body,
              userId: user.id,
            }),
          )
        }

        if (request.method === 'PATCH') {
          await requireAdminReviewer(request)
          const body = await readBody(request)
          return ok(await reviewVerification(query.get('id'), body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
      }

      if (path === 'reviews') {
        if (request.method === 'GET') {
          const orderId = query.get('orderId') || undefined
          const sellerId = query.get('sellerId') || undefined
          const buyerId = query.get('buyerId') || undefined

          // 订单内评价需要校验是当事人, 公开的 sellerId/buyerId 查询不需要登录
          if (orderId && !sellerId && !buyerId) {
            const user = await requireSessionUser(request)
            const order = await getOrder(orderId)
            ensureOrderParticipant(user, order)
          }

          return ok(
            await listReviews({
              orderId,
              sellerId,
              buyerId,
              limit: query.get('limit') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          const order = await getOrder(body.orderId)
          ensureOrderParticipant(user, order)
          await checkRateLimit({
            bucket: 'reviews_create_user',
            identifier: user.id,
            limit: 10,
            windowSeconds: 60 * 60,
            message: '评价提交太频繁, 请稍后再试。',
          })
          return ok(
            await createReview({
              ...body,
              reviewerId: user.id,
            }),
          )
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          const user = await requireSessionUser(request)
          return ok(
            await updateReview(query.get('id'), {
              ...body,
              reviewerId: user.id,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
      }

      return fail(404, 'api_route_not_found', '没有找到这个 API 路由。', { path })
    })
  },
}
