import { createFileRoute } from "@tanstack/solid-router";
import { env } from "cloudflare:workers";

interface PageInput {
  name: string;
  content: string;
  links: string[];
  backlinks: string[];
  updatedAt: number; // Unix timestamp (seconds)
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

        // Filter valid pages
        const validPages = body.pages.filter((page) => {
          if (!page.name || typeof page.name !== "string") {
            result.errors.push("Page missing name");
            return false;
          }
          return true;
        });

        if (validPages.length === 0) {
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Check which pages exist in a single query
        const placeholders = validPages.map(() => "LOWER(?)").join(", ");
        const existingPages = await env.DB
          .prepare(`SELECT id, LOWER(name) as name FROM pages WHERE LOWER(name) IN (${placeholders})`)
          .bind(...validPages.map((p) => p.name))
          .all<{ id: number; name: string }>();

        const existingMap = new Map(existingPages.results.map((p) => [p.name, p.id]));

        // Build batch statements
        const statements: D1PreparedStatement[] = [];

        for (const page of validPages) {
          const existingId = existingMap.get(page.name.toLowerCase());
          const backlinksJson = JSON.stringify(page.backlinks ?? []);

          if (existingId) {
            statements.push(
              env.DB
                .prepare("UPDATE pages SET content = ?, backlinks = ?, updated_at = ? WHERE id = ?")
                .bind(page.content ?? null, backlinksJson, page.updatedAt, existingId)
            );
            result.updated++;
          } else {
            statements.push(
              env.DB
                .prepare("INSERT INTO pages (name, content, backlinks, updated_at) VALUES (?, ?, ?, ?)")
                .bind(page.name, page.content ?? null, backlinksJson, page.updatedAt)
            );
            result.created++;
          }
        }

        // Execute all statements in a single batch
        await env.DB.batch(statements);

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
