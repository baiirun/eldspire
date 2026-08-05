import { describe, expect, it } from "vitest";
import { threatSparkTables } from "@/data/eldspire-threat-tables";
import { renderEldspireRules } from "./eldspire-rules";

describe("Eldspire rules", () => {
  it("renders the migrated rules and every d100 table", () => {
    const html = renderEldspireRules();

    expect(html).toContain("How To Play");
    expect(html).toContain('id="rolling"');
    expect(html).toContain('id="threats"');
    expect(html).toContain('id="character-tables"');
    expect(html).not.toContain("{{table:");
    expect(html).not.toContain("{{threat-tables}}");
    expect(html.match(/<tr><td>100<\/td>/g)).toHaveLength(9);
    expect(html.match(/id="threat-table-/g)).toHaveLength(8);
    expect(threatSparkTables.every((table) => table.entries.length === 12)).toBe(
      true,
    );
  });
});
