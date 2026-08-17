import { Link, createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div class="page-column home-page">
      <section class="page-intro home-intro">
        <h1>Rules and character generator</h1>
      </section>

      <nav class="home-actions" aria-label="OSC resources">
        <Link to="/rules">Rules</Link>
        <Link to="/generator">Character generator</Link>
      </nav>
    </div>
  );
}
