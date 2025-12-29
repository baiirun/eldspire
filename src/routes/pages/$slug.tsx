import { createFileRoute, Link } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { env } from "cloudflare:workers";
import { createResource, For, Show } from "solid-js";
import { InternalLink } from "@/components/InternalLink";
import { parse } from "@/lib/markdown";
import { Markdown } from "@/lib/markdown-solid";
import { unslugify } from "@/lib/unslugify";
import { getRequest } from "@tanstack/solid-start/server";

type RecentPage = {
  name: string;
};

const getRecentPages = createServerFn({ method: "GET" }).handler(async () => {
  const result = await env.DB.prepare(
    "SELECT name FROM pages ORDER BY updated_at DESC LIMIT 3"
  ).all<RecentPage>();

  return result.results;
});

type Page = {
  id: number;
  name: string;
  content: string | null;
  updatedAt: number;
  backlinks: string | null;
};

const getPage = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data }) => {

    const request = getRequest();
    const bookmark = request.headers.get('x-d1-bookmark') ?? 'first-unconstrained';
    const session = env.DB.withSession(bookmark)

    const name = unslugify(data);

    const maybePage = await session
      .prepare("SELECT id, name, content, updated_at as updatedAt, backlinks FROM pages WHERE LOWER(name) = LOWER(?)")
      .bind(name)
      .first<Page>();

    return { page: maybePage ?? null };
  });

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }) => {


    return await getPage({ data: params.slug })
  },
  component: PageView,
});

function PageView() {
  const data = Route.useLoaderData();

  return (
    <Show when={data().page} fallback={<PageNotFound />}>
      {(page) => <PageContent page={page()} />}
    </Show>
  );
}

function PageNotFound() {
  const [recentPages] = createResource(() => getRecentPages());

  return (
    <div class="space-y-4">
      <h1>Page Not Found</h1>
      <p>The page you're looking for doesn't exist. Try these links instead:</p>
      <ul class="list-disc pl-6 space-y-1">
        <li>
          <InternalLink to="/pages/$slug" params={{ slug: "adventure-log" }}>
            Adventure Log
          </InternalLink>
        </li>
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
      <p>
        <Link to="/">← Back to Home</Link>
      </p>
    </div>
  );
}

function PageContent(props: { page: Page }) {
  const parsed = () => parse(props.page.content ?? "");
  const backlinks = (): string[] => {
    if (!props.page.backlinks) return [];
    try {
      return JSON.parse(props.page.backlinks);
    } catch {
      return [];
    }
  };

  return (
    <article class="prose">
      <h1 class="mb-8"><Link to="/">{props.page.name}</Link></h1>
      <Markdown content={parsed()} config={{ wikiLinkBasePath: "/pages" }} />
      <p class="mt-8 text-sm text-gray-500">
        Last updated: {new Date(props.page.updatedAt * 1000).toLocaleDateString()}
      </p>
      <Show when={backlinks().length > 0}>
        <section class="mt-8 pt-4 border-t border-gray-200">
          <h2 class="text-base mb-2">Related pages</h2>
          <ul class="list-none p-0 space-y-1">
            <For each={backlinks()}>
              {(name) => (
                <li>
                  <InternalLink to={`/pages/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}`}>
                    {name}
                  </InternalLink>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </article>
  );
}
