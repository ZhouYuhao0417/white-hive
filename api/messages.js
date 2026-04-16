import { getQuery, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { createMessage, listMessages } from './_lib/store.js'

export default {
  async fetch(request) {
    return withApiErrors(async () => {
      const query = getQuery(request)
      const orderId = query.get('orderId')

      if (request.method === 'GET') {
        return ok(listMessages(orderId))
      }

      if (request.method === 'POST') {
        const body = await readBody(request)
        return ok(createMessage(body))
      }

      return methodNotAllowed(request.method, ['GET', 'POST'])
    })
  },
}
