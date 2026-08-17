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
  cryptoRandomIndex,
  drawTraits,
  generateCharacter,
  rerollField,
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
  complication: "Complication",
  firstBrush: "First Brush With The Impossible",
};

const ratedFields = ["practice", "relationship"] as const;
const ratings = { practice: 2, relationship: 2 } as const;
const textureFields = [
  "appearance",
  "vice",
  "haven",
  "nostalgicObject",
  "normalTrinket",
  "weirdTrinket",
] as const;
const caseFields = ["complication", "firstBrush"] as const;

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
    <div class="generator-page page-column">
      <header class="page-intro">
        <p class="eyebrow">Personnel intake · Form OSC-17</p>
        <h1>Generate an agent</h1>
        <p class="dek">Roll a complete field agent, then lock and reroll details until the file tells a story.</p>
      </header>

      <div class="command-bar" aria-label="Character generator controls">
        <button class="command-primary" type="button" onClick={generate}>Generate Agent</button>
        <button type="button" onClick={() => setLocked(new Set())}>Unlock All</button>
        <button type="button" onClick={copyMarkdown} disabled={!character()}>{copyLabel()}</button>
      </div>

      <Show when={character()} fallback={<p>Opening personnel file…</p>}>
        {(current) => (
          <article class="generated-character">
            <p class="character-summary">
              A <strong>{current().practice.toLowerCase()}</strong> shaped by <strong>{current().background.toLowerCase()}</strong>, still answerable to <strong>{current().relationship.toLowerCase()}</strong>.
            </p>

            <GeneratorSection title="Background">
              <FieldRow
                label={fieldLabels.background}
                value={current().background}
                roll={current().rolls.background}
                locked={locked().has("background")}
                onReroll={() => reroll("background")}
                onLock={() => toggleLock("background")}
              />
            </GeneratorSection>

            <GeneratorSection title="Rated Character Features">
              <For each={ratedFields}>{(field) => (
                <FieldRow
                  label={fieldLabels[field]}
                  value={current()[field]}
                  rating={ratings[field]}
                  roll={current().rolls[field]}
                  locked={locked().has(field)}
                  onReroll={() => reroll(field)}
                  onLock={() => toggleLock(field)}
                />
              )}</For>
            </GeneratorSection>

            <GeneratorSection title="Traits" actions={
              <FieldActions label="Traits" locked={locked().has("traits")} onReroll={rerollTraits} onLock={() => toggleLock("traits")} />
            }>
              <For each={current().traits}>{(trait) => (
                <div class="rated-line"><span>{trait.name}</span><strong>{trait.rating}</strong></div>
              )}</For>
            </GeneratorSection>

            <GeneratorSection title="Character Texture">
              <For each={textureFields}>{(field) => (
                <FieldRow
                  label={fieldLabels[field]}
                  value={current()[field]}
                  roll={current().rolls[field]}
                  locked={locked().has(field)}
                  onReroll={() => reroll(field)}
                  onLock={() => toggleLock(field)}
                />
              )}</For>
            </GeneratorSection>

            <GeneratorSection title="Case File">
              <For each={caseFields}>{(field) => (
                <FieldRow
                  label={fieldLabels[field]}
                  value={current()[field]}
                  roll={current().rolls[field]}
                  locked={locked().has(field)}
                  onReroll={() => reroll(field)}
                  onLock={() => toggleLock(field)}
                />
              )}</For>
            </GeneratorSection>

            <GeneratorSection title="Pressure">
              <div class="rated-line"><span>Current Stress / Stress Floor</span><strong>0 / 0</strong></div>
              <div class="texture-line"><div><span class="texture-label">Conditions</span><span>None</span></div></div>
            </GeneratorSection>

            <details class="markdown-disclosure">
              <summary>Markdown case file</summary>
              <textarea readonly value={markdown()} aria-label="Character Markdown" />
            </details>
          </article>
        )}
      </Show>
    </div>
  );
}

function GeneratorSection(props: { title: string; actions?: JSX.Element; children: JSX.Element }) {
  return (
    <section class="generator-section">
      <header><h2>{props.title}</h2>{props.actions}</header>
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
  onReroll: () => void;
  onLock: () => void;
}) {
  return (
    <div class="texture-line">
      <div>
        <span class="texture-label">{props.label} · {String(props.roll).padStart(2, "0")}</span>
        <span>{props.value}</span>
      </div>
      {props.rating && <strong class="field-rating">{props.rating}</strong>}
      <FieldActions {...props} />
    </div>
  );
}

function FieldActions(props: { label: string; locked: boolean; onReroll: () => void; onLock: () => void }) {
  return (
    <span class="field-actions">
      <button type="button" onClick={props.onReroll}>Reroll <span class="sr-only">{props.label}</span></button>
      <button classList={{ locked: props.locked }} type="button" onClick={props.onLock} aria-pressed={props.locked}>
        {props.locked ? "Locked" : "Lock"} <span class="sr-only">{props.label}</span>
      </button>
    </span>
  );
}
