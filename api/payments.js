import { getQuery, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { createPayment, getPayment, listPayments } from './_lib/store.js'

export default {
  async fetch(request) {
    return withApiErrors(async () => {
      const query = getQuery(request)
      const id = query.get('id')

      if (request.method === 'GET') {
        if (id) {
          return ok(getPayment(id))
        }

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
    })
  },
}
