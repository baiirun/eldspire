import { describe, it, expect } from "vitest";
import { unslugify } from "./unslugify";

describe("unslugify", () => {
  it("converts a simple slug to title case", () => {
    expect(unslugify("hello")).toBe("Hello");
  });

  it("converts a multi-word slug to title case", () => {
    expect(unslugify("archmage-velorin")).toBe("Archmage Velorin");
  });

  it("handles single character words", () => {
    expect(unslugify("a-b-c")).toBe("A B C");
  });

  it("returns empty string for empty input", () => {
    expect(unslugify("")).toBe("");
  });

  it("handles already capitalized slugs", () => {
    expect(unslugify("HELLO-WORLD")).toBe("HELLO WORLD");
  });

  it("handles mixed case slugs", () => {
    expect(unslugify("hELLO-wORLD")).toBe("HELLO WORLD");
  });

  it("converts real wiki page slugs", () => {
    expect(unslugify("verdant-kingdom")).toBe("Verdant Kingdom");
    expect(unslugify("eldspire")).toBe("Eldspire");
  });
});
