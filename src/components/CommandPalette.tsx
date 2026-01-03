import { createSignal, createEffect, createResource, For, Show } from "solid-js";
import { createServerFn } from "@tanstack/solid-start";
import { useNavigate, Link } from "@tanstack/solid-router";
import { env } from "cloudflare:workers";

type SearchResult = {
  name: string;
};

const searchPages = createServerFn({ method: "GET" })
  .inputValidator((query: string) => query)
  .handler(async ({ data }) => {
    if (!data.trim()) return [];

    const result = await env.DB.prepare(
      "SELECT name FROM pages WHERE name LIKE '%' || ?1 || '%' ORDER BY name LIMIT 10"
    ).bind(data).all<SearchResult>();

    return result.results;
  });

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = createSignal("");
  const [debouncedQuery, setDebouncedQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const navigate = useNavigate();
  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const [results] = createResource(debouncedQuery, async (q) => {
    if (!q.trim()) return [];
    const data = await searchPages({ data: q });
    setSelectedIndex(0);
    return data;
  });

  const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

  const navigateToPage = (name: string) => {
    props.onClose();
    navigate({ to: "/pages/$slug", params: { slug: toSlug(name) } });
  };

  createEffect(() => {
    if (props.open) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  createEffect(() => {
    const q = query();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q.trim()) {
      setDebouncedQuery("");
      return;
    }

    debounceTimer = setTimeout(() => {
      setDebouncedQuery(q);
    }, 300);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const len = results()?.length ?? 0;

    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      if (len > 0) {
        if (e.shiftKey) {
          setSelectedIndex((i) => (i - 1 + len) % len);
        } else {
          setSelectedIndex((i) => (i + 1) % len);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (len > 0) setSelectedIndex((i) => (i + 1) % len);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (len > 0) setSelectedIndex((i) => (i - 1 + len) % len);
    } else if (e.key === "Enter" && len > 0) {
      e.preventDefault();
      const selected = results()?.[selectedIndex()];
      if (selected) navigateToPage(selected.name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh]"
        onClick={handleBackdropClick}
      >
        <div class="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages..."
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            class="w-full px-4 py-3 text-lg border-b border-stone-200 outline-none"
          />
          <Show when={(results()?.length ?? 0) > 0}>
            <ul class="max-h-80 overflow-y-auto">
              <For each={results()}>
                {(result, index) => (
                  <li
                    class={`cursor-pointer ${
                      index() === selectedIndex()
                        ? "bg-stone-100"
                        : "hover:bg-stone-50"
                    }`}
                  >
                    <Link
                      to="/pages/$slug"
                      params={{ slug: toSlug(result.name) }}
                      preload="viewport"
                      class="block px-4 py-2"
                      tabIndex={-1}
                      onClick={() => props.onClose()}
                    >
                      {result.name}
                    </Link>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={debouncedQuery() && results()?.length === 0 && !results.loading}>
            <div class="px-4 py-3 text-stone-500">No pages found</div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
