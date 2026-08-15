import { describe, expect, it } from "vitest";
import { renderEldspireRules } from "./eldspire-rules";

describe("Eldspire rules", () => {
  it("renders the migrated rules and every d100 table", () => {
    const html = renderEldspireRules();

    expect(html).toContain("How To Play");
    expect(html).toContain('id="rolling"');
    expect(html).toContain('id="actions-threats"');
    expect(html).toContain('id="character-tables"');
    expect(html).toContain('href="/rules/variant"');
    expect(html).toContain("Conflict normally begins with what a character wants to change");
    expect(html).toContain("The normal rhythm:</strong> goal → opposition and stakes");
    expect(html).not.toContain("The GM announces threats; players describe how they answer");
    expect(html).toContain("<strong>Fray.</strong>");
    expect(html).not.toContain("<strong>Faltering.</strong>");
    expect(html).not.toContain("Threat Format");
    expect(html).not.toContain("Threat Spark Tables");
    expect(html).not.toContain("{{table:");
    expect(html.match(/<tr><td>100<\/td>/g)).toHaveLength(9);
  });
});
