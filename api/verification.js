import { getQuery, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { getVerificationProfile, reviewVerification, submitVerification } from './_lib/store.js'

export default {
  async fetch(request) {
    return withApiErrors(async () => {
      const query = getQuery(request)

      if (request.method === 'GET') {
        return ok(getVerificationProfile(query.get('userId') || 'usr_demo_seller'))
      }

      if (request.method === 'POST') {
        const body = await readBody(request)
        return ok(submitVerification(body))
      }

      if (request.method === 'PATCH') {
        const id = query.get('id')
        const body = await readBody(request)
        return ok(reviewVerification(id, body))
      }

      return methodNotAllowed(request.method, ['GET', 'POST', 'PATCH'])
    })
  },
}
