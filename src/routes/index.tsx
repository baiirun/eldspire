import { createFileRoute } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { env } from "cloudflare:workers";
import { For } from "solid-js";
import { InternalLink } from "@/components/InternalLink";

type RecentPage = {
  name: string;
};

const getRecentPages = createServerFn({ method: "GET" }).handler(async () => {
  const result = await env.DB.prepare(
    "SELECT name FROM pages ORDER BY updated_at DESC LIMIT 3"
  ).all<RecentPage>();

  return result.results;
});

export const Route = createFileRoute("/")({
  loader: async () => await getRecentPages(),
  component: App,
});

function App() {
  const recentPages = Route.useLoaderData();

  return (
    <div class="space-y-6">
      <section class="space-y-2">
        <h1 class="mb-8">
          I. <span class="ml-4">Frame</span>
        </h1>
        <p>
          Cultures clash in mystical lands as explorers, adventurers, and
          colonial powers seek fame and fortune in a world haunted by the shadow
          of a fallen civilization.
        </p>
      </section>

      <section class="space-y-2">
        <h2>Characters</h2>
        <ul class="list-disc pl-6 space-y-1">
          <li>
            <InternalLink to="/pages/$slug" params={{ slug: "thaniel-cottonwood" }}>
              Thaniel Cottonwood
            </InternalLink>
          </li>
          <li>
            <InternalLink to="/pages/$slug" params={{ slug: "tharn" }}>
              Tharn
            </InternalLink>
          </li>
          <li>
            <InternalLink to="/pages/$slug" params={{ slug: "eli" }}>
              Eli
            </InternalLink>
          </li>
          <li>
            <InternalLink to="/pages/$slug" params={{ slug: "tirolas" }}>
              Tirolas
            </InternalLink>
          </li>
          <li>
            <InternalLink to="/pages/$slug" params={{ slug: "reverend-mother" }}>
              Reverend Mother
            </InternalLink>
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2>Adventure Log</h2>
        <InternalLink to="/pages/$slug" params={{ slug: "adventure-log" }}>
          Adventure Log
        </InternalLink>
      </section>

      <section class="space-y-2">
        <h2>Wiki Pages</h2>
        <ul class="list-disc pl-6 space-y-1">
          <For each={recentPages()}>
            {(page) => (
              <li>
                <InternalLink
                  to="/pages/$slug"
                  params={{ slug: page.name.toLowerCase().replace(/\s+/g, "-") }}
                >
                  {page.name}
                </InternalLink>
              </li>
            )}
          </For>
        </ul>
      </section>
    </div>
  );
}
