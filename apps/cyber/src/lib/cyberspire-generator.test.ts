import { describe, expect, it } from "vitest";
import {
  characterMarkdown,
  generateCharacter,
  rerollField,
} from "./cyberspire-generator";
import { cyberspireActions, cyberspireTables } from "@/data/cyberspire-tables";

describe("Cyberspire character tables", () => {
  it("reads every d100 table and the Action list", () => {
    expect(Object.keys(cyberspireTables)).toHaveLength(8);
    for (const table of Object.values(cyberspireTables)) expect(table).toHaveLength(100);
    expect(cyberspireActions).toEqual([
      "Muscle", "Run", "Ghost", "Brawl", "Blast", "Survey",
      "Track", "Rig", "Study", "Sway", "Command", "Hack",
    ]);
  });
});

describe("Cyberspire character generator", () => {
  it("rates two Actions d10, three d8 and the rest d6", () => {
    const { actions } = generateCharacter();
    const count = (die: string) => actions.filter((a) => a.die === die).length;
    expect(actions).toHaveLength(12);
    expect([count("d10"), count("d8"), count("d6")]).toEqual([2, 3, 7]);
  });

  it("draws four distinct Traits and two distinct Bonds", () => {
    const character = generateCharacter(() => 0);
    expect(character.traits.map((t) => t.name)).toEqual(cyberspireTables.traits.slice(0, 4));
    expect(new Set(character.bonds.map((b) => b.name)).size).toBe(2);
    expect(character.traits.every((t) => t.die === "d8")).toBe(true);
  });

  it("rerolls one field without changing the others", () => {
    const character = generateCharacter(() => 0);
    const rerolled = rerollField(character, "haven", () => 1);
    expect(rerolled.haven).toBe(cyberspireTables.havens[1]);
    expect(rerolled.background).toBe(character.background);
    expect(rerolled.traits).toBe(character.traits);
  });

  it("exports a Markdown character sheet", () => {
    const markdown = characterMarkdown(generateCharacter(() => 0));
    expect(markdown).toContain("# Cyberspire Character");
    expect(markdown).toContain("## Actions");
    expect(markdown).toContain("- Debt: The ripperdoc who fitted your lungs and wants a favor, not money d6");
    expect(markdown).toContain("- Wounds: ☐ ☐ ☐");
    expect(markdown).not.toContain("Jack");
  });
});
