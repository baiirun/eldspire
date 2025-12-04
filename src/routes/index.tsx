import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div class="space-y-6">
      <section class="space-y-2">
        <h1 class="mb-8">
          I. <span class="ml-4">Frame</span>
        </h1>
        <p>
          Cultures clash in mystical lands as explorers, adventurers, and
          colonial powers seek fame and fortune in a world haunted by the shadow
          of a fallen civilization.
        </p>
      </section>

      <section class="space-y-2">
        <h2>Wiki Pages</h2>
        <ul class="list-disc pl-6 space-y-1">
          <li>
            <Link to="/pages/$slug" params={{ slug: "eldspire" }} preload="viewport" class="underline">
              Eldspire
            </Link>{" "}
            - The towering capital city
          </li>
          <li>
            <Link to="/pages/$slug" params={{ slug: "verdant-kingdom" }} preload="viewport" class="underline">
              Verdant Kingdom
            </Link>{" "}
            - A prosperous nation of lush forests
          </li>
          <li>
            <Link to="/pages/$slug" params={{ slug: "archmage-velorin" }} preload="viewport" class="underline">
              Archmage Velorin
            </Link>{" "}
            - Legendary founder of Eldspire
          </li>
        </ul>
      </section>
    </div>
  );
}
