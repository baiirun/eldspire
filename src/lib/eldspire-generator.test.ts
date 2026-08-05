import { describe, expect, it } from "vitest";
import { eldspireTables } from "@/data/eldspire-tables";
import {
  characterMarkdown,
  drawTraits,
  generateCharacter,
  rerollField,
} from "./eldspire-generator";

describe("eldspire character generator", () => {
  it("keeps every character table at d100", () => {
    for (const entries of Object.values(eldspireTables)) {
      expect(entries).toHaveLength(100);
    }
  });

  it("draws four distinct traits with the starting ratings", () => {
    const traits = drawTraits(() => 0);

    expect(traits.map((trait) => trait.rating)).toEqual([2, 1, 1, 1]);
    expect(new Set(traits.map((trait) => trait.name))).toHaveLength(4);
  });

  it("generates every character field and records one-based rolls", () => {
    const character = generateCharacter(() => 0);

    expect(character.background).toBe(eldspireTables.backgrounds[0]);
    expect(character.archetype).toBe(eldspireTables.archetypes[0]);
    expect(Object.values(character.rolls)).toEqual(Array(8).fill(1));
  });

  it("rerolls one field without changing the others", () => {
    const character = generateCharacter(() => 0);
    const rerolled = rerollField(character, "comfort", () => 1);

    expect(rerolled.comfort).toBe(eldspireTables.comforts[1]);
    expect(rerolled.background).toBe(character.background);
    expect(rerolled.traits).toEqual(character.traits);
  });

  it("exports the character as playable markdown", () => {
    const markdown = characterMarkdown(generateCharacter(() => 0));

    expect(markdown).toContain("# Generated Expedition Character");
    expect(markdown).toContain("## Character Features");
    expect(markdown).toContain("## Traits");
    expect(markdown).toContain("- Current Fatigue: 0");
  });
});
