import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";

export interface Page {
  name: string;
  content: string;
  links: string[];
  backlinks: string[];
}

export interface SyncResult {
  created: number;
  updated: number;
  errors: string[];
}

/**
 * Check if content has the required tag for publishing.
 */
export function hasPublishTag(content: string, tag: string): boolean {
  const tagRegex = new RegExp(`#${tag}\\b`);
  return tagRegex.test(content);
}

/**
 * Strip all #tags from content
 */
export function stripTags(content: string): string {
  return content.replace(/#\w+/g, "").replace(/\n\s*\n\s*\n/g, "\n\n").trim();
}

/**
 * Strip DM-only sections marked with @@dm ... @@dm
 */
export function stripDmSections(content: string): string {
  return content.replace(/@@dm[\s\S]*?@@dm/g, "").replace(/\n\s*\n\s*\n/g, "\n\n").trim();
}

/**
 * Strip ID prefixes from wikilinks in content
 * [[04.99.06 Ashenport]] -> [[Ashenport]]
 * [[04.99.06 Ashenport|Custom Display]] -> [[Ashenport|Custom Display]]
 */
export function stripWikilinkPrefixes(content: string): string {
  return content.replace(/\[\[(\d+\.\d+\.\d+\s+)([^\]|]+)(\|[^\]]+)?\]\]/g, "[[$2$3]]");
}

/**
 * Extract wikilink targets from content
 * Returns unique page names that are linked to
 */
export function extractWikilinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  const links = new Set<string>();
  for (const match of matches) {
    links.add(match[1].trim());
  }
  return Array.from(links);
}

/**
 * Strip the numeric ID prefix from a filename to get the page name
 */
export function parseTitle(filename: string): string {
  // Remove .md extension
  const nameWithoutExt = filename.replace(/\.md$/, "");

  // Strip xx.xx.xx prefix with arbitrary length digits (e.g., "04.99.1234 Title" -> "Title")
  return nameWithoutExt.replace(/^\d+\.\d+\.\d+\s+/, "");
}

/**
 * Recursively find all markdown files in a directory
 */
export async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden directories and common non-content folders
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...(await findMarkdownFiles(fullPath)));
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Calculate backlinks for all pages, including siblings.
 * Backlinks include:
 * 1. Pages that link directly to this page
 * 2. Siblings: other pages linked from the same source page
 *    (e.g., if A links to B and C, then C is a sibling backlink for B)
 */
export function calculateBacklinks(pages: Page[]): void {
  // Build a map of page name -> forward links (normalized to lowercase)
  const pageLinksMap = new Map<string, string[]>();
  for (const page of pages) {
    pageLinksMap.set(page.name.toLowerCase(), page.links.map((l) => l.toLowerCase()));
  }

  // Build a set of valid page names for filtering
  const validPages = new Set(pages.map((p) => p.name.toLowerCase()));

  // For each page, collect backlinks
  for (const page of pages) {
    const targetName = page.name.toLowerCase();
    const backlinks = new Set<string>();

    // Find all pages that link to this page
    for (const [sourceName, sourceLinks] of pageLinksMap) {
      if (sourceLinks.includes(targetName)) {
        // Add the source as a backlink
        backlinks.add(sourceName);

        // Add siblings: other pages linked from the same source
        for (const sibling of sourceLinks) {
          if (sibling !== targetName && validPages.has(sibling)) {
            backlinks.add(sibling);
          }
        }
      }
    }

    // Convert back to original casing by finding matching pages
    const pageNameMap = new Map(pages.map((p) => [p.name.toLowerCase(), p.name]));
    page.backlinks = Array.from(backlinks)
      .map((name) => pageNameMap.get(name) ?? name)
      .sort();
  }
}

/**
 * Collect pages from the vault that should be synced
 */
export async function collectPages(vaultPath: string, publishTag: string): Promise<Page[]> {
  const pages: Page[] = [];
  const files = await findMarkdownFiles(vaultPath);

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");

    if (hasPublishTag(content, publishTag)) {
      const filename = basename(filePath);
      const name = parseTitle(filename);

      const processedContent = stripWikilinkPrefixes(stripDmSections(stripTags(content)));
      const links = extractWikilinks(processedContent);
      pages.push({ name, content: processedContent, links, backlinks: [] });
    }
  }

  // Calculate backlinks after all pages are collected
  calculateBacklinks(pages);

  return pages;
}

/**
 * Sync pages to the API endpoint
 */
export async function syncToApi(pages: Page[], apiUrl: string): Promise<SyncResult> {
  const response = await fetch(`${apiUrl}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pages }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${text}`);
  }

  return response.json();
}

// Default configuration (bundled into binary)
const DEFAULT_VAULT_PATH = "/Users/byronguina/Library/Mobile Documents/iCloud~md~obsidian/Documents/Zaum";
const DEFAULT_API_URL = "https://eldspire.com";
const DEFAULT_TAG = "wiki";

async function main() {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH ?? DEFAULT_VAULT_PATH;
  const publishTag = process.env.SYNC_TAG ?? DEFAULT_TAG;
  const apiUrl = process.env.SYNC_API_URL ?? DEFAULT_API_URL;

  // Check vault exists
  try {
    const stats = await stat(vaultPath);
    if (!stats.isDirectory()) {
      console.error(`Error: ${vaultPath} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: Cannot access vault at ${vaultPath}`);
    process.exit(1);
  }

  console.log(`Scanning vault: ${vaultPath}`);
  console.log(`Filtering by tag: #${publishTag}`);

  const pages = await collectPages(vaultPath, publishTag);

  console.log(`Found ${pages.length} pages to sync:`);
  for (const page of pages) {
    console.log(`  - ${page.name}`);
  }

  if (pages.length === 0) {
    console.log("No pages to sync.");
    return;
  }

  console.log(`\nSyncing to: ${apiUrl}`);
  const result = await syncToApi(pages, apiUrl);

  console.log("\nSync complete:");
  console.log(`  Created: ${result.created}`);
  console.log(`  Updated: ${result.updated}`);
  if (result.errors.length > 0) {
    console.log(`  Errors:`);
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
  }
}

// Only run main() when executed directly, not when imported
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("sync-vault.ts")) {
  main().catch((error) => {
    console.error("Sync failed:", error);
    process.exit(1);
  });
}
