import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { env } from "cloudflare:workers";
import { parse } from "@/lib/markdown";
import { Markdown } from "@/lib/markdown-solid";
import { unslugify } from "@/lib/unslugify";

type Page = {
  id: number;
  name: string;
  content: string | null;
  updatedAt: number;
};

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }) => {
    const db = env.prod_d1_tutorial;
    const name = unslugify(params.slug);

    const page = await db
      .prepare("SELECT * FROM pages WHERE LOWER(name) = LOWER(?)")
      .bind(name)
      .first<Page>();

    return { page: page ?? null };
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
