import * as Solid from "solid-js";
import { createSignal, onMount, onCleanup, For, createResource } from "solid-js";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";
import { createServerFn } from "@tanstack/solid-start";
import { env } from "cloudflare:workers";

import appCss from "../styles.css?url";
import { CommandPalette } from "@/components/CommandPalette";
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

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Eldspire",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
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

function RootComponent() {
  const [paletteOpen, setPaletteOpen] = createSignal(false);

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <RootDocument>
      <Outlet />
      <CommandPalette open={paletteOpen()} onClose={() => setPaletteOpen(false)} />
    </RootDocument>
  );
}

function RootDocument(props: { children: Solid.JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        <div class="layout">
          <Solid.Suspense>{props.children}</Solid.Suspense>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
