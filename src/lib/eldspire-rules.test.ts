import { describe, expect, it } from "vitest";
import { renderEldspireRules } from "./eldspire-rules";

describe("Eldspire rules", () => {
  it("renders the migrated rules and every d100 table", () => {
    const html = renderEldspireRules();

    expect(html).toContain("How To Play");
    expect(html).toContain('id="rolling"');
    expect(html).toContain('id="character-tables"');
    expect(html).not.toContain("{{table:");
    expect(html.match(/<tr><td>100<\/td>/g)).toHaveLength(9);
  });
});
