import { createFileRoute } from "@tanstack/solid-router";
import { For } from "solid-js";

export const Route = createFileRoute("/sheet")({
  head: () => ({ meta: [{ title: "Character Sheet | Eldspire" }] }),
  component: CharacterSheet,
});

function Pips() {
  return (
    <span class="cs-pips">
      <For each={[1, 2, 3, 4, 5]}>{() => <span class="cs-pip" />}</For>
    </span>
  );
}

function CharacterSheet() {
  return (
    <main class="character-sheet-page">
      <article class="cs-page" aria-label="Printable Eldspire character sheet">
        <header class="cs-top">
          <SheetField label="Name" />
          <SheetField label="XP" />
          <div class="cs-fatigue-fields">
            <SheetField label="Fatigue" />
            <SheetField label="Fatigue Floor" />
          </div>
        </header>

        <div class="cs-main">
          <div class="cs-left">
            <section class="cs-block" aria-label="Character features">
              <div class="cs-block-head cs-feature-columns">
                <span>Features</span><span>Rating</span>
              </div>
              <For each={Array.from({ length: 7 })}>
                {() => (
                  <div class="cs-feature-row"><div /><Pips /></div>
                )}
              </For>
            </section>

            <section class="cs-block" aria-label="Gear">
              <span class="cs-block-head">Gear</span>
              <div class="cs-gear-list">
                <For each={Array.from({ length: 2 })}>
                  {() => (
                    <div class="cs-gear-column">
                      <For each={Array.from({ length: 10 })}>
                        {() => <div class="cs-gear-line" />}
                      </For>
                    </div>
                  )}
                </For>
              </div>
            </section>

            <RuledBlock label="Ties & Texture" rows={6} rowClass="cs-texture-line" />
          </div>

          <div class="cs-right">
            <section class="cs-block" aria-label="Wounds">
              <span class="cs-block-head">Wounds</span>
              <div class="cs-wound-columns"><span>Name</span><span>Treated</span></div>
              <For each={Array.from({ length: 3 })}>
                {() => (
                  <div class="cs-wound-row"><div /><div><span class="cs-check" /></div></div>
                )}
              </For>
            </section>

            <RuledBlock label="Conditions" rows={8} rowClass="cs-condition-line" />

            <section class="cs-block" aria-label="Spells">
              <span class="cs-block-head">Spells</span>
              <div class="cs-spell-columns"><span>Name</span><span>Tier</span><span>Exhausted</span></div>
              <For each={Array.from({ length: 9 })}>
                {() => (
                  <div class="cs-spell-row"><div /><Pips /><div><span class="cs-check" /></div></div>
                )}
              </For>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}

function SheetField(props: { label: string }) {
  return (
    <section class="cs-field" aria-label={props.label}>
      <span class="cs-field-head">{props.label}</span>
      <div class="cs-field-write" />
    </section>
  );
}

function RuledBlock(props: { label: string; rows: number; rowClass: string }) {
  return (
    <section class="cs-block" aria-label={props.label}>
      <span class="cs-block-head">{props.label}</span>
      <For each={Array.from({ length: props.rows })}>
        {() => <div class={props.rowClass} />}
      </For>
    </section>
  );
}
