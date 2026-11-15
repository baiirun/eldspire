import { createFileRoute } from "@tanstack/solid-router";
import { For, Show, createMemo, createSignal, onMount, type JSX } from "solid-js";
import {
  characterFields,
  characterMarkdown,
  debtDie,
  generateCharacter,
  phrase,
  placeholderActions,
  rerollField,
  type CharacterField,
  type GeneratedCharacter,
  type RatedEntry,
} from "@/lib/cyberspire-generator";

export const Route = createFileRoute("/")({
  component: CharacterGenerator,
});

function CharacterGenerator() {
  const [character, setCharacter] = createSignal<GeneratedCharacter>();
  const [locked, setLocked] = createSignal<ReadonlySet<CharacterField>>(new Set());
  const [copyLabel, setCopyLabel] = createSignal("Copy Markdown");
  let markdownDetails: HTMLDetailsElement | undefined;
  let markdownArea: HTMLTextAreaElement | undefined;

  onMount(() => setCharacter(generateCharacter()));

  const markdown = createMemo(() => {
    const current = character();
    return current ? characterMarkdown(current) : "";
  });

  function generate() {
    const previous = character();
    const next = generateCharacter();
    if (previous) {
      for (const field of characterFields) {
        if (locked().has(field)) (next as Record<CharacterField, unknown>)[field] = previous[field];
      }
    }
    setCharacter(next);
  }

  function reroll(field: CharacterField) {
    const current = character();
    if (current) setCharacter(rerollField(current, field));
  }

  function toggleLock(field: CharacterField) {
    setLocked((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown());
      setCopyLabel("Copied");
    } catch {
      if (markdownDetails) markdownDetails.open = true;
      markdownArea?.focus();
      markdownArea?.select();
      setCopyLabel("Selected");
    }
    window.setTimeout(() => setCopyLabel("Copy Markdown"), 900);
  }

  const controls = (field: CharacterField, label: string) => (
    <FieldControls
      label={label}
      locked={locked().has(field)}
      onReroll={() => reroll(field)}
      onToggleLock={() => toggleLock(field)}
    />
  );

  return (
    <div class="generator-page">
      <header class="page-intro">
        <p class="eyebrow">Cyberspire · Playtest Draft</p>
        <h1>Character Generator</h1>
        <p class="dek">
          Roll, keep, and rewrite the fragments until they imply someone you want to follow through the city.
        </p>
      </header>

      <div class="command-bar" aria-label="Character generator controls">
        <button class="command-primary" type="button" onClick={generate}>Generate Character</button>
        <button type="button" onClick={() => setLocked(new Set<CharacterField>())}>Unlock All</button>
        <button type="button" onClick={copyMarkdown} disabled={!character()}>{copyLabel()}</button>
      </div>

      <Show when={character()} fallback={<p>Rolling…</p>}>
        {(c) => (
          <article class="generated-character">
            <p class="character-summary">
              This survivor carries the background <strong>{c().background}</strong> and comes home to{" "}
              <strong>{phrase(c().haven)}</strong>. They remain tied to{" "}
              <strong>{phrase(c().bonds[0].name)}</strong> and <strong>{phrase(c().bonds[1].name)}</strong>,
              and owe <strong>{phrase(c().debt)}</strong>.
            </p>

            <Section title="Character">
              <TextureLine label="Background" value={c().background} controls={controls("background", "Background")} />
            </Section>

            <Section title="Actions" controls={controls("actions", "Actions")}>
              <For each={c().actions}>{(action) => (
                <RatedLine
                  entry={action}
                  note={placeholderActions.has(action.name) ? "(Eldspire name, placeholder)" : undefined}
                />
              )}</For>
            </Section>

            <Section title="Traits" controls={controls("traits", "Traits")}>
              <For each={c().traits}>{(trait) => <RatedLine entry={trait} />}</For>
            </Section>

            <Section title="Bonds" controls={controls("bonds", "Bonds")}>
              <For each={c().bonds}>{(bond) => <RatedLine entry={bond} />}</For>
            </Section>

            <Section title="Haven and Debt">
              <TextureLine label="Haven" value={c().haven} controls={controls("haven", "Haven")} />
              <TextureLine label="Debt" value={c().debt} die={debtDie} controls={controls("debt", "Debt")} />
            </Section>

            <Section title="Texture">
              <TextureLine label="Keepsake" value={c().keepsake} controls={controls("keepsake", "Keepsake")} />
              <TextureLine label="Mundane Item" value={c().mundaneItem} controls={controls("mundaneItem", "Mundane Item")} />
              <TextureLine label="Vice/Comfort" value={c().comfort} controls={controls("comfort", "Vice/Comfort")} />
            </Section>

            <Section title="Stress and Wounds">
              <div class="rated-line"><span>Stress</span><strong>0</strong></div>
              <div class="rated-line"><span>Wounds</span><strong class="wound-slots" aria-label="Three empty wound slots">☐ ☐ ☐</strong></div>
            </Section>

            <details class="markdown-disclosure" ref={markdownDetails}>
              <summary>Markdown</summary>
              <textarea ref={markdownArea} readonly value={markdown()} aria-label="Character Markdown" />
            </details>
          </article>
        )}
      </Show>
    </div>
  );
}

function Section(props: { title: string; controls?: JSX.Element; children: JSX.Element }) {
  return (
    <section class="generator-section">
      <header>
        <h2>{props.title}</h2>
        {props.controls}
      </header>
      {props.children}
    </section>
  );
}

function RatedLine(props: { entry: RatedEntry; note?: string }) {
  return (
    <div class="rated-line">
      <span>
        {props.entry.name}
        <Show when={props.note}>{" "}<span class="placeholder">{props.note}</span></Show>
      </span>
      <strong>{props.entry.die}</strong>
    </div>
  );
}

function TextureLine(props: { label: string; value: string; die?: string; controls: JSX.Element }) {
  return (
    <div class="texture-line">
      <div>
        <span class="texture-label">{props.label}</span>
        <span>
          {props.value}
          <Show when={props.die}>{" "}<strong class="inline-die">{props.die}</strong></Show>
        </span>
      </div>
      {props.controls}
    </div>
  );
}

function FieldControls(props: {
  label: string;
  locked: boolean;
  onReroll: () => void;
  onToggleLock: () => void;
}) {
  return (
    <span class="field-actions">
      <button type="button" onClick={props.onReroll}>
        Reroll <span class="sr-only">{props.label}</span>
      </button>
      <button type="button" classList={{ locked: props.locked }} aria-pressed={props.locked} onClick={props.onToggleLock}>
        {props.locked ? "Unlock" : "Lock"} <span class="sr-only">{props.label}</span>
      </button>
    </span>
  );
}
