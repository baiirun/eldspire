import { describe, expect, it } from "vitest";
import {
  characterMarkdown,
  generateCharacter,
  rerollField,
} from "./osc-generator";

describe("OSC character generator", () => {
  it("generates the complete starting character structure", () => {
    const character = generateCharacter(() => 0);

    expect(character.background).toContain("Company town kid");
    expect(character.traits).toEqual([
      { name: "Strong as an Ox", rating: 2 },
      { name: "Shoots First, Asks Questions Later", rating: 1 },
      { name: "Always Knows the Exits", rating: 1 },
    ]);
    expect(character.rolls.normalTrinket).toBe(1);
    expect(character).not.toHaveProperty("complication");
    expect(character).not.toHaveProperty("firstBrush");
  });

  it("rerolls one field without changing the others", () => {
    const character = generateCharacter(() => 0);
    const rerolled = rerollField(character, "vice", () => 1);

    expect(rerolled.vice).toBeTruthy();
    expect(rerolled.vice).not.toBe(character.vice);
    expect(rerolled.background).toBe(character.background);
    expect(rerolled.rolls.vice).toBe(2);
  });

  it("exports a usable Markdown character sheet", () => {
    const markdown = characterMarkdown(generateCharacter(() => 0));

    expect(markdown).toContain("# OSC Agent");
    expect(markdown).toContain("## Background\n\n- Company town kid");
    expect(markdown).not.toContain("Background: Company town kid 1");
    expect(markdown).not.toContain("## Case File");
    expect(markdown).toContain("Professional Practice:");
    expect(markdown).toContain("Current Stress: 0");
  });
});
