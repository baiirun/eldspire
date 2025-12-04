/**
 * Custom Obsidian-flavored Markdown Parser
 *
 * A pure parser that converts markdown into an AST (abstract syntax tree).
 * Rendering is handled separately via a configurable renderer.
 *
 * Supports:
 * - Standard Markdown (headers, bold, italic, links, images, code, lists, blockquotes)
 * - GFM (tables, strikethrough, task lists, autolinks)
 * - Obsidian (wikilinks, callouts, embeds, highlights)
 * - YAML frontmatter
 */

// =============================================================================
// Token Types
// =============================================================================

export type FrontMatter = Record<string, unknown>;

export type InlineToken =
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

export type BlockToken =
  | { type: "paragraph"; children: InlineToken[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineToken[] }
  | { type: "code_block"; language?: string; content: string }
  | { type: "blockquote"; children: BlockToken[] }
  | {
      type: "callout";
      kind: string;
      title?: string;
      foldable: boolean;
      children: BlockToken[];
    }
  | { type: "list"; ordered: boolean; start?: number; items: ListItem[] }
  | { type: "table"; header: TableCell[]; rows: TableCell[][] }
  | { type: "horizontal_rule" }
  | { type: "html"; content: string };

export type ListItem = {
  checked?: boolean;
  children: BlockToken[];
};

export type TableCell = {
  align?: "left" | "center" | "right";
  children: InlineToken[];
};

export type ParseResult = {
  frontmatter: FrontMatter;
  tokens: BlockToken[];
};

// =============================================================================
// Renderer Types
// =============================================================================

/**
 * Context passed to all renderer functions
 */
export type RenderContext<T> = {
  renderInline: (tokens: InlineToken[]) => T;
  renderBlocks: (tokens: BlockToken[]) => T;
};

/**
 * Inline element renderers
 */
export type InlineRenderers<T> = {
  text: (content: string, ctx: RenderContext<T>) => T;
  bold: (children: InlineToken[], ctx: RenderContext<T>) => T;
  italic: (children: InlineToken[], ctx: RenderContext<T>) => T;
  bold_italic: (children: InlineToken[], ctx: RenderContext<T>) => T;
  strikethrough: (children: InlineToken[], ctx: RenderContext<T>) => T;
  highlight: (children: InlineToken[], ctx: RenderContext<T>) => T;
  code: (content: string, ctx: RenderContext<T>) => T;
  link: (
    href: string,
    title: string | undefined,
    children: InlineToken[],
    ctx: RenderContext<T>
  ) => T;
  image: (
    src: string,
    alt: string,
    title: string | undefined,
    ctx: RenderContext<T>
  ) => T;
  wikilink: (
    target: string,
    display: string | undefined,
    ctx: RenderContext<T>
  ) => T;
  embed: (target: string, ctx: RenderContext<T>) => T;
  linebreak: (ctx: RenderContext<T>) => T;
};

/**
 * Block element renderers
 */
export type BlockRenderers<T> = {
  paragraph: (children: InlineToken[], ctx: RenderContext<T>) => T;
  heading: (
    level: 1 | 2 | 3 | 4 | 5 | 6,
    children: InlineToken[],
    ctx: RenderContext<T>
  ) => T;
  code_block: (
    content: string,
    language: string | undefined,
    ctx: RenderContext<T>
  ) => T;
  blockquote: (children: BlockToken[], ctx: RenderContext<T>) => T;
  callout: (
    kind: string,
    title: string | undefined,
    foldable: boolean,
    children: BlockToken[],
    ctx: RenderContext<T>
  ) => T;
  list: (
    ordered: boolean,
    start: number | undefined,
    items: ListItem[],
    ctx: RenderContext<T>
  ) => T;
  list_item: (
    checked: boolean | undefined,
    children: BlockToken[],
    ctx: RenderContext<T>
  ) => T;
  table: (
    header: TableCell[],
    rows: TableCell[][],
    ctx: RenderContext<T>
  ) => T;
  table_cell: (
    children: InlineToken[],
    align: "left" | "center" | "right" | undefined,
    isHeader: boolean,
    ctx: RenderContext<T>
  ) => T;
  horizontal_rule: (ctx: RenderContext<T>) => T;
  html: (content: string, ctx: RenderContext<T>) => T;
};

/**
 * Complete renderer configuration
 */
export type Renderer<T> = {
  inline: InlineRenderers<T>;
  block: BlockRenderers<T>;
  /**
   * Combine multiple rendered outputs into one
   */
  join: (outputs: T[]) => T;
};

// =============================================================================
// Frontmatter Parser
// =============================================================================

function parseFrontmatter(input: string): {
  frontmatter: FrontMatter;
  content: string;
} {
  if (!input.startsWith("---")) {
    return { frontmatter: {}, content: input };
  }

  const endIndex = input.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter: {}, content: input };
  }

  const yamlContent = input.slice(4, endIndex);
  const content = input.slice(endIndex + 4).trimStart();
  const frontmatter: FrontMatter = {};

  // Simple YAML parser for common frontmatter patterns
  const lines = yamlContent.split("\n");
  let currentKey = "";
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Array item
    if (trimmed.startsWith("- ") && currentKey) {
      if (!currentArray) {
        currentArray = [];
        frontmatter[currentKey] = currentArray;
      }
      currentArray.push(trimmed.slice(2).trim());
      continue;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      currentKey = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      currentArray = null;

      if (value) {
        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          frontmatter[currentKey] = value.slice(1, -1);
        } else if (value === "true") {
          frontmatter[currentKey] = true;
        } else if (value === "false") {
          frontmatter[currentKey] = false;
        } else if (!isNaN(Number(value))) {
          frontmatter[currentKey] = Number(value);
        } else if (value.startsWith("[") && value.endsWith("]")) {
          // Inline array
          frontmatter[currentKey] = value
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""));
        } else {
          frontmatter[currentKey] = value;
        }
      }
    }
  }

  return { frontmatter, content };
}

// =============================================================================
// Inline Parser
// =============================================================================

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let textStart = 0;

  const pushText = (end: number) => {
    if (end > textStart) {
      tokens.push({ type: "text", content: text.slice(textStart, end) });
    }
  };

  while (i < text.length) {
    // Escape character
    if (text[i] === "\\" && i + 1 < text.length) {
      pushText(i);
      tokens.push({ type: "text", content: text[i + 1] });
      i += 2;
      textStart = i;
      continue;
    }

    // Line break (two spaces + newline or backslash + newline)
    if (
      (text.slice(i, i + 3) === "  \n" || text.slice(i, i + 2) === "\\\n") &&
      i + 2 < text.length
    ) {
      pushText(i);
      tokens.push({ type: "linebreak" });
      i += text[i] === "\\" ? 2 : 3;
      textStart = i;
      continue;
    }

    // Embed ![[file]]
    if (text.slice(i, i + 3) === "![[") {
      const endBracket = text.indexOf("]]", i + 3);
      if (endBracket !== -1) {
        pushText(i);
        const target = text.slice(i + 3, endBracket);
        tokens.push({ type: "embed", target });
        i = endBracket + 2;
        textStart = i;
        continue;
      }
    }

    // Wikilink [[target]] or [[target|display]]
    if (text.slice(i, i + 2) === "[[") {
      const endBracket = text.indexOf("]]", i + 2);
      if (endBracket !== -1) {
        pushText(i);
        const inner = text.slice(i + 2, endBracket);
        const pipeIndex = inner.indexOf("|");
        if (pipeIndex !== -1) {
          tokens.push({
            type: "wikilink",
            target: inner.slice(0, pipeIndex),
            display: inner.slice(pipeIndex + 1),
          });
        } else {
          tokens.push({ type: "wikilink", target: inner });
        }
        i = endBracket + 2;
        textStart = i;
        continue;
      }
    }

    // Image ![alt](src "title")
    if (text[i] === "!" && text[i + 1] === "[") {
      const altEnd = text.indexOf("]", i + 2);
      if (altEnd !== -1 && text[altEnd + 1] === "(") {
        const srcEnd = text.indexOf(")", altEnd + 2);
        if (srcEnd !== -1) {
          pushText(i);
          const alt = text.slice(i + 2, altEnd);
          const srcPart = text.slice(altEnd + 2, srcEnd);
          const titleMatch = srcPart.match(/^(.+?)\s+"(.+)"$/);
          if (titleMatch) {
            tokens.push({
              type: "image",
              alt,
              src: titleMatch[1],
              title: titleMatch[2],
            });
          } else {
            tokens.push({ type: "image", alt, src: srcPart });
          }
          i = srcEnd + 1;
          textStart = i;
          continue;
        }
      }
    }

    // Link [text](href "title")
    if (text[i] === "[") {
      const textEnd = findClosingBracket(text, i);
      if (textEnd !== -1 && text[textEnd + 1] === "(") {
        const hrefEnd = text.indexOf(")", textEnd + 2);
        if (hrefEnd !== -1) {
          pushText(i);
          const linkText = text.slice(i + 1, textEnd);
          const hrefPart = text.slice(textEnd + 2, hrefEnd);
          const titleMatch = hrefPart.match(/^(.+?)\s+"(.+)"$/);
          if (titleMatch) {
            tokens.push({
              type: "link",
              href: titleMatch[1],
              title: titleMatch[2],
              children: parseInline(linkText),
            });
          } else {
            tokens.push({
              type: "link",
              href: hrefPart,
              children: parseInline(linkText),
            });
          }
          i = hrefEnd + 1;
          textStart = i;
          continue;
        }
      }
    }

    // Autolink <url>
    if (text[i] === "<") {
      const endAngle = text.indexOf(">", i + 1);
      if (endAngle !== -1) {
        const content = text.slice(i + 1, endAngle);
        if (content.match(/^https?:\/\/\S+$/)) {
          pushText(i);
          tokens.push({
            type: "link",
            href: content,
            children: [{ type: "text", content }],
          });
          i = endAngle + 1;
          textStart = i;
          continue;
        }
      }
    }

    // Highlight ==text==
    if (text.slice(i, i + 2) === "==") {
      const end = text.indexOf("==", i + 2);
      if (end !== -1) {
        pushText(i);
        tokens.push({
          type: "highlight",
          children: parseInline(text.slice(i + 2, end)),
        });
        i = end + 2;
        textStart = i;
        continue;
      }
    }

    // Strikethrough ~~text~~
    if (text.slice(i, i + 2) === "~~") {
      const end = text.indexOf("~~", i + 2);
      if (end !== -1) {
        pushText(i);
        tokens.push({
          type: "strikethrough",
          children: parseInline(text.slice(i + 2, end)),
        });
        i = end + 2;
        textStart = i;
        continue;
      }
    }

    // Bold+Italic ***text*** or ___text___
    if (
      (text.slice(i, i + 3) === "***" || text.slice(i, i + 3) === "___") &&
      text[i + 3] !== " "
    ) {
      const delim = text.slice(i, i + 3);
      const end = findDelimiter(text, delim, i + 3);
      if (end !== -1) {
        pushText(i);
        tokens.push({
          type: "bold_italic",
          children: parseInline(text.slice(i + 3, end)),
        });
        i = end + 3;
        textStart = i;
        continue;
      }
    }

    // Bold **text** or __text__
    if (
      (text.slice(i, i + 2) === "**" || text.slice(i, i + 2) === "__") &&
      text[i + 2] !== " "
    ) {
      const delim = text.slice(i, i + 2);
      const end = findDelimiter(text, delim, i + 2);
      if (end !== -1) {
        pushText(i);
        tokens.push({
          type: "bold",
          children: parseInline(text.slice(i + 2, end)),
        });
        i = end + 2;
        textStart = i;
        continue;
      }
    }

    // Italic *text* or _text_
    if ((text[i] === "*" || text[i] === "_") && text[i + 1] !== " ") {
      const delim = text[i];
      const end = findDelimiter(text, delim, i + 1);
      if (end !== -1 && text[end - 1] !== " ") {
        pushText(i);
        tokens.push({
          type: "italic",
          children: parseInline(text.slice(i + 1, end)),
        });
        i = end + 1;
        textStart = i;
        continue;
      }
    }

    // Inline code `code`
    if (text[i] === "`") {
      // Handle double backticks ``code``
      const isDouble = text[i + 1] === "`";
      const delim = isDouble ? "``" : "`";
      const start = i + delim.length;
      const end = text.indexOf(delim, start);
      if (end !== -1) {
        pushText(i);
        tokens.push({ type: "code", content: text.slice(start, end) });
        i = end + delim.length;
        textStart = i;
        continue;
      }
    }

    i++;
  }

  pushText(text.length);

  // Merge adjacent text tokens
  return mergeTextTokens(tokens);
}

function findClosingBracket(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findDelimiter(text: string, delim: string, start: number): number {
  let i = start;
  while (i < text.length) {
    const idx = text.indexOf(delim, i);
    if (idx === -1) return -1;
    // Check it's not escaped
    if (text[idx - 1] !== "\\") return idx;
    i = idx + 1;
  }
  return -1;
}

function mergeTextTokens(tokens: InlineToken[]): InlineToken[] {
  const result: InlineToken[] = [];
  for (const token of tokens) {
    if (
      token.type === "text" &&
      result.length > 0 &&
      result[result.length - 1].type === "text"
    ) {
      (result[result.length - 1] as { type: "text"; content: string }).content +=
        token.content;
    } else {
      result.push(token);
    }
  }
  return result;
}

// =============================================================================
// Block Parser
// =============================================================================

function parseBlocks(lines: string[]): BlockToken[] {
  const tokens: BlockToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line - skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      tokens.push({ type: "horizontal_rule" });
      i++;
      continue;
    }

    // Heading (ATX style)
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    if (headingMatch) {
      tokens.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith("```") || line.startsWith("~~~")) {
      const fence = line.slice(0, 3);
      const language = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      tokens.push({
        type: "code_block",
        language,
        content: codeLines.join("\n"),
      });
      i++; // Skip closing fence
      continue;
    }

    // Callout (Obsidian) > [!type]+ Title
    const calloutMatch = line.match(/^>\s*\[!(\w+)\]([-+])?\s*(.*)$/);
    if (calloutMatch) {
      const kind = calloutMatch[1].toLowerCase();
      const foldable = calloutMatch[2] === "-" || calloutMatch[2] === "+";
      const title = calloutMatch[3] || undefined;
      const calloutLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].startsWith(">")) {
        calloutLines.push(lines[i].slice(1).trimStart());
        i++;
      }
      tokens.push({
        type: "callout",
        kind,
        title,
        foldable,
        children: parseBlocks(calloutLines),
      });
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].slice(1).trimStart());
        i++;
      }
      tokens.push({
        type: "blockquote",
        children: parseBlocks(quoteLines),
      });
      continue;
    }

    // Table
    if (line.includes("|")) {
      const tableResult = tryParseTable(lines, i);
      if (tableResult) {
        tokens.push(tableResult.token);
        i = tableResult.endIndex;
        continue;
      }
    }

    // List (ordered or unordered)
    const listMatch = line.match(/^(\s*)(-|\*|\+|\d+\.)\s/);
    if (listMatch) {
      const listResult = parseList(lines, i);
      tokens.push(listResult.token);
      i = listResult.endIndex;
      continue;
    }

    // HTML block
    if (line.trim().startsWith("<") && isHtmlBlock(line)) {
      const htmlLines: string[] = [line];
      i++;
      // Collect until we hit a blank line or end
      while (i < lines.length && lines[i].trim() !== "") {
        htmlLines.push(lines[i]);
        i++;
      }
      tokens.push({ type: "html", content: htmlLines.join("\n") });
      continue;
    }

    // Paragraph - collect lines until blank line or block element
    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      const currentLine = lines[i];

      // Check if this could be a setext heading underline
      if (paragraphLines.length > 0 && /^(=+|-+)$/.test(currentLine.trim())) {
        paragraphLines.push(currentLine);
        i++;
        break; // We have a setext heading, stop collecting
      }

      // Stop if we hit a block start (but not setext underlines, handled above)
      if (isBlockStart(currentLine)) {
        break;
      }

      paragraphLines.push(currentLine);
      i++;
    }
    if (paragraphLines.length > 0) {
      // Check for setext heading
      if (paragraphLines.length >= 2) {
        const lastLine = paragraphLines[paragraphLines.length - 1];
        if (/^=+$/.test(lastLine)) {
          tokens.push({
            type: "heading",
            level: 1,
            children: parseInline(paragraphLines.slice(0, -1).join(" ")),
          });
          continue;
        }
        if (/^-+$/.test(lastLine)) {
          tokens.push({
            type: "heading",
            level: 2,
            children: parseInline(paragraphLines.slice(0, -1).join(" ")),
          });
          continue;
        }
      }

      tokens.push({
        type: "paragraph",
        children: parseInline(paragraphLines.join("\n")),
      });
    }
  }

  return tokens;
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,6}\s/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim()) ||
    line.startsWith("```") ||
    line.startsWith("~~~") ||
    line.startsWith(">") ||
    /^(\s*)(-|\*|\+|\d+\.)\s/.test(line) ||
    (line.includes("|") && line.trim().startsWith("|"))
  );
}

function isHtmlBlock(line: string): boolean {
  const trimmed = line.trim();
  const htmlTags = [
    "address",
    "article",
    "aside",
    "base",
    "basefont",
    "blockquote",
    "body",
    "caption",
    "center",
    "col",
    "colgroup",
    "dd",
    "details",
    "dialog",
    "dir",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "frame",
    "frameset",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hr",
    "html",
    "iframe",
    "legend",
    "li",
    "link",
    "main",
    "menu",
    "menuitem",
    "nav",
    "noframes",
    "ol",
    "optgroup",
    "option",
    "p",
    "param",
    "section",
    "source",
    "summary",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "title",
    "tr",
    "track",
    "ul",
  ];
  const match = trimmed.match(/^<(\/?)([\w-]+)/);
  if (match) {
    return htmlTags.includes(match[2].toLowerCase());
  }
  return false;
}

function tryParseTable(
  lines: string[],
  start: number
): { token: BlockToken; endIndex: number } | null {
  if (start + 1 >= lines.length) return null;

  const headerLine = lines[start];
  const delimiterLine = lines[start + 1];

  // Check delimiter line format: | --- | --- | or --- | ---
  if (!/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(delimiterLine)) {
    return null;
  }

  const parseRow = (line: string): string[] => {
    // Remove leading/trailing pipes and split
    return line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
  };

  const headerCells = parseRow(headerLine);
  const delimiterCells = parseRow(delimiterLine);

  if (headerCells.length !== delimiterCells.length) return null;

  // Parse alignments
  const alignments: Array<"left" | "center" | "right" | undefined> =
    delimiterCells.map((cell) => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      if (left) return "left";
      return undefined;
    });

  const header: TableCell[] = headerCells.map((cell, idx) => ({
    align: alignments[idx],
    children: parseInline(cell),
  }));

  const rows: TableCell[][] = [];
  let i = start + 2;

  while (i < lines.length && lines[i].includes("|")) {
    const rowCells = parseRow(lines[i]);
    rows.push(
      rowCells.map((cell, idx) => ({
        align: alignments[idx],
        children: parseInline(cell),
      }))
    );
    i++;
  }

  return {
    token: { type: "table", header, rows },
    endIndex: i,
  };
}

function parseList(
  lines: string[],
  start: number
): { token: BlockToken; endIndex: number } {
  const firstLine = lines[start];
  const match = firstLine.match(/^(\s*)(-|\*|\+|(\d+)\.)\s(.*)$/);
  if (!match) {
    return {
      token: { type: "list", ordered: false, items: [] },
      endIndex: start + 1,
    };
  }

  const baseIndent = match[1].length;
  const ordered = /^\d+\.$/.test(match[2]);
  const startNum = ordered ? parseInt(match[3] || "1") : undefined;
  const items: ListItem[] = [];

  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const itemMatch = line.match(/^(\s*)(-|\*|\+|\d+\.)\s(.*)$/);

    if (itemMatch && itemMatch[1].length === baseIndent) {
      // New item at same level
      const content = itemMatch[3];
      const itemLines: string[] = [content];

      // Check for task list
      const taskMatch = content.match(/^\[([ xX])\]\s(.*)$/);
      const checked = taskMatch
        ? taskMatch[1].toLowerCase() === "x"
        : undefined;
      const actualContent = taskMatch ? taskMatch[2] : content;

      i++;
      // Collect continuation lines
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trim() === "") {
          // Check if next non-empty line continues this item
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === "") j++;
          if (j < lines.length) {
            const futureMatch = lines[j].match(/^(\s*)(-|\*|\+|\d+\.)\s/);
            if (futureMatch && futureMatch[1].length <= baseIndent) {
              break; // New item at same or outer level
            }
            if (lines[j].match(/^\s+/)) {
              // Continuation
              i = j;
              continue;
            }
          }
          break;
        }

        const nextItemMatch = nextLine.match(/^(\s*)(-|\*|\+|\d+\.)\s/);
        if (nextItemMatch) {
          if (nextItemMatch[1].length <= baseIndent) {
            break; // New item at same or outer level
          }
          // Nested list - include it
          itemLines.push(nextLine.slice(baseIndent + 2));
        } else if (nextLine.startsWith(" ".repeat(baseIndent + 2))) {
          // Continuation of item
          itemLines.push(nextLine.slice(baseIndent + 2));
        } else {
          break;
        }
        i++;
      }

      const children = parseBlocks(
        taskMatch ? [actualContent, ...itemLines.slice(1)] : itemLines
      );
      items.push({ checked, children });
    } else if (line.trim() === "") {
      i++;
    } else {
      break;
    }
  }

  return {
    token: { type: "list", ordered, start: startNum, items },
    endIndex: i,
  };
}

// =============================================================================
// Main Parser
// =============================================================================

export function parse(markdown: string): ParseResult {
  const { frontmatter, content } = parseFrontmatter(markdown);
  const lines = content.split("\n");
  const tokens = parseBlocks(lines);

  return { frontmatter, tokens };
}

// =============================================================================
// Generic Renderer
// =============================================================================

function renderInlineToken<T>(
  token: InlineToken,
  renderer: Renderer<T>,
  ctx: RenderContext<T>
): T {
  switch (token.type) {
    case "text":
      return renderer.inline.text(token.content, ctx);
    case "bold":
      return renderer.inline.bold(token.children, ctx);
    case "italic":
      return renderer.inline.italic(token.children, ctx);
    case "bold_italic":
      return renderer.inline.bold_italic(token.children, ctx);
    case "strikethrough":
      return renderer.inline.strikethrough(token.children, ctx);
    case "highlight":
      return renderer.inline.highlight(token.children, ctx);
    case "code":
      return renderer.inline.code(token.content, ctx);
    case "link":
      return renderer.inline.link(token.href, token.title, token.children, ctx);
    case "image":
      return renderer.inline.image(token.src, token.alt, token.title, ctx);
    case "wikilink":
      return renderer.inline.wikilink(token.target, token.display, ctx);
    case "embed":
      return renderer.inline.embed(token.target, ctx);
    case "linebreak":
      return renderer.inline.linebreak(ctx);
  }
}

function renderBlockToken<T>(
  token: BlockToken,
  renderer: Renderer<T>,
  ctx: RenderContext<T>
): T {
  switch (token.type) {
    case "paragraph":
      return renderer.block.paragraph(token.children, ctx);
    case "heading":
      return renderer.block.heading(token.level, token.children, ctx);
    case "code_block":
      return renderer.block.code_block(token.content, token.language, ctx);
    case "blockquote":
      return renderer.block.blockquote(token.children, ctx);
    case "callout":
      return renderer.block.callout(
        token.kind,
        token.title,
        token.foldable,
        token.children,
        ctx
      );
    case "list":
      return renderer.block.list(token.ordered, token.start, token.items, ctx);
    case "table":
      return renderer.block.table(token.header, token.rows, ctx);
    case "horizontal_rule":
      return renderer.block.horizontal_rule(ctx);
    case "html":
      return renderer.block.html(token.content, ctx);
  }
}

/**
 * Render parsed markdown using a custom renderer
 */
export function render<T>(result: ParseResult, renderer: Renderer<T>): T {
  const ctx: RenderContext<T> = {
    renderInline: (tokens) =>
      renderer.join(tokens.map((t) => renderInlineToken(t, renderer, ctx))),
    renderBlocks: (tokens) =>
      renderer.join(tokens.map((t) => renderBlockToken(t, renderer, ctx))),
  };

  return ctx.renderBlocks(result.tokens);
}
