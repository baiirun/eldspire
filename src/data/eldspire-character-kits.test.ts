import { describe, expect, it } from "vitest";
import { archetypeKits, backgroundKits } from "./eldspire-character-kits";

describe("Eldspire character kit seeds", () => {
  it.each([
    ["backgrounds", backgroundKits],
    ["archetypes", archetypeKits],
  ] as const)("provides a unique d20 table of %s", (_name, kits) => {
    expect(kits).toHaveLength(20);
    expect(new Set(kits.map((kit) => kit.name)).size).toBe(20);
    expect(kits.every((kit) => kit.description.trim().length > 0)).toBe(true);
  });
});
