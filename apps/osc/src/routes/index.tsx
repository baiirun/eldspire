import { Link, createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div class="page-column home-page">
      <section class="page-intro home-intro">
        <p class="eyebrow">Restricted field manual</p>
        <h1>OSC</h1>
        <p class="dek">
          Secret bureau agents investigate, contain, conceal, and survive the
          impossible. The rules are simple. The job is not.
        </p>
      </section>

      <section class="home-actions">
        <Link class="file-card" to="/rules">
          <span class="file-number">01</span>
          <strong>Read the rules</strong>
          <span>Field procedures, pressure, panic, and containment.</span>
        </Link>
        <Link class="file-card" to="/generator">
          <span class="file-number">02</span>
          <strong>Generate an agent</strong>
          <span>Build a complete case-ready character from the table bank.</span>
        </Link>
      </section>
    </div>
  );
}
