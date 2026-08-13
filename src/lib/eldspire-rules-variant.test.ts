import { describe, expect, it } from "vitest";
import { renderEldspireRulesVariant } from "./eldspire-rules-variant";

describe("Eldspire experimental rules", () => {
  it("renders a complete rules page with the step-dice sections substituted", () => {
    const html = renderEldspireRulesVariant();

    expect(html).toContain("How To Play: Step-Dice Variant");
    expect(html).toContain('class="rules-page rules-variant-page"');
    expect(html).toContain("Starting Approaches");
    expect(html).toContain("<h3>Advantage</h3>");
    expect(html).toContain("<h3>Disadvantage</h3>");
    expect(html).toContain("<h3>Static Results</h3>");
    expect(html).not.toContain("<th>Position</th>");
    expect(html).toContain("Any number of characters may help");
    expect(html).not.toContain("no more than three dice");
    expect(html).toContain("<h3>Failure</h3>");
    expect(html).toContain("<h3>Rally</h3>");
    expect(html).toContain("A successful roll never triggers Rally from its dice");
    expect(html).toContain("<strong>Fray.</strong>");
    expect(html).not.toContain("<strong>Faltering.</strong>");
    expect(html).not.toContain("Failure and Rally");
    expect(html).toContain("one separate Arcane");
    expect(html).toContain("New unranked Feature");
    expect(html).toContain('href="/rules"');
    expect(html).toContain('href="/rules/variant/d6-pool"');
    expect(html).not.toContain("Rated Features");
    expect(html).not.toContain("Separate Fatigue Dice");
    expect(html).not.toContain("Convert action dice");

    expect(html).toContain('id="principles"');
    expect(html).toContain('id="actions-threats"');
    expect(html).toContain('id="harm"');
    expect(html).toContain('id="recovery"');
    expect(html).toContain('id="equipment"');
    expect(html).toContain('id="travel"');
    expect(html).toContain('id="camp"');
    expect(html).toContain('id="downtime"');
    expect(html).toContain('id="character-tables"');
    expect(html).not.toContain("Threat Format");
    expect(html).not.toContain("Threat Spark Tables");
    expect(html).not.toContain("{{table:");
  });
});
