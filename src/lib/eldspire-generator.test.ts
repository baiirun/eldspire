import { describe, expect, it } from "vitest";
import { eldspireTables } from "@/data/eldspire-tables";
import {
  actions,
  characterMarkdown,
  drawActions,
  drawTraits,
  generateCharacter,
  rerollField,
} from "./eldspire-generator";

describe("eldspire character generator", () => {
  it("uses d100 character tables", () => {
    for (const entries of Object.values(eldspireTables)) {
      expect(entries).toHaveLength(100);
    }
  });

  it("draws four distinct unrated traits", () => {
    const traits = drawTraits(() => 0);

    expect(traits).toHaveLength(4);
    expect(new Set(traits)).toHaveLength(4);
  });

  it("assigns the seven starting points to five distinct actions", () => {
    const ratings = drawActions(() => 0);

    expect(Object.keys(ratings)).toEqual([...actions]);
    expect(Object.values(ratings).filter((rating) => rating === 2)).toHaveLength(2);
    expect(Object.values(ratings).filter((rating) => rating === 1)).toHaveLength(3);
    expect(Object.values(ratings).filter((rating) => rating === 0)).toHaveLength(8);
    expect(Object.values(ratings).reduce((total, rating) => total + rating, 0)).toBe(7);
  });

  it("generates every character field and records one-based rolls", () => {
    const character = generateCharacter(() => 0);

    expect(character.background).toBe(eldspireTables.backgrounds[0]);
    expect(character.archetype).toBe(eldspireTables.archetypes[0]);
    expect(character.actions.Exert).toBe(2);
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
    expect(markdown).toContain("## Character");
    expect(markdown).toContain("## Actions");
    expect(markdown).toContain("- Exert: 2");
    expect(markdown).toContain("## Traits");
    expect(markdown).toContain("- Current Fatigue: 0");
  });
});
