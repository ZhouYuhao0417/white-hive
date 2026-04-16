import { ok, methodNotAllowed, withApiErrors } from './_lib/http.js'
import { storeInfo } from './_lib/store.js'

export default {
  async fetch(request) {
    return withApiErrors(async () => {
      if (request.method !== 'GET') {
        return methodNotAllowed(request.method, ['GET'])
      }

      return ok({
        service: 'whitehive-api',
        status: 'ok',
        time: new Date().toISOString(),
        storage: storeInfo(),
      })
    })
  },
}
