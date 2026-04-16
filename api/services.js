import { getQuery, methodNotAllowed, ok, readBody, withApiErrors } from './_lib/http.js'
import { createService, getService, listServices } from './_lib/store.js'

export default {
  async fetch(request) {
    return withApiErrors(async () => {
      const query = getQuery(request)

      if (request.method === 'GET') {
        const id = query.get('id')
        if (id) {
          return ok(getService(id))
        }

        const category = query.get('category') || undefined
        const status = query.get('status') || 'published'
        return ok(listServices({ category, status }))
      }

      if (request.method === 'POST') {
        const body = await readBody(request)
        return ok(createService(body))
      }

      return methodNotAllowed(request.method, ['GET', 'POST'])
    })
  },
}
