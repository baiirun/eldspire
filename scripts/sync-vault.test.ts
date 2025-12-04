import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  hasPublishTag,
  parseTitle,
  findMarkdownFiles,
  collectPages,
} from "./sync-vault";

describe("hasPublishTag", () => {
  it("finds hashtag in content", () => {
    const content = `# Page

This page is tagged #wiki for publishing.`;

    expect(hasPublishTag(content, "wiki")).toBe(true);
    expect(hasPublishTag(content, "other")).toBe(false);
  });

  it("does not match partial hashtags", () => {
    const content = "This has #wikipedia but not wiki";
    expect(hasPublishTag(content, "wiki")).toBe(false);
  });

  it("matches hashtag at end of content", () => {
    const content = "Tag at end #wiki";
    expect(hasPublishTag(content, "wiki")).toBe(true);
  });

  it("matches hashtag at start of content", () => {
    const content = "#wiki is the first thing";
    expect(hasPublishTag(content, "wiki")).toBe(true);
  });

  it("matches hashtag on its own line", () => {
    const content = `Some content
#wiki
More content`;
    expect(hasPublishTag(content, "wiki")).toBe(true);
  });
});

describe("parseTitle", () => {
  it("strips xx.xx.xx prefix from filename", () => {
    expect(parseTitle("04.99.06 How to pick furniture.md")).toBe("How to pick furniture");
    expect(parseTitle("01.02.03 Test Page.md")).toBe("Test Page");
  });

  it("handles files without prefix", () => {
    expect(parseTitle("Regular Page.md")).toBe("Regular Page");
    expect(parseTitle("Simple.md")).toBe("Simple");
  });

  it("handles edge cases", () => {
    expect(parseTitle("00.00.00 Edge Case.md")).toBe("Edge Case");
    expect(parseTitle("99.99.99 Max Values.md")).toBe("Max Values");
  });

  it("does not strip invalid prefixes", () => {
    expect(parseTitle("4.99.06 Invalid.md")).toBe("4.99.06 Invalid");
    expect(parseTitle("04.9.06 Invalid.md")).toBe("04.9.06 Invalid");
    expect(parseTitle("04-99-06 Wrong Separator.md")).toBe("04-99-06 Wrong Separator");
  });

  it("handles files without .md extension", () => {
    expect(parseTitle("01.01.01 No Extension")).toBe("No Extension");
  });
});

describe("file scanning integration", () => {
  const testDir = join(tmpdir(), `sync-vault-test-${Date.now()}`);

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, "subdir"), { recursive: true });
    await mkdir(join(testDir, ".hidden"), { recursive: true });

    await writeFile(
      join(testDir, "01.01.01 Published Page.md"),
      `# Published Page
Content here #wiki`
    );

    await writeFile(
      join(testDir, "02.02.02 Also Published.md"),
      `# Also Published
This has #wiki inline tag`
    );

    await writeFile(
      join(testDir, "03.03.03 Not Published.md"),
      `# Not Published
No wiki tag here`
    );

    await writeFile(
      join(testDir, "subdir", "04.04.04 Nested Published.md"),
      `# Nested
#wiki #nested`
    );

    await writeFile(
      join(testDir, ".hidden", "05.05.05 Hidden.md"),
      `# Should be ignored
#wiki`
    );
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("finds all markdown files recursively", async () => {
    const files = await findMarkdownFiles(testDir);
    expect(files).toHaveLength(4); // excludes hidden dir
    expect(files.some((f) => f.includes("Published Page"))).toBe(true);
    expect(files.some((f) => f.includes("Nested Published"))).toBe(true);
    expect(files.some((f) => f.includes("Hidden"))).toBe(false);
  });

  it("collects only pages with wiki tag", async () => {
    const pages = await collectPages(testDir, "wiki");
    expect(pages).toHaveLength(3);

    const names = pages.map((p) => p.name);
    expect(names).toContain("Published Page");
    expect(names).toContain("Also Published");
    expect(names).toContain("Nested Published");
    expect(names).not.toContain("Not Published");
  });

  it("strips prefix from collected page names", async () => {
    const pages = await collectPages(testDir, "wiki");
    const publishedPage = pages.find((p) => p.name === "Published Page");

    expect(publishedPage).toBeDefined();
    expect(publishedPage?.name).toBe("Published Page");
    expect(publishedPage?.content).toContain("# Published Page");
  });

  it("works with different tags", async () => {
    const pages = await collectPages(testDir, "nested");
    expect(pages).toHaveLength(1);
    expect(pages[0].name).toBe("Nested Published");
  });

  it("returns empty array when no pages match", async () => {
    const pages = await collectPages(testDir, "nonexistent");
    expect(pages).toHaveLength(0);
  });
});
