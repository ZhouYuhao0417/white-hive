import { getQuery, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { createOrder, getOrder, listOrders, updateOrder } from './_lib/store.js'

export default {
  async fetch(request) {
    return withApiErrors(async () => {
      const query = getQuery(request)
      const id = query.get('id')

      if (request.method === 'GET') {
        if (id) {
          return ok(getOrder(id))
        }

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
        return ok(updateOrder(id, body))
      }

      return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
    })
  },
}
