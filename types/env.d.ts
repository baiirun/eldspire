// app/types/env.d.ts
import type { D1Database } from '@cloudflare/workers-types'

declare module '@tanstack/solid-start' {
  interface Register {
    context: {
      cloudflare: {
        env: {
          DB: D1Database
        }
      }
    }
  }
}
