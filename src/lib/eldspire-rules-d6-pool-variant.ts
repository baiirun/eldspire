import rulesVariantSections from "../content/eldspire-rules-d6-pool-variant.html?raw";
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
    throw new Error(`Missing experimental d6-pool rules section: ${id}`);
  }

  return section;
}

export function renderEldspireRulesD6PoolVariant(): string {
  const currentRules = renderEldspireRules();
  const withVariantSections = variantSectionIds.reduce(
    (html, id) => html.replace(sectionPattern(id), readVariantSection(id)),
    currentRules,
  );

  return withVariantSections
    .replace(
      '<article class="rules-page" aria-label="Eldspire rules">',
      '<article class="rules-page rules-variant-page" aria-label="Experimental Eldspire d6-pool rules">',
    )
    .replace("Eldspire Expedition Rules", "Experimental Eldspire Rules")
    .replace("<h1>How To Play</h1>", "<h1>How To Play: d6-Pool Variant</h1>")
    .replace(
      '<p class="rules-note"><strong>These are the current rules.</strong> Experimental alternatives are available as the <a href="/rules/variant">step-dice variant</a> and <a href="/rules/variant/d6-pool">d6-pool variant</a>.</p>',
      '<p class="rules-note"><strong>Experimental and noncanonical.</strong> This page replaces the character, action, advancement, and spellcasting procedures with the Baselines d6-pool variant. Return to the <a href="/rules">current rules</a> or compare the <a href="/rules/variant">step-dice variant</a>.</p>',
    );
}
