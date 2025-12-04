import { createFileRoute } from "@tanstack/solid-router";
import { env } from "cloudflare:workers";

interface PageInput {
  name: string;
  content: string;
  links: string[];
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
        const existingPages = await env.prod_d1_tutorial
          .prepare(`SELECT id, LOWER(name) as name FROM pages WHERE LOWER(name) IN (${placeholders})`)
          .bind(...validPages.map((p) => p.name))
          .all<{ id: number; name: string }>();

        const existingMap = new Map(existingPages.results.map((p) => [p.name, p.id]));

        // Build batch statements
        const statements: D1PreparedStatement[] = [];

        for (const page of validPages) {
          const existingId = existingMap.get(page.name.toLowerCase());

          if (existingId) {
            statements.push(
              env.prod_d1_tutorial
                .prepare("UPDATE pages SET content = ?, updated_at = ? WHERE id = ?")
                .bind(page.content ?? null, now, existingId)
            );
            result.updated++;
          } else {
            statements.push(
              env.prod_d1_tutorial
                .prepare("INSERT INTO pages (name, content, updated_at) VALUES (?, ?, ?)")
                .bind(page.name, page.content ?? null, now)
            );
            result.created++;
          }
        }

        // Execute all statements in a single batch
        await env.prod_d1_tutorial.batch(statements);

        // Calculate backlinks: build a map of target -> [source pages]
        const backlinksMap = new Map<string, Set<string>>();
        for (const page of validPages) {
          for (const link of page.links ?? []) {
            const target = link.toLowerCase();
            if (!backlinksMap.has(target)) {
              backlinksMap.set(target, new Set());
            }
            backlinksMap.get(target)!.add(page.name);
          }
        }

        // Update backlinks for each target page
        const backlinkStatements: D1PreparedStatement[] = [];
        for (const [target, sources] of backlinksMap) {
          const backlinksJson = JSON.stringify(Array.from(sources));
          backlinkStatements.push(
            env.prod_d1_tutorial
              .prepare("UPDATE pages SET backlinks = ? WHERE LOWER(name) = ?")
              .bind(backlinksJson, target)
          );
        }

        if (backlinkStatements.length > 0) {
          await env.prod_d1_tutorial.batch(backlinkStatements);
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
