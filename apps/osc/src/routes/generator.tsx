import { createFileRoute } from "@tanstack/solid-router";
import {
  For,
  Show,
  createMemo,
  createSignal,
  onMount,
  type JSX,
} from "solid-js";
import {
  characterFields,
  characterMarkdown,
  generateCharacter,
  type CharacterField,
  type GeneratedCharacter,
} from "@/lib/osc-generator";

export const Route = createFileRoute("/generator")({
  head: () => ({ meta: [{ title: "Character Generator | OSC" }] }),
  component: CharacterGenerator,
});

const fieldLabels: Record<CharacterField, string> = {
  background: "Background",
  practice: "Professional Practice",
  relationship: "Relationship",
  appearance: "Appearance",
  vice: "Vice",
  haven: "Haven",
  nostalgicObject: "Nostalgic Object",
  normalTrinket: "Normal Trinket",
  weirdTrinket: "Optional Weird Trinket",
};

const ratedFields = ["practice", "relationship"] as const;
const ratings = { practice: 2, relationship: 2 } as const;
const textureFields = [
  "background",
  "appearance",
  "vice",
  "haven",
  "nostalgicObject",
  "normalTrinket",
  "weirdTrinket",
] as const;

function CharacterGenerator() {
  const [character, setCharacter] = createSignal<GeneratedCharacter>();
  const [locked, setLocked] = createSignal<ReadonlySet<CharacterField | "traits">>(new Set());
  const [copyLabel, setCopyLabel] = createSignal("Copy Markdown");

  onMount(() => setCharacter(generateCharacter()));

  const markdown = createMemo(() => {
    const current = character();
    return current ? characterMarkdown(current) : "";
  });

  function generate() {
    const previous = character();
    const next = generateCharacter();
    const protectedFields = locked();

    if (previous) {
      for (const field of characterFields) {
        if (protectedFields.has(field)) {
          next[field] = previous[field];
          next.rolls[field] = previous.rolls[field];
        }
      }
      if (protectedFields.has("traits")) next.traits = previous.traits;
    }

    setCharacter(next);
  }

  function toggleLock(field: CharacterField | "traits") {
    setLocked((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown());
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy Markdown"), 900);
  }

  return (
    <div class="generator-page page-column">
      <header class="page-intro">
        <h1>Character generator</h1>
        <p>Generate a character. Select rows to lock them before generating again.</p>
      </header>

      <div class="command-bar" aria-label="Character generator controls">
        <button class="command-primary" type="button" onClick={generate}>Generate Agent</button>
        <button type="button" onClick={copyMarkdown} disabled={!character()}>{copyLabel()}</button>
      </div>

      <Show when={character()} fallback={<p>Opening personnel file…</p>}>
        {(current) => (
          <article class="generated-character">
            <GeneratorSection title="Rated Character Features">
              <For each={ratedFields}>{(field) => (
                <FieldRow
                  label={fieldLabels[field]}
                  value={current()[field]}
                  rating={ratings[field]}
                  roll={current().rolls[field]}
                  locked={locked().has(field)}
                  onToggleLock={() => toggleLock(field)}
                />
              )}</For>
            </GeneratorSection>

            <GeneratorSection title="Traits">
              <button
                class="field-row traits-row"
                classList={{ locked: locked().has("traits") }}
                type="button"
                aria-label={`${locked().has("traits") ? "Unlock" : "Lock"} Traits`}
                aria-pressed={locked().has("traits")}
                onClick={() => toggleLock("traits")}
              >
                <span class="traits-list">
                  <For each={current().traits}>{(trait) => (
                    <span class="rated-line trait-line"><span>{trait.name}</span><strong>{trait.rating}</strong></span>
                  )}</For>
                </span>
                <LockIcon locked={locked().has("traits")} />
              </button>
            </GeneratorSection>

            <GeneratorSection title="Character Texture">
              <For each={textureFields}>{(field) => (
                <FieldRow
                  label={fieldLabels[field]}
                  value={current()[field]}
                  roll={current().rolls[field]}
                  locked={locked().has(field)}
                  onToggleLock={() => toggleLock(field)}
                />
              )}</For>
            </GeneratorSection>

            <GeneratorSection title="Pressure">
              <div class="rated-line"><span>Current Stress / Stress Floor</span><strong>0 / 0</strong></div>
              <div class="texture-line"><div><span class="texture-label">Conditions</span><span>None</span></div></div>
            </GeneratorSection>

            <details class="markdown-disclosure">
              <summary>Markdown character sheet</summary>
              <textarea readonly value={markdown()} aria-label="Character Markdown" />
            </details>
          </article>
        )}
      </Show>
    </div>
  );
}

function GeneratorSection(props: { title: string; children: JSX.Element }) {
  return (
    <section class="generator-section">
      <header><h2>{props.title}</h2></header>
      {props.children}
    </section>
  );
}

function FieldRow(props: {
  label: string;
  value: string;
  rating?: number;
  roll: number;
  locked: boolean;
  onToggleLock: () => void;
}) {
  return (
    <button
      class="field-row"
      classList={{ locked: props.locked }}
      type="button"
      aria-label={`${props.locked ? "Unlock" : "Lock"} ${props.label}`}
      aria-pressed={props.locked}
      onClick={props.onToggleLock}
    >
      <span class="field-copy">
        <span class="texture-label">{props.label} · {String(props.roll).padStart(2, "0")}</span>
        <span>{props.value}</span>
      </span>
      {props.rating && <strong class="field-rating">{props.rating}</strong>}
      <LockIcon locked={props.locked} />
    </button>
  );
}

function LockIcon(props: { locked: boolean }) {
  return (
    <span class="lock-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="7" width="10" height="7" rx="1" />
        <Show
          when={props.locked}
          fallback={<path d="M6 7V5a3 3 0 0 1 5.7-1.3" />}
        >
          <path d="M5 7V5a3 3 0 0 1 6 0v2" />
        </Show>
      </svg>
    </span>
  );
}
