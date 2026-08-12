# OSC

The OSC rules and character generator deployed at `osc.eldspire.com`.

```bash
bun install
bun run import:vault
bun run dev
bun run test
bun run build
```

`import:vault` refreshes the committed rules and character tables from their canonical Zaum notes. Set `OSC_VAULT_PATH` when the vault is not in its default local location.
