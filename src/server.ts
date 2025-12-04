import type { D1Database } from '@cloudflare/workers-types'
import handler, { createServerEntry } from '@tanstack/solid-start/server-entry'

interface CloudflareEnv {
  prod_d1_tutorial: D1Database
}

declare module '@tanstack/solid-start' {
  interface Register {
    server: {
      requestContext: {
        cloudflare: CloudflareEnv
      }
    }
  }
}

export default createServerEntry({
  fetch(request, ctx) {
    return handler.fetch(request, {
      context: {
        ...ctx,
        cloudflare:
          (ctx as { cloudflare?: { env: CloudflareEnv } }).cloudflare?.env || {} as CloudflareEnv
      }
    })
  }
})
