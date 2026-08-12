import { describe, expect, it } from "vitest";
import { oscTables } from "./osc-tables";

describe("OSC character tables", () => {
  it("imports every d100 table from the canonical table bank", () => {
    expect(Object.keys(oscTables)).toHaveLength(12);
    for (const table of Object.values(oscTables)) {
      expect(table).toHaveLength(100);
    }
  });

  it("preserves table order", () => {
    expect(oscTables.traits[0]).toBe("Strong as an Ox");
    expect(oscTables.traits[99]).toBe("Cover Identity Became Real");
    expect(oscTables.firstBrushes[99]).toBe(
      "You were told this was not your first brush at all.",
    );
  });
});
