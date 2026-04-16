import { fail, getQuery, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { createMatch } from './_lib/matcher.js'
import {
  createMessage,
  createOrder,
  createPayment,
  createService,
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
  reviewVerification,
  storeInfo,
  submitVerification,
  updateOrder,
  updateUserProfile,
  upsertDemoSession,
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
          return ok(await upsertDemoSession(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
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

      if (path === 'services') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) return ok(await getService(id))

          return ok(
            await listServices({
              category: query.get('category') || undefined,
              status: query.get('status') || 'published',
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(await createService(body))
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
          return ok(await createOrder(body))
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
          return ok(await createPayment(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'messages') {
        if (request.method === 'GET') {
          return ok(await listMessages(query.get('orderId')))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(await createMessage(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'verification') {
        if (request.method === 'GET') {
          return ok(await getVerificationProfile(query.get('userId') || 'usr_demo_seller'))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(await submitVerification(body))
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
