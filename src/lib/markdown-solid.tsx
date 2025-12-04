/**
 * Solid.js Renderer for Obsidian-flavored Markdown
 *
 * Creates a Renderer<JSX.Element> that can be passed to the render() function.
 * Uses TanStack Router's <Link /> for internal navigation.
 */

import type { JSX } from "solid-js";
import { Link } from "@tanstack/solid-router";
import { InternalLink } from "@/components/InternalLink";
import {
  parse,
  render,
  type ParseResult,
  type Renderer,
  type InlineToken,
  type BlockToken,
  type ListItem,
  type TableCell,
  type RenderContext,
} from "./markdown";

// =============================================================================
// Renderer Factory Types
// =============================================================================

type Ctx = RenderContext<JSX.Element>;

/**
 * Configuration for creating a Solid renderer
 */
export type SolidRendererConfig = {
  /**
   * Base path for wikilink URLs
   * @default "/pages"
   */
  wikiLinkBasePath?: string;

  /**
   * Custom renderers for specific elements (override defaults)
   */
  overrides?: Partial<{
    // Inline
    text: (content: string, ctx: Ctx) => JSX.Element;
    bold: (children: InlineToken[], ctx: Ctx) => JSX.Element;
    italic: (children: InlineToken[], ctx: Ctx) => JSX.Element;
    bold_italic: (children: InlineToken[], ctx: Ctx) => JSX.Element;
    strikethrough: (children: InlineToken[], ctx: Ctx) => JSX.Element;
    highlight: (children: InlineToken[], ctx: Ctx) => JSX.Element;
    code: (content: string, ctx: Ctx) => JSX.Element;
    link: (
      href: string,
      title: string | undefined,
      children: InlineToken[],
      ctx: Ctx
    ) => JSX.Element;
    image: (
      src: string,
      alt: string,
      title: string | undefined,
      ctx: Ctx
    ) => JSX.Element;
    wikilink: (
      target: string,
      display: string | undefined,
      ctx: Ctx
    ) => JSX.Element;
    embed: (target: string, ctx: Ctx) => JSX.Element;
    linebreak: (ctx: Ctx) => JSX.Element;

    // Block
    paragraph: (children: InlineToken[], ctx: Ctx) => JSX.Element;
    heading: (
      level: 1 | 2 | 3 | 4 | 5 | 6,
      children: InlineToken[],
      ctx: Ctx
    ) => JSX.Element;
    code_block: (
      content: string,
      language: string | undefined,
      ctx: Ctx
    ) => JSX.Element;
    blockquote: (children: BlockToken[], ctx: Ctx) => JSX.Element;
    callout: (
      kind: string,
      title: string | undefined,
      foldable: boolean,
      children: BlockToken[],
      ctx: Ctx
    ) => JSX.Element;
    list: (
      ordered: boolean,
      start: number | undefined,
      items: ListItem[],
      ctx: Ctx
    ) => JSX.Element;
    list_item: (
      checked: boolean | undefined,
      children: BlockToken[],
      ctx: Ctx
    ) => JSX.Element;
    table: (
      header: TableCell[],
      rows: TableCell[][],
      ctx: Ctx
    ) => JSX.Element;
    table_cell: (
      children: InlineToken[],
      align: "left" | "center" | "right" | undefined,
      isHeader: boolean,
      ctx: Ctx
    ) => JSX.Element;
    horizontal_rule: (ctx: Ctx) => JSX.Element;
    html: (content: string, ctx: Ctx) => JSX.Element;
  }>;
};

// =============================================================================
// Default Renderers
// =============================================================================

function createDefaultInlineRenderers(
  config: SolidRendererConfig
): Renderer<JSX.Element>["inline"] {
  const basePath = config.wikiLinkBasePath ?? "/pages";

  return {
    text: (content) => <>{content}</>,

    bold: (children, ctx) => <strong>{ctx.renderInline(children)}</strong>,

    italic: (children, ctx) => <em>{ctx.renderInline(children)}</em>,

    bold_italic: (children, ctx) => (
      <strong>
        <em>{ctx.renderInline(children)}</em>
      </strong>
    ),

    strikethrough: (children, ctx) => <del>{ctx.renderInline(children)}</del>,

    highlight: (children, ctx) => <mark>{ctx.renderInline(children)}</mark>,

    code: (content) => <code>{content}</code>,

    link: (href, title, children, ctx) => {
      const isExternal =
        href.startsWith("http://") || href.startsWith("https://");

      if (isExternal) {
        return (
          <a href={href} title={title} target="_blank" rel="noopener noreferrer">
            {ctx.renderInline(children)}
          </a>
        );
      }

      return (
        <Link to={href} title={title}>
          {ctx.renderInline(children)}
        </Link>
      );
    },

    image: (src, alt, title) => <img src={src} alt={alt} title={title} />,

    wikilink: (target, display) => {
      const slug = target.toLowerCase().replace(/\s+/g, "-");
      const href = `${basePath}/${encodeURIComponent(slug)}`;

      return <InternalLink to={href}>{display ?? target}</InternalLink>;
    },

    embed: (target) => <div data-embed={target}>[Embedded: {target}]</div>,

    linebreak: () => <br />,
  };
}

function createDefaultBlockRenderers(
  _config: SolidRendererConfig
): Renderer<JSX.Element>["block"] {
  return {
    paragraph: (children, ctx) => <p>{ctx.renderInline(children)}</p>,

    heading: (level, children, ctx) => {
      const content = ctx.renderInline(children);
      switch (level) {
        case 1:
          return <h1>{content}</h1>;
        case 2:
          return <h2>{content}</h2>;
        case 3:
          return <h3>{content}</h3>;
        case 4:
          return <h4>{content}</h4>;
        case 5:
          return <h5>{content}</h5>;
        case 6:
          return <h6>{content}</h6>;
      }
    },

    code_block: (content, language) => (
      <pre>
        <code class={language ? `language-${language}` : undefined}>
          {content}
        </code>
      </pre>
    ),

    blockquote: (children, ctx) => (
      <blockquote>{ctx.renderBlocks(children)}</blockquote>
    ),

    callout: (kind, title, foldable, children, ctx) => (
      <aside data-callout={kind} data-foldable={foldable || undefined}>
        {title && <div data-callout-title>{title}</div>}
        <div data-callout-content>{ctx.renderBlocks(children)}</div>
      </aside>
    ),

    list: (ordered, start, items, ctx) => {
      const listItems = items.map((item) => (
        <li>
          {item.checked !== undefined && (
            <>
              <input type="checkbox" checked={item.checked} disabled />{" "}
            </>
          )}
          {ctx.renderBlocks(item.children)}
        </li>
      ));

      if (ordered) {
        return <ol start={start}>{listItems}</ol>;
      }
      return <ul>{listItems}</ul>;
    },

    list_item: (checked, children, ctx) => (
      <li>
        {checked !== undefined && (
          <>
            <input type="checkbox" checked={checked} disabled />{" "}
          </>
        )}
        {ctx.renderBlocks(children)}
      </li>
    ),

    table: (header, rows, ctx) => (
      <table>
        <thead>
          <tr>
            {header.map((cell) => (
              <th style={cell.align ? { "text-align": cell.align } : undefined}>
                {ctx.renderInline(cell.children)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr>
              {row.map((cell) => (
                <td
                  style={cell.align ? { "text-align": cell.align } : undefined}
                >
                  {ctx.renderInline(cell.children)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),

    table_cell: (children, align, isHeader, ctx) => {
      const style = align ? { "text-align": align } : undefined;
      const content = ctx.renderInline(children);

      if (isHeader) {
        return <th style={style}>{content}</th>;
      }
      return <td style={style}>{content}</td>;
    },

    horizontal_rule: () => <hr />,

    html: (content) => <div innerHTML={content} />,
  };
}

// =============================================================================
// Renderer Factory
// =============================================================================

/**
 * Create a Solid.js renderer with optional customizations
 *
 * @example
 * ```tsx
 * // Use defaults
 * const renderer = createSolidRenderer();
 *
 * // Customize wikilink path
 * const renderer = createSolidRenderer({
 *   wikiLinkBasePath: "/wiki"
 * });
 *
 * // Override specific elements
 * const renderer = createSolidRenderer({
 *   overrides: {
 *     heading: (level, children, ctx) => (
 *       <h1 class={`heading-${level}`}>{ctx.renderInline(children)}</h1>
 *     ),
 *     wikilink: (target, display, ctx) => (
 *       <MyCustomLink to={target}>{display ?? target}</MyCustomLink>
 *     )
 *   }
 * });
 * ```
 */
export function createSolidRenderer(
  config: SolidRendererConfig = {}
): Renderer<JSX.Element> {
  const defaultInline = createDefaultInlineRenderers(config);
  const defaultBlock = createDefaultBlockRenderers(config);
  const overrides = config.overrides ?? {};

  return {
    inline: {
      text: overrides.text ?? defaultInline.text,
      bold: overrides.bold ?? defaultInline.bold,
      italic: overrides.italic ?? defaultInline.italic,
      bold_italic: overrides.bold_italic ?? defaultInline.bold_italic,
      strikethrough: overrides.strikethrough ?? defaultInline.strikethrough,
      highlight: overrides.highlight ?? defaultInline.highlight,
      code: overrides.code ?? defaultInline.code,
      link: overrides.link ?? defaultInline.link,
      image: overrides.image ?? defaultInline.image,
      wikilink: overrides.wikilink ?? defaultInline.wikilink,
      embed: overrides.embed ?? defaultInline.embed,
      linebreak: overrides.linebreak ?? defaultInline.linebreak,
    },
    block: {
      paragraph: overrides.paragraph ?? defaultBlock.paragraph,
      heading: overrides.heading ?? defaultBlock.heading,
      code_block: overrides.code_block ?? defaultBlock.code_block,
      blockquote: overrides.blockquote ?? defaultBlock.blockquote,
      callout: overrides.callout ?? defaultBlock.callout,
      list: overrides.list ?? defaultBlock.list,
      list_item: overrides.list_item ?? defaultBlock.list_item,
      table: overrides.table ?? defaultBlock.table,
      table_cell: overrides.table_cell ?? defaultBlock.table_cell,
      horizontal_rule: overrides.horizontal_rule ?? defaultBlock.horizontal_rule,
      html: overrides.html ?? defaultBlock.html,
    },
    join: (outputs) => <>{outputs}</>,
  };
}

// =============================================================================
// Convenience Components
// =============================================================================

export type MarkdownProps = {
  /**
   * Parsed markdown result from parse()
   */
  content: ParseResult;

  /**
   * Renderer configuration
   */
  config?: SolidRendererConfig;

  /**
   * Container class name
   */
  class?: string;
};

/**
 * Render parsed markdown content
 *
 * @example
 * ```tsx
 * import { parse } from "@/lib/markdown";
 * import { Markdown } from "@/lib/markdown-solid";
 *
 * const content = parse(markdownString);
 * <Markdown content={content} />
 * ```
 */
export function Markdown(props: MarkdownProps): JSX.Element {
  const renderer = createSolidRenderer(props.config);
  return <div class={props.class}>{render(props.content, renderer)}</div>;
}

/**
 * Parse and render markdown in one step
 *
 * @example
 * ```tsx
 * import { MarkdownContent } from "@/lib/markdown-solid";
 *
 * <MarkdownContent markdown={markdownString} />
 * ```
 */
export function MarkdownContent(props: {
  markdown: string;
  config?: SolidRendererConfig;
  class?: string;
}): JSX.Element {
  const content = parse(props.markdown);
  return <Markdown content={content} config={props.config} class={props.class} />;
}

// Re-export for convenience
export { parse, render, type ParseResult, type Renderer };
