import * as Solid from "solid-js";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";

import appCss from "../styles.css?url";

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
  return (
    <RootDocument>
      <Outlet />
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
