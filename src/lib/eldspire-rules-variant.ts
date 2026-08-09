import rulesVariantSections from "../content/eldspire-rules-variant.html?raw";
import { renderEldspireRules } from "./eldspire-rules";

const variantSectionIds = ["characters", "rolling", "magic", "advancement"] as const;

function sectionPattern(id: string): RegExp {
  return new RegExp(
    `<section class="rules-section" id="${id}">[\\s\\S]*?</section>`,
  );
}

function readVariantSection(id: string): string {
  const section = rulesVariantSections.match(sectionPattern(id))?.[0];

  if (!section) {
    throw new Error(`Missing experimental rules section: ${id}`);
  }

  return section;
}

export function renderEldspireRulesVariant(): string {
  const currentRules = renderEldspireRules();
  const withVariantSections = variantSectionIds.reduce(
    (html, id) => html.replace(sectionPattern(id), readVariantSection(id)),
    currentRules,
  );

  return withVariantSections
    .replace(
      '<article class="rules-page" aria-label="Eldspire rules">',
      '<article class="rules-page rules-variant-page" aria-label="Experimental Eldspire step-dice rules">',
    )
    .replace("Eldspire Expedition Rules", "Experimental Eldspire Rules")
    .replace("<h1>How To Play</h1>", "<h1>How To Play: Step-Dice Variant</h1>")
    .replace(
      '<p class="rules-note"><strong>These are the current rules.</strong> The experimental Baselines step-dice modifier package is available at <a href="/rules/variant">/rules/variant</a>.</p>',
      '<p class="rules-note"><strong>Experimental and noncanonical.</strong> This page replaces the character, action, advancement, and spellcasting procedures with the Baselines step-dice variant. Return to the <a href="/rules">current rules</a>.</p>',
    );
}
