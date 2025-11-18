import alchemy from "alchemy";
import { TanStackStart, D1Database } from "alchemy/cloudflare";

const app = await alchemy("eldspire");

// Create D1 database with migrations
const database = await D1Database("eldspire-db", {
  name: "eldspire-db",
  migrationsDir: "./migrations",
});

export const website = await TanStackStart("eldspire-site", {
  bindings: {
    DB: database
  }
});

console.log({
  url: website.url,
});

await app.finalize();
