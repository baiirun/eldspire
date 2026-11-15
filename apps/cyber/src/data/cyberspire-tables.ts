import tableSource from "../content/cyberspire-character-tables.md?raw";

const tableSections = {
  traits: "Traits",
  backgrounds: "Backgrounds",
  bonds: "Bonds",
  havens: "Havens",
  debts: "Debts",
  comforts: "Vice/Comfort",
  keepsakes: "Keepsakes",
  mundaneItems: "Mundane Items",
} as const;

export type CyberspireTableKey = keyof typeof tableSections;

function sectionBody(section: string): string {
  const start = tableSource.indexOf(`\n## ${section}\n`);
  if (start < 0) throw new Error(`Missing Cyberspire table section: ${section}`);

  const nextHeading = tableSource.indexOf("\n## ", start + 4);
  return tableSource.slice(start, nextHeading < 0 ? undefined : nextHeading);
}

function parseTable(section: string): readonly string[] {
  const entries = new Map<number, string>();

  for (const line of sectionBody(section).split("\n")) {
    const match = line.match(/^\|\s*(\d{1,3})\s*\|\s*(.*?)\s*\|\s*$/);
    if (!match) continue;
    entries.set(Number(match[1]), match[2]);
  }

  const values = [...entries.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, value]) => value);

  if (values.length !== 100) {
    throw new Error(`Expected 100 entries in ${section}, found ${values.length}`);
  }

  return values;
}

function parseActions(): readonly string[] {
  const line = sectionBody("Actions")
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.includes(",") && !entry.endsWith("."));

  if (!line) throw new Error("Missing Cyberspire Action list");
  return line.split(",").map((action) => action.trim());
}

export const cyberspireActions = parseActions();

export const cyberspireTables = Object.fromEntries(
  Object.entries(tableSections).map(([key, section]) => [key, parseTable(section)]),
) as { readonly [Key in CyberspireTableKey]: readonly string[] };
