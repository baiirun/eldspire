import { createFileRoute } from "@tanstack/solid-router";
import { env } from "cloudflare:workers";

interface PageInput {
  name: string;
  content: string;
}

interface SyncRequest {
  pages: PageInput[];
}

interface SyncResult {
  created: number;
  updated: number;
  errors: string[];
}

export const Route = createFileRoute("/api/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: SyncRequest;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!Array.isArray(body.pages)) {
          return new Response(JSON.stringify({ error: "pages must be an array" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const result: SyncResult = { created: 0, updated: 0, errors: [] };
        const now = Math.floor(Date.now() / 1000);

        for (const page of body.pages) {
          if (!page.name || typeof page.name !== "string") {
            result.errors.push("Page missing name");
            continue;
          }

          try {
            const existing = await env.prod_d1_tutorial
              .prepare("SELECT id FROM pages WHERE LOWER(name) = LOWER(?)")
              .bind(page.name)
              .first<{ id: number }>();

            if (existing) {
              await env.prod_d1_tutorial
                .prepare("UPDATE pages SET content = ?, updated_at = ? WHERE id = ?")
                .bind(page.content ?? null, now, existing.id)
                .run();
              result.updated++;
            } else {
              await env.prod_d1_tutorial
                .prepare("INSERT INTO pages (name, content, updated_at) VALUES (?, ?, ?)")
                .bind(page.name, page.content ?? null, now)
                .run();
              result.created++;
            }
          } catch (error) {
            result.errors.push(`Failed to sync "${page.name}": ${error}`);
          }
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
