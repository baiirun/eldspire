import { createFileRoute } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { env } from "cloudflare:workers";
import { Show } from "solid-js";
import { parse } from "@/lib/markdown";
import { Markdown } from "@/lib/markdown-solid";
import { unslugify } from "@/lib/unslugify";
import { getRequest } from "@tanstack/solid-start/server";

type Page = {
  id: number;
  name: string;
  content: string | null;
  updatedAt: number;
};

const getPage = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data }) => {

    const request = getRequest();
    const bookmark = request.headers.get('x-d1-bookmark') ?? 'first-unconstrained';
    const session = env.prod_d1_tutorial.withSession(bookmark)

    const name = unslugify(data);

    const maybePage = await session
      .prepare("SELECT id, name, content, updated_at as updatedAt FROM pages WHERE LOWER(name) = LOWER(?)")
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
    <Show
      when={data().page}
      fallback={
        <div class="space-y-4">
          <h1>Page Not Found</h1>
          <p>The page you're looking for doesn't exist yet.</p>
        </div>
      }
    >
      {(page) => <PageContent page={page()} />}
    </Show>
  );
}

function PageContent(props: { page: Page }) {
  const parsed = () => parse(props.page.content ?? "");

  return (
    <article class="prose">
      <Markdown content={parsed()} config={{ wikiLinkBasePath: "/pages" }} />
      <footer class="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-500">
        Last updated: {new Date(props.page.updatedAt * 1000).toLocaleDateString()}
      </footer>
    </article>
  );
}
