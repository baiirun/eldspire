import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  resolve: {
    conditions: ["browser", "development"],
    alias: {
      "cloudflare:workers": new URL("./src/test/cloudflare-workers.ts", import.meta.url).pathname,
    },
  },
  plugins: [
    solid({ ssr: false }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
