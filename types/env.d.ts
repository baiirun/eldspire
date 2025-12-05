import type { D1Database } from '@cloudflare/workers-types'

declare module '@tanstack/solid-start' {
  interface Register {
    context: {
      cloudflare: {
        DB: D1Database
      }
    }
  }
}
