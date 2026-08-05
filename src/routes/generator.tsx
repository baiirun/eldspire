import { createFileRoute } from "@tanstack/solid-router";
import {
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
  type JSX,
} from "solid-js";
import {
  characterFields,
  characterMarkdown,
  cryptoRandomIndex,
  drawTraits,
  generateCharacter,
  rerollField,
  type CharacterField,
  type GeneratedCharacter,
} from "@/lib/eldspire-generator";

export const Route = createFileRoute("/generator")({
  head: () => ({ meta: [{ title: "Character Generator | Eldspire" }] }),
  component: CharacterGenerator,
});

const fieldLabels: Record<CharacterField, string> = {
  background: "Background",
  archetype: "Archetype",
  hearthTie: "Hearth Tie",
  roadTie: "Road Tie",
  appearance: "Appearance",
  keepsake: "Keepsake",
  mundaneItem: "Mundane Item",
  comfort: "Comfort",
};

const textureFields = [
  "background",
  "appearance",
  "hearthTie",
  "roadTie",
  "keepsake",
  "mundaneItem",
  "comfort",
] as const satisfies readonly CharacterField[];

function CharacterGenerator() {
  const [character, setCharacter] = createSignal<GeneratedCharacter>();
  const [locked, setLocked] = createSignal<ReadonlySet<CharacterField | "traits">>(
    new Set(),
  );
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

  function reroll(field: CharacterField) {
    const current = character();
    if (current) setCharacter(rerollField(current, field));
  }

  function rerollTraits() {
    const current = character();
    if (current) setCharacter({ ...current, traits: drawTraits(cryptoRandomIndex) });
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown());
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy Markdown"), 900);
  }

  return (
    <main class="generator-page page-column">
      <header class="page-intro">
        <p class="eyebrow">Eldspire Expedition Rules</p>
        <h1>Character Generator</h1>
        <p class="dek">
          Roll, keep, and rewrite the fragments until they imply someone you want
          to follow into danger.
        </p>
      </header>

      <div class="command-bar" aria-label="Character generator controls">
        <button class="command-primary" type="button" onClick={generate}>
          Generate Character
        </button>
        <button type="button" onClick={() => setLocked(new Set())}>
          Unlock All
        </button>
        <button type="button" onClick={copyMarkdown} disabled={!character()}>
          {copyLabel()}
        </button>
      </div>

      <Show when={character()} fallback={<p>Rolling a traveler...</p>}>
        {(current) => (
          <article class="generated-character">
            <p class="character-summary">
              This traveler carries the background <strong>{current().background}</strong>{" "}
              and moves through the world as a{" "}
              <strong>{current().archetype.toLowerCase()}</strong>. They are{" "}
              <strong>{current().appearance.toLowerCase()}</strong>, remain tied to{" "}
              <strong>{current().hearthTie.toLowerCase()}</strong>, and trust{" "}
              <strong>{current().roadTie.toLowerCase()}</strong> on the road.
            </p>

            <GeneratorSection
              title="Archetype"
              actions={
                <FieldActions
                  label="Archetype"
                  locked={locked().has("archetype")}
                  onReroll={() => reroll("archetype")}
                  onLock={() => toggleLock("archetype")}
                />
              }
            >
              <div class="rated-line">
                <span>{current().archetype}</span>
                <strong>2</strong>
              </div>
            </GeneratorSection>

            <GeneratorSection
              title="Traits"
              actions={
                <FieldActions
                  label="Traits"
                  locked={locked().has("traits")}
                  onReroll={rerollTraits}
                  onLock={() => toggleLock("traits")}
                />
              }
            >
              <For each={current().traits}>
                {(trait) => (
                  <div class="rated-line">
                    <span>{trait.name}</span>
                    <strong>{trait.rating}</strong>
                  </div>
                )}
              </For>
            </GeneratorSection>

            <GeneratorSection title="Texture">
              <For each={textureFields}>
                {(field) => (
                  <div class="texture-line">
                    <div>
                      <span class="texture-label">{fieldLabels[field]}</span>
                      <span>{current()[field]}</span>
                    </div>
                    <FieldActions
                      label={fieldLabels[field]}
                      locked={locked().has(field)}
                      onReroll={() => reroll(field)}
                      onLock={() => toggleLock(field)}
                    />
                  </div>
                )}
              </For>
            </GeneratorSection>

            <GeneratorSection title="Starting Pressure">
              <div class="rated-line">
                <span>Current Fatigue</span>
                <strong>0</strong>
              </div>
            </GeneratorSection>

            <details class="markdown-disclosure">
              <summary>Markdown</summary>
              <textarea readonly value={markdown()} aria-label="Character markdown" />
            </details>
          </article>
        )}
      </Show>
    </main>
  );
}

function GeneratorSection(props: {
  title: string;
  actions?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section class="generator-section">
      <header>
        <h2>{props.title}</h2>
        {props.actions}
      </header>
      {props.children}
    </section>
  );
}

function FieldActions(props: {
  label: string;
  locked: boolean;
  onReroll: () => void;
  onLock: () => void;
}) {
  return (
    <span class="field-actions">
      <button type="button" onClick={props.onReroll}>
        Reroll <span class="sr-only">{props.label}</span>
      </button>
      <button
        type="button"
        classList={{ locked: props.locked }}
        onClick={props.onLock}
      >
        {props.locked ? "Unlock" : "Lock"}{" "}
        <span class="sr-only">{props.label}</span>
      </button>
    </span>
  );
}
