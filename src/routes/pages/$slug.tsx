import { createFileRoute } from "@tanstack/solid-router";
import { createServerFn } from "@tanstack/solid-start";
import { Show } from "solid-js";
import { parse } from "@/lib/markdown";
import { Markdown } from "@/lib/markdown-solid";

type Page = {
  id: number;
  name: string;
  content: string | null;
  updatedAt: number;
};

const getPage = createServerFn({ method: "GET" })
  .inputValidator((slug: unknown) => slug as string)
  .handler(async ({ data: slug }) => {
    const { env } = await import("cloudflare:workers");
    const db = env.prod_d1_tutorial;

    // Convert slug back to name (e.g., "archmage-velorin" -> "Archmage Velorin")
    const name = slug
      .split("-")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const page = await db
      .prepare("SELECT * FROM pages WHERE LOWER(name) = LOWER(?)")
      .bind(name)
      .first<Page>();

    return { page: page ?? null };
  });

export const Route = createFileRoute("/pages/$slug")({
  loader: ({ params }) => getPage({ data: params.slug }),
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
