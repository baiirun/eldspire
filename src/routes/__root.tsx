import * as Solid from "solid-js";
import { createSignal, onMount, onCleanup } from "solid-js";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";

import appCss from "../styles.css?url";
import { CommandPalette } from "@/components/CommandPalette";

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
});

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
