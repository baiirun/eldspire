import { describe, expect, it } from "vitest";
import { archetypeKits, backgroundKits } from "./eldspire-character-kits";

describe("Eldspire character kit seeds", () => {
  it.each([
    ["backgrounds", backgroundKits],
    ["archetypes", archetypeKits],
  ] as const)("provides a unique d100 table of %s", (_name, kits) => {
    expect(kits).toHaveLength(100);
    expect(new Set(kits)).toHaveLength(100);
    expect(kits.every((kit) => kit.trim().length > 0)).toBe(true);
  });
});
