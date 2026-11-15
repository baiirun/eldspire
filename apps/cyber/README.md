# Cyberspire

The Cyberspire character generator deployed at `cyber.eldspire.com`.

```bash
bun install
bun run dev
bun run test
bun run build
```

The character tables live in `src/content/cyberspire-character-tables.md`. Every table except Actions is a d100 table.

## Deployment

Changes under `apps/cyber` on `master` are built and deployed to `cyber.eldspire.com` by Cloudflare Workers Builds.
