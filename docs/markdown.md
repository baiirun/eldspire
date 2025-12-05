# Markdown Parser

This document describes the custom Obsidian-flavored markdown parser used in Eldspire.

## Overview

The parser is a pure TypeScript implementation that converts markdown into an abstract syntax tree (AST). Rendering is handled separately via a configurable renderer system, allowing the same parsed content to be rendered to different targets (HTML strings, Solid.js components, etc.).

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Markdown   │  →  │    Parser    │  →  │     AST      │
│    String    │     │   parse()    │     │  (Tokens)    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Output    │  ←  │   Renderer   │  ←  │  render()    │
│  (JSX, HTML) │     │   Config     │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Files**:
- `src/lib/markdown.ts` - Core parser and generic render function
- `src/lib/markdown-solid.tsx` - Solid.js renderer implementation

## Supported Syntax

### Standard Markdown

| Feature | Syntax |
|---------|--------|
| Headings | `# H1` through `###### H6` |
| Bold | `**text**` or `__text__` |
| Italic | `*text*` or `_text_` |
| Bold + Italic | `***text***` or `___text___` |
| Inline code | `` `code` `` |
| Code blocks | ` ```language ` |
| Links | `[text](url "title")` |
| Images | `![alt](src "title")` |
| Blockquotes | `> quote` |
| Unordered lists | `- item` or `* item` |
| Ordered lists | `1. item` |
| Horizontal rules | `---` or `***` or `___` |

### GitHub Flavored Markdown (GFM)

| Feature | Syntax |
|---------|--------|
| Tables | `\| col \| col \|` with `\| --- \| --- \|` delimiter |
| Strikethrough | `~~text~~` |
| Task lists | `- [ ] unchecked` or `- [x] checked` |
| Autolinks | `<https://example.com>` |

### Obsidian Extensions

| Feature | Syntax |
|---------|--------|
| Wikilinks | `[[Page Name]]` or `[[Page Name\|Display Text]]` |
| Embeds | `![[filename]]` |
| Highlights | `==highlighted text==` |
| Callouts | `> [!note] Title` |

### YAML Frontmatter

```yaml
---
title: Page Title
tags: [tag1, tag2]
published: true
---
```

## Token Types

### Inline Tokens

```typescript
type InlineToken =
  | { type: "text"; content: string }
  | { type: "bold"; children: InlineToken[] }
  | { type: "italic"; children: InlineToken[] }
  | { type: "bold_italic"; children: InlineToken[] }
  | { type: "strikethrough"; children: InlineToken[] }
  | { type: "highlight"; children: InlineToken[] }
  | { type: "code"; content: string }
  | { type: "link"; href: string; title?: string; children: InlineToken[] }
  | { type: "image"; src: string; alt: string; title?: string }
  | { type: "wikilink"; target: string; display?: string }
  | { type: "embed"; target: string }
  | { type: "linebreak" };
```

### Block Tokens

```typescript
type BlockToken =
  | { type: "paragraph"; children: InlineToken[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineToken[] }
  | { type: "code_block"; language?: string; content: string }
  | { type: "blockquote"; children: BlockToken[] }
  | { type: "callout"; kind: string; title?: string; foldable: boolean; children: BlockToken[] }
  | { type: "list"; ordered: boolean; start?: number; items: ListItem[] }
  | { type: "table"; header: TableCell[]; rows: TableCell[][] }
  | { type: "horizontal_rule" }
  | { type: "html"; content: string };
```

## Usage

### Basic Parsing

```typescript
import { parse } from "@/lib/markdown";

const result = parse(markdownString);
// result.frontmatter - parsed YAML frontmatter
// result.tokens - array of BlockToken
```

### Rendering with Solid.js

```tsx
import { parse } from "@/lib/markdown";
import { Markdown, MarkdownContent } from "@/lib/markdown-solid";

// Option 1: Parse separately, then render
const content = parse(markdownString);
<Markdown content={content} />

// Option 2: Parse and render in one step
<MarkdownContent markdown={markdownString} />
```

### Custom Renderer Configuration

```tsx
import { createSolidRenderer } from "@/lib/markdown-solid";

const renderer = createSolidRenderer({
  // Change wikilink base path
  wikiLinkBasePath: "/wiki",

  // Override specific elements
  overrides: {
    heading: (level, children, ctx) => (
      <h1 class={`heading-${level}`}>{ctx.renderInline(children)}</h1>
    ),
    wikilink: (target, display, ctx) => (
      <MyCustomLink to={target}>{display ?? target}</MyCustomLink>
    ),
  },
});
```

### Generic Renderer Interface

The parser uses a generic renderer interface, allowing any output type:

```typescript
type Renderer<T> = {
  inline: InlineRenderers<T>;
  block: BlockRenderers<T>;
  join: (outputs: T[]) => T;
};
```

Each renderer function receives a `RenderContext` with helpers:

```typescript
type RenderContext<T> = {
  renderInline: (tokens: InlineToken[]) => T;
  renderBlocks: (tokens: BlockToken[]) => T;
};
```

## Callout Types

Callouts support any type string, but common conventions include:

| Type | Use Case |
|------|----------|
| `note` | General information |
| `tip` | Helpful suggestions |
| `warning` | Cautions |
| `danger` | Critical warnings |
| `info` | Informational notes |
| `quote` | Quotations |

Callouts can be foldable with `+` (default open) or `-` (default closed):

```markdown
> [!note]+ Expandable Note
> This content is visible by default but can be collapsed.

> [!warning]- Hidden Warning
> This content is hidden by default.
```

## Wikilink Handling

Wikilinks are converted to internal navigation links:

1. Target is lowercased and spaces become hyphens
2. Prepended with base path (default: `/pages`)
3. URL-encoded for safety

```
[[Ashenport]]           → /pages/ashenport
[[The Pale Coast]]      → /pages/the-pale-coast
[[Place|Custom Name]]   → /pages/place (displays "Custom Name")
```

## Escape Characters

Use backslash to escape special characters:

```markdown
\*not italic\*
\[[not a wikilink\]]
```

## Line Breaks

Two methods for hard line breaks:

1. Two spaces at end of line followed by newline
2. Backslash at end of line followed by newline

## Limitations

- No math/LaTeX support
- No footnotes
- Embeds render as placeholders (not actual embedded content)
- HTML blocks are rendered raw (no sanitization)
