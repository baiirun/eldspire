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
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <section class="page-column page-intro">
      <p class="eyebrow">File not found</p>
      <h1>Redacted</h1>
      <p>The requested record does not exist or your clearance is insufficient.</p>
      <p><Link to="/">Return to headquarters</Link></p>
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
          <footer class="site-footer">OSC · Eyes Only</footer>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
