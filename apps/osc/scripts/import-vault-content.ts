import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultVault =
  "/Users/byronguina/Library/Mobile Documents/iCloud~md~obsidian/Documents/Zaum";
const vault = process.env.OSC_VAULT_PATH ?? defaultVault;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const output = join(scriptDirectory, "..", "src", "content");

const sources = {
  rules: join(vault, "Untitled TTRPG quickstart guide.md"),
  tables: join(vault, "Untitled TTRPG character creation tables.md"),
};

function publishableRules(markdown: string): string {
  const rulesHeading = "## How To Play OSC";
  const start = markdown.indexOf(rulesHeading);
  if (start < 0) throw new Error("OSC rules heading was not found");

  return [
    "<!-- Generated from Zaum/Untitled TTRPG quickstart guide.md. -->",
    markdown
      .slice(start)
      .replace(rulesHeading, "# OSC")
      .replace("## Page 2: GM", "## Running OSC")
      .trim(),
    "",
  ].join("\n");
}

async function main() {
  const [rules, tables] = await Promise.all([
    readFile(sources.rules, "utf8"),
    readFile(sources.tables, "utf8"),
  ]);

  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(join(output, "osc-rules.md"), publishableRules(rules)),
    writeFile(
      join(output, "osc-character-tables.md"),
      `<!-- Generated from Zaum/Untitled TTRPG character creation tables.md. -->\n${tables}`,
    ),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
