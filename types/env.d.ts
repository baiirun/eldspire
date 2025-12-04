import type { D1Database } from '@cloudflare/workers-types'

declare module '@tanstack/solid-start' {
  interface Register {
    context: {
      cloudflare: {
        prod_d1_tutorial: D1Database
      }
    }
  }
}
