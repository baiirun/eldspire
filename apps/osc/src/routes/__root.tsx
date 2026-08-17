import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OSC" },
      {
        name: "description",
        content:
          "Rules and character generator for secret bureau agents confronting the impossible.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <section class="page-column page-intro">
      <h1>Page not found</h1>
      <p><Link to="/">Return home</Link></p>
    </section>
  ),
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        <div class="site-shell">
          <header class="site-header">
            <Link class="site-name" to="/">OSC</Link>
            <nav class="site-nav" aria-label="Primary navigation">
              <Link to="/rules">Rules</Link>
              <Link to="/generator">Character Generator</Link>
            </nav>
          </header>
          <main class="site-main"><Outlet /></main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
