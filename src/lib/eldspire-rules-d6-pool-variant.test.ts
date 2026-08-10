import { describe, expect, it } from "vitest";
import { renderEldspireRulesD6PoolVariant } from "./eldspire-rules-d6-pool-variant";

describe("Eldspire d6-pool experimental rules", () => {
  it("renders a complete rules page with the d6-pool sections substituted", () => {
    const html = renderEldspireRulesD6PoolVariant();

    expect(html).toContain("How To Play: d6-Pool Variant");
    expect(html).toContain('aria-label="Experimental Eldspire d6-pool rules"');
    expect(html).toContain("Every action has Difficulty 8");
    expect(html).toContain("Record Baselines as ratings from 1–5");
    expect(html).toContain("Force 3");
    expect(html).not.toContain("Force 3d6");
    expect(html).not.toContain("Force d8");
    expect(html).toContain("Exactly one 6");
    expect(html).toContain("Two or more 6s");
    expect(html).toContain("stake 1–3 Fatigue");
    expect(html).toContain("Any number of characters may help");
    expect(html).toContain("It never adds a separate Arcane die");
    expect(html).toContain("Remove one d6 for each spell Tier above 1");
    expect(html).toContain("gains Fatigue equal to its Tier");
    expect(html).toContain("A Mishap is the magical interpretation of the ordinary Fumble result");
    expect(html).toContain("<h3>Fumble and Rally</h3>");
    expect(html).not.toContain("Super Fail");
    expect(html).not.toContain("The spell works and becomes exhausted");
    expect(html).toContain('href="/rules"');
    expect(html).toContain('href="/rules/variant"');

    expect(html).toContain('id="principles"');
    expect(html).toContain('id="actions-threats"');
    expect(html).toContain('id="harm"');
    expect(html).toContain('id="recovery"');
    expect(html).toContain('id="equipment"');
    expect(html).toContain('id="travel"');
    expect(html).toContain('id="camp"');
    expect(html).toContain('id="downtime"');
    expect(html).toContain('id="character-tables"');
    expect(html).not.toContain("Rated Features");
    expect(html).not.toContain("Separate Fatigue Dice");
    expect(html).not.toContain("{{table:");
  });
});
