import tableSource from "../content/osc-character-tables.md?raw";

const tableSections = {
  traits: "d100 Traits",
  backgrounds: "Backgrounds",
  practices: "Professional Practice",
  relationships: "Relationships",
  appearances: "Appearances",
  vices: "Vices",
  havens: "Havens And Homes",
  nostalgicObjects: "Nostalgic Objects",
  normalTrinkets: "Normal Trinkets",
  complications: "Complications, Debts, And Obligations",
  firstBrushes: "First Brush With The Impossible",
} as const;

export type OscTableKey = keyof typeof tableSections;

function parseTable(section: string): readonly string[] {
  const start = tableSource.indexOf(`## ${section}`);
  if (start < 0) throw new Error(`Missing OSC table section: ${section}`);

  const nextHeading = tableSource.indexOf("\n## ", start + 3);
  const body = tableSource.slice(start, nextHeading < 0 ? undefined : nextHeading);
  const entries = new Map<number, string>();

  for (const line of body.split("\n")) {
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

export const oscTables = Object.fromEntries(
  Object.entries(tableSections).map(([key, section]) => [key, parseTable(section)]),
) as { readonly [Key in OscTableKey]: readonly string[] };
