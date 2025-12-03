import { describe, it, expect } from "vitest";
import { parse, render, type Renderer } from "./markdown";

// Simple string renderer for testing
const stringRenderer: Renderer<string> = {
  inline: {
    text: (content) => content,
    bold: (children, ctx) => `<strong>${ctx.renderInline(children)}</strong>`,
    italic: (children, ctx) => `<em>${ctx.renderInline(children)}</em>`,
    bold_italic: (children, ctx) =>
      `<strong><em>${ctx.renderInline(children)}</em></strong>`,
    strikethrough: (children, ctx) => `<del>${ctx.renderInline(children)}</del>`,
    highlight: (children, ctx) => `<mark>${ctx.renderInline(children)}</mark>`,
    code: (content) => `<code>${content}</code>`,
    link: (href, title, children, ctx) =>
      `<a href="${href}"${title ? ` title="${title}"` : ""}>${ctx.renderInline(children)}</a>`,
    image: (src, alt, title) =>
      `<img src="${src}" alt="${alt}"${title ? ` title="${title}"` : ""} />`,
    wikilink: (target, display) => {
      const slug = target.toLowerCase().replace(/\s+/g, "-");
      return `<a href="/pages/${slug}">${display ?? target}</a>`;
    },
    embed: (target) => `<div data-embed="${target}">[Embedded: ${target}]</div>`,
    linebreak: () => "<br />",
  },
  block: {
    paragraph: (children, ctx) => `<p>${ctx.renderInline(children)}</p>`,
    heading: (level, children, ctx) =>
      `<h${level}>${ctx.renderInline(children)}</h${level}>`,
    code_block: (content, language) =>
      `<pre><code${language ? ` class="language-${language}"` : ""}>${content}</code></pre>`,
    blockquote: (children, ctx) =>
      `<blockquote>${ctx.renderBlocks(children)}</blockquote>`,
    callout: (kind, title, foldable, children, ctx) =>
      `<aside data-callout="${kind}"${foldable ? ' data-foldable="true"' : ""}>${title ? `<div>${title}</div>` : ""}${ctx.renderBlocks(children)}</aside>`,
    list: (ordered, start, items, ctx) => {
      const tag = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : "";
      const itemsHtml = items
        .map((item) => {
          const checkbox =
            item.checked !== undefined
              ? `<input type="checkbox"${item.checked ? " checked" : ""} disabled />`
              : "";
          return `<li>${checkbox}${ctx.renderBlocks(item.children)}</li>`;
        })
        .join("");
      return `<${tag}${startAttr}>${itemsHtml}</${tag}>`;
    },
    list_item: (checked, children, ctx) => {
      const checkbox =
        checked !== undefined
          ? `<input type="checkbox"${checked ? " checked" : ""} disabled />`
          : "";
      return `<li>${checkbox}${ctx.renderBlocks(children)}</li>`;
    },
    table: (header, rows, ctx) => {
      const headerHtml = header
        .map(
          (cell) =>
            `<th${cell.align ? ` style="text-align:${cell.align}"` : ""}>${ctx.renderInline(cell.children)}</th>`
        )
        .join("");
      const rowsHtml = rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td${cell.align ? ` style="text-align:${cell.align}"` : ""}>${ctx.renderInline(cell.children)}</td>`).join("")}</tr>`
        )
        .join("");
      return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
    },
    table_cell: (children, align, isHeader, ctx) => {
      const tag = isHeader ? "th" : "td";
      const style = align ? ` style="text-align:${align}"` : "";
      return `<${tag}${style}>${ctx.renderInline(children)}</${tag}>`;
    },
    horizontal_rule: () => "<hr />",
    html: (content) => content,
  },
  join: (outputs) => outputs.join(""),
};

describe("markdown parser", () => {
  describe("frontmatter", () => {
    it("parses YAML frontmatter", () => {
      const result = parse(`---
title: Test Page
tags: [a, b, c]
draft: true
count: 42
---

Content here`);

      expect(result.frontmatter).toEqual({
        title: "Test Page",
        tags: ["a", "b", "c"],
        draft: true,
        count: 42,
      });
      expect(result.tokens).toHaveLength(1);
    });

    it("handles missing frontmatter", () => {
      const result = parse("# Just a heading");
      expect(result.frontmatter).toEqual({});
    });

    it("parses multiline array frontmatter", () => {
      const result = parse(`---
tags:
- one
- two
- three
---

Content`);

      expect(result.frontmatter.tags).toEqual(["one", "two", "three"]);
    });
  });

  describe("headings", () => {
    it("parses ATX headings", () => {
      const result = parse("# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6");
      expect(result.tokens).toHaveLength(6);
      expect(result.tokens[0]).toMatchObject({ type: "heading", level: 1 });
      expect(result.tokens[5]).toMatchObject({ type: "heading", level: 6 });
    });

    it("parses setext headings", () => {
      const result = parse("Heading 1\n===\n\nHeading 2\n---");
      expect(result.tokens[0]).toMatchObject({ type: "heading", level: 1 });
      expect(result.tokens[1]).toMatchObject({ type: "heading", level: 2 });
    });
  });

  describe("inline formatting", () => {
    it("parses bold", () => {
      const result = parse("This is **bold** text");
      const para = result.tokens[0];
      expect(para.type).toBe("paragraph");
      if (para.type === "paragraph") {
        expect(para.children).toHaveLength(3);
        expect(para.children[1]).toMatchObject({ type: "bold" });
      }
    });

    it("parses italic", () => {
      const result = parse("This is *italic* text");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({ type: "italic" });
      }
    });

    it("parses bold italic", () => {
      const result = parse("This is ***bold italic*** text");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({ type: "bold_italic" });
      }
    });

    it("parses strikethrough", () => {
      const result = parse("This is ~~deleted~~ text");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({ type: "strikethrough" });
      }
    });

    it("parses inline code", () => {
      const result = parse("Use `code` here");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({
          type: "code",
          content: "code",
        });
      }
    });

    it("parses links", () => {
      const result = parse('Click [here](https://example.com "Title")');
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({
          type: "link",
          href: "https://example.com",
          title: "Title",
        });
      }
    });

    it("parses images", () => {
      const result = parse('![Alt text](image.png "Image title")');
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[0]).toMatchObject({
          type: "image",
          src: "image.png",
          alt: "Alt text",
          title: "Image title",
        });
      }
    });
  });

  describe("obsidian syntax", () => {
    it("parses wikilinks", () => {
      const result = parse("Link to [[Another Page]]");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({
          type: "wikilink",
          target: "Another Page",
        });
      }
    });

    it("parses wikilinks with display text", () => {
      const result = parse("Link to [[Another Page|custom text]]");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({
          type: "wikilink",
          target: "Another Page",
          display: "custom text",
        });
      }
    });

    it("parses embeds", () => {
      const result = parse("Embed this: ![[embedded-file]]");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({
          type: "embed",
          target: "embedded-file",
        });
      }
    });

    it("parses highlights", () => {
      const result = parse("This is ==highlighted== text");
      const para = result.tokens[0];
      if (para.type === "paragraph") {
        expect(para.children[1]).toMatchObject({ type: "highlight" });
      }
    });

    it("parses callouts", () => {
      const result = parse(`> [!note] Important
> This is a note callout`);
      expect(result.tokens[0]).toMatchObject({
        type: "callout",
        kind: "note",
        title: "Important",
        foldable: false,
      });
    });

    it("parses foldable callouts", () => {
      const result = parse(`> [!warning]- Collapsed
> Hidden content`);
      expect(result.tokens[0]).toMatchObject({
        type: "callout",
        kind: "warning",
        foldable: true,
      });
    });
  });

  describe("code blocks", () => {
    it("parses fenced code blocks", () => {
      const result = parse("```javascript\nconst x = 1;\n```");
      expect(result.tokens[0]).toMatchObject({
        type: "code_block",
        language: "javascript",
        content: "const x = 1;",
      });
    });

    it("parses code blocks without language", () => {
      const result = parse("```\nplain code\n```");
      expect(result.tokens[0]).toMatchObject({
        type: "code_block",
        language: undefined,
        content: "plain code",
      });
    });
  });

  describe("lists", () => {
    it("parses unordered lists", () => {
      const result = parse("- Item 1\n- Item 2\n- Item 3");
      expect(result.tokens[0]).toMatchObject({
        type: "list",
        ordered: false,
      });
      if (result.tokens[0].type === "list") {
        expect(result.tokens[0].items).toHaveLength(3);
      }
    });

    it("parses ordered lists", () => {
      const result = parse("1. First\n2. Second\n3. Third");
      expect(result.tokens[0]).toMatchObject({
        type: "list",
        ordered: true,
      });
    });

    it("parses task lists", () => {
      const result = parse("- [ ] Unchecked\n- [x] Checked");
      if (result.tokens[0].type === "list") {
        expect(result.tokens[0].items[0].checked).toBe(false);
        expect(result.tokens[0].items[1].checked).toBe(true);
      }
    });
  });

  describe("tables", () => {
    it("parses tables", () => {
      const result = parse(`| Header 1 | Header 2 |
| --- | --- |
| Cell 1 | Cell 2 |
| Cell 3 | Cell 4 |`);

      expect(result.tokens[0]).toMatchObject({ type: "table" });
      if (result.tokens[0].type === "table") {
        expect(result.tokens[0].header).toHaveLength(2);
        expect(result.tokens[0].rows).toHaveLength(2);
      }
    });

    it("parses table alignment", () => {
      const result = parse(`| Left | Center | Right |
| :--- | :---: | ---: |
| L | C | R |`);

      if (result.tokens[0].type === "table") {
        expect(result.tokens[0].header[0].align).toBe("left");
        expect(result.tokens[0].header[1].align).toBe("center");
        expect(result.tokens[0].header[2].align).toBe("right");
      }
    });
  });

  describe("blockquotes", () => {
    it("parses blockquotes", () => {
      const result = parse("> This is a quote\n> With multiple lines");
      expect(result.tokens[0]).toMatchObject({ type: "blockquote" });
    });
  });

  describe("horizontal rules", () => {
    it("parses horizontal rules", () => {
      const result = parse("---");
      expect(result.tokens[0]).toMatchObject({ type: "horizontal_rule" });
    });
  });
});

describe("render function", () => {
  it("renders basic markdown", () => {
    const result = parse("# Hello\n\nThis is **bold**.");
    const html = render(result, stringRenderer);
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders wikilinks with slugified hrefs", () => {
    const result = parse("Link to [[My Page]]");
    const html = render(result, stringRenderer);
    expect(html).toContain('href="/pages/my-page"');
  });

  it("renders callouts", () => {
    const result = parse(`> [!tip] Pro Tip
> Do this thing`);
    const html = render(result, stringRenderer);
    expect(html).toContain('data-callout="tip"');
  });

  it("allows custom renderers", () => {
    const customRenderer: Renderer<string> = {
      ...stringRenderer,
      inline: {
        ...stringRenderer.inline,
        bold: (children, ctx) =>
          `<b class="custom">${ctx.renderInline(children)}</b>`,
      },
    };

    const result = parse("**bold text**");
    const html = render(result, customRenderer);
    expect(html).toContain('<b class="custom">bold text</b>');
  });
});
