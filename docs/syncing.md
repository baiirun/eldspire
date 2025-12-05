# Vault Syncing

This document describes the mechanism for syncing content from an Obsidian vault to the Eldspire database.

## Overview

The sync system publishes markdown pages from a local Obsidian vault to a Cloudflare D1 database. Pages are selectively published based on a configurable tag (default: `#wiki`), allowing you to control which notes become public.

## Architecture

```
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│  Obsidian Vault │   →    │  Sync Script    │   →    │  D1 Database    │
│  (Local Files)  │        │  (sync-vault.ts)│        │  (Cloudflare)   │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

**Source**: Obsidian vault on local filesystem
**Destination**: Cloudflare D1 `pages` table via `/api/sync` endpoint

## Data Model

### Page Structure

```typescript
interface Page {
  name: string;       // Page title (derived from filename)
  content: string;    // Processed markdown content
  links: string[];    // Outgoing wikilinks (used for backlink calculation)
  backlinks: string[];// Incoming links + sibling pages
  updatedAt: number;  // Unix timestamp from file modification time
}
```

### Database Schema

```sql
CREATE TABLE pages (
  id integer PRIMARY KEY AUTOINCREMENT,
  name text NOT NULL,
  content text,
  backlinks text,     -- JSON array of page names
  updated_at integer  -- Unix timestamp
);
```

## Sync Process

### 1. Collection Phase

The script scans the vault recursively for markdown files:

1. **Discovery**: Find all `.md` files (skips hidden directories and `node_modules`)
2. **Filtering**: Only include pages containing the publish tag (e.g., `#wiki`)
3. **Title Extraction**: Strip numeric prefixes from filenames (`04.99.06 Ashenport.md` → `Ashenport`)

### 2. Content Processing

Each page undergoes several transformations:

| Transformation | Example |
|----------------|---------|
| Strip tags | `#wiki #location` → *(removed)* |
| Strip DM sections | `@@dm secret info @@dm` → *(removed)* |
| Clean wikilink prefixes | `[[04.99.06 Ashenport]]` → `[[Ashenport]]` |
| Collapse whitespace | Multiple blank lines → single blank line |

### 3. Link Analysis

After collecting all pages, the script calculates relationships:

**Direct Backlinks**: If page A links to page B, then A appears in B's backlinks.

**Sibling Links**: If page A links to both B and C, then B and C are siblings. C appears in B's backlinks (and vice versa). This creates a broader web of related content.

```
Example:
  "Locations" links to → "Ashenport", "Thornwick"

Result:
  Ashenport.backlinks = ["Locations", "Thornwick"]
  Thornwick.backlinks = ["Locations", "Ashenport"]
```

### 4. API Sync

Pages are sent to `POST /api/sync` as a batch:

```json
{
  "pages": [
    {
      "name": "Ashenport",
      "content": "A coastal trading town...",
      "links": ["Thornwick", "The Pale"],
      "backlinks": ["Locations", "Thornwick"],
      "updatedAt": 1701234567
    }
  ]
}
```

The API performs an upsert operation:
- **Existing pages** (matched by lowercase name): Update content, backlinks, and timestamp
- **New pages**: Insert with all fields

All database operations execute in a single batch for efficiency.

## Configuration

The sync script accepts configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSIDIAN_VAULT_PATH` | `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Zaum` | Path to Obsidian vault |
| `SYNC_TAG` | `wiki` | Tag that marks pages for publishing |
| `SYNC_API_URL` | `https://eldspire.com` | API endpoint for sync |

## Running a Sync

```bash
# Using defaults
bun scripts/sync-vault.ts

# With custom configuration
OBSIDIAN_VAULT_PATH=/path/to/vault SYNC_TAG=publish bun scripts/sync-vault.ts
```

Output shows discovered pages and sync results:

```
Scanning vault: /path/to/vault
Filtering by tag: #wiki
Found 15 pages to sync:
  - Ashenport
  - Thornwick
  ...

Syncing to: https://eldspire.com

Sync complete:
  Created: 3
  Updated: 12
```

## Content Conventions

### Publish Tag

Add `#wiki` (or your configured tag) anywhere in a page to include it in sync:

```markdown
# Ashenport
#wiki #location

A coastal trading town known for its fish markets...
```

### DM-Only Content

Wrap content in `@@dm` markers to exclude it from the published version:

```markdown
# The Merchant

A wealthy trader in Ashenport.

@@dm
Secret: Actually a spy for the enemy faction.
The party will discover this in session 12.
@@dm
```

### Wikilinks

Standard Obsidian wikilinks work automatically. Numeric prefixes used for file organization are stripped:

```markdown
See also: [[04.99.06 Ashenport]]  →  Published as: [[Ashenport]]
```
