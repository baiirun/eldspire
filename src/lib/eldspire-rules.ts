import rulesTemplate from "@/content/eldspire-rules.html?raw";
import { eldspireTables, type EldspireTableKey } from "@/data/eldspire-tables";

const tableTitles = {
  traits: "Traits",
  backgrounds: "Backgrounds",
  archetypes: "Archetypes",
  hearthTies: "Hearth Ties",
  roadTies: "Road Ties",
  appearances: "Appearances",
  keepsakes: "Keepsakes",
  mundaneItems: "Mundane Items",
  comforts: "Comforts",
} as const satisfies Record<EldspireTableKey, string>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRows(entries: readonly string[], offset: number): string {
  return entries
    .map(
      (entry, index) =>
        `<tr><td>${String(offset + index).padStart(2, "0")}</td><td>${escapeHtml(entry)}</td></tr>`,
    )
    .join("");
}

function renderRandomTable(key: EldspireTableKey): string {
  const entries = eldspireTables[key];
  const midpoint = Math.ceil(entries.length / 2);
  const halves = [entries.slice(0, midpoint), entries.slice(midpoint)];
  const id = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

  return `<section class="rules-random-table" id="table-${id}">
    <h3>${tableTitles[key]} (d100)</h3>
    <div class="rules-random-columns">
      ${halves
        .map(
          (half, index) => `<table class="rules-table">
            <thead><tr><th>Roll</th><th>Result</th></tr></thead>
            <tbody>${renderRows(half, index * midpoint + 1)}</tbody>
          </table>`,
        )
        .join("")}
    </div>
  </section>`;
}

export function renderEldspireRules(): string {
  return Object.keys(tableTitles).reduce(
    (html, key) =>
      html.replace(
        `{{table:${key}}}`,
        renderRandomTable(key as EldspireTableKey),
      ),
    rulesTemplate,
  );
}
