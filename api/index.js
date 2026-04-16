import { fail, getQuery, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import {
  createMessage,
  createOrder,
  createPayment,
  createService,
  getDemoUser,
  getOrder,
  getPayment,
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
          storage: storeInfo(),
        })
      }

      if (path === 'auth/session') {
        if (request.method === 'GET') {
          return ok({
            user: getDemoUser(),
            session: {
              mode: 'demo',
              token: 'demo_usr_demo_buyer',
              expiresAt: null,
            },
          })
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(
            upsertDemoSession({
              email: body.email,
              mode: body.role || body.mode,
            }),
          )
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'services') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) return ok(getService(id))

          return ok(
            listServices({
              category: query.get('category') || undefined,
              status: query.get('status') || 'published',
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(createService(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'orders') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) return ok(getOrder(id))

          return ok(
            listOrders({
              userId: query.get('userId') || undefined,
              status: query.get('status') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(createOrder(body))
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          return ok(updateOrder(query.get('id'), body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
      }

      if (path === 'payments') {
        if (request.method === 'GET') {
          const id = query.get('id')
          if (id) return ok(getPayment(id))

          return ok(
            listPayments({
              orderId: query.get('orderId') || undefined,
              status: query.get('status') || undefined,
            }),
          )
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(createPayment(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'messages') {
        if (request.method === 'GET') {
          return ok(listMessages(query.get('orderId')))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(createMessage(body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST'])
      }

      if (path === 'verification') {
        if (request.method === 'GET') {
          return ok(getVerificationProfile(query.get('userId') || 'usr_demo_seller'))
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          return ok(submitVerification(body))
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          return ok(reviewVerification(query.get('id'), body))
        }

        return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
      }

      return fail(404, 'api_route_not_found', '没有找到这个 API 路由。', { path })
    })
  },
}
