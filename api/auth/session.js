import { methodNotAllowed, ok, readBody, withApiErrors } from '../_lib/http.js'
import { getDemoUser, upsertDemoSession } from '../_lib/store.js'

export default {
  async fetch(request) {
    return withApiErrors(async () => {
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
        const session = upsertDemoSession({
          email: body.email,
          mode: body.role || body.mode,
        })
        return ok(session)
      }

      return methodNotAllowed(request.method, ['GET', 'POST'])
    })
  },
}
