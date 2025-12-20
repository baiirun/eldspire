import { createSignal, createEffect, For, Show } from "solid-js";
import { createServerFn } from "@tanstack/solid-start";
import { useNavigate } from "@tanstack/solid-router";
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
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const navigate = useNavigate();
  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

  const navigateToPage = (name: string) => {
    props.onClose();
    navigate({ to: "/pages/$slug", params: { slug: toSlug(name) } });
  };

  createEffect(() => {
    if (props.open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  createEffect(() => {
    const q = query();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q.trim()) {
      setResults([]);
      return;
    }

    debounceTimer = setTimeout(async () => {
      const data = await searchPages({ data: q });
      setResults(data);
      setSelectedIndex(0);
    }, 300);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const len = results().length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(len, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + Math.max(len, 1)) % Math.max(len, 1));
    } else if (e.key === "Enter" && len > 0) {
      e.preventDefault();
      const selected = results()[selectedIndex()];
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
          <Show when={results().length > 0}>
            <ul class="max-h-80 overflow-y-auto">
              <For each={results()}>
                {(result, index) => (
                  <li
                    class={`px-4 py-2 cursor-pointer ${
                      index() === selectedIndex()
                        ? "bg-stone-100"
                        : "hover:bg-stone-50"
                    }`}
                    onClick={() => navigateToPage(result.name)}
                  >
                    {result.name}
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={query().trim() && results().length === 0}>
            <div class="px-4 py-3 text-stone-500">No pages found</div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
