import {
  cyberspireActions,
  cyberspireTables,
  type CyberspireTableKey,
} from "@/data/cyberspire-tables";

export type Die = "d6" | "d8" | "d10" | "d12";

/** Actions that keep their Eldspire names until Cyberspire names are chosen. */
export const placeholderActions: ReadonlySet<string> = new Set([
  "Survey",
  "Study",
  "Sway",
  "Command",
]);

const actionDice: readonly Die[] = ["d10", "d10", "d8", "d8", "d8"];
const traitDie: Die = "d8";
const bondDie: Die = "d8";
export const debtDie: Die = "d6";

export const singleFields = [
  "background",
  "haven",
  "debt",
  "comfort",
  "keepsake",
  "mundaneItem",
] as const;

export type SingleField = (typeof singleFields)[number];
export type CharacterField = SingleField | "actions" | "traits" | "bonds";

export const characterFields: readonly CharacterField[] = [
  "background",
  "actions",
  "traits",
  "bonds",
  ...singleFields.slice(1),
];

const fieldTables = {
  background: "backgrounds",
  haven: "havens",
  debt: "debts",
  comfort: "comforts",
  keepsake: "keepsakes",
  mundaneItem: "mundaneItems",
} as const satisfies Record<SingleField, CyberspireTableKey>;

export type RatedEntry = { name: string; die: Die };

export type GeneratedCharacter = Record<SingleField, string> & {
  actions: RatedEntry[];
  traits: RatedEntry[];
  bonds: RatedEntry[];
};

export type RandomIndex = (upperBound: number) => number;

export function cryptoRandomIndex(upperBound: number): number {
  if (!Number.isInteger(upperBound) || upperBound <= 0) {
    throw new RangeError("upperBound must be a positive integer");
  }

  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % upperBound;
}

function takeFrom<T>(pool: T[], randomIndex: RandomIndex): T {
  const index = randomIndex(pool.length);
  if (!Number.isInteger(index) || index < 0 || index >= pool.length) {
    throw new RangeError(`Random index ${index} is invalid for a pool of ${pool.length}`);
  }
  return pool.splice(index, 1)[0];
}

function drawActions(randomIndex: RandomIndex): RatedEntry[] {
  const pool = [...cyberspireActions];
  const dice = new Map<string, Die>();
  for (const die of actionDice) dice.set(takeFrom(pool, randomIndex), die);
  return cyberspireActions.map((name) => ({ name, die: dice.get(name) ?? "d6" }));
}

function drawMany(table: readonly string[], count: number, die: Die, randomIndex: RandomIndex) {
  const pool = [...table];
  return Array.from({ length: count }, () => ({ name: takeFrom(pool, randomIndex), die }));
}

const rollers: { [Field in CharacterField]: (randomIndex: RandomIndex) => GeneratedCharacter[Field] } = {
  background: (r) => takeFrom([...cyberspireTables[fieldTables.background]], r),
  actions: drawActions,
  traits: (r) => drawMany(cyberspireTables.traits, 4, traitDie, r),
  bonds: (r) => drawMany(cyberspireTables.bonds, 2, bondDie, r),
  haven: (r) => takeFrom([...cyberspireTables[fieldTables.haven]], r),
  debt: (r) => takeFrom([...cyberspireTables[fieldTables.debt]], r),
  comfort: (r) => takeFrom([...cyberspireTables[fieldTables.comfort]], r),
  keepsake: (r) => takeFrom([...cyberspireTables[fieldTables.keepsake]], r),
  mundaneItem: (r) => takeFrom([...cyberspireTables[fieldTables.mundaneItem]], r),
};

export function generateCharacter(
  randomIndex: RandomIndex = cryptoRandomIndex,
): GeneratedCharacter {
  const character = {} as Record<CharacterField, unknown>;
  for (const field of characterFields) character[field] = rollers[field](randomIndex);
  return character as GeneratedCharacter;
}

export function rerollField(
  character: GeneratedCharacter,
  field: CharacterField,
  randomIndex: RandomIndex = cryptoRandomIndex,
): GeneratedCharacter {
  return { ...character, [field]: rollers[field](randomIndex) };
}

export function phrase(value: string): string {
  const trimmed = value.replace(/\.$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

export function characterSummary(c: GeneratedCharacter): string {
  return `This survivor carries the background ${c.background} and comes home to ${phrase(c.haven)}. They remain tied to ${phrase(c.bonds[0].name)} and ${phrase(c.bonds[1].name)}, and owe ${phrase(c.debt)}.`;
}

export function characterMarkdown(c: GeneratedCharacter): string {
  const list = (entries: RatedEntry[]) =>
    entries.map((entry) => `- ${entry.name.replace(/\.$/, "")} ${entry.die}`).join("\n");

  return `# Cyberspire Character

${characterSummary(c)}

## Background

- ${c.background}

## Actions

${list(c.actions)}

## Traits

${list(c.traits)}

## Bonds

${list(c.bonds)}

## Haven and Debt

- Haven: ${c.haven}
- Debt: ${c.debt.replace(/\.$/, "")} ${debtDie}

## Texture

- Keepsake: ${c.keepsake}
- Mundane Item: ${c.mundaneItem}
- Vice/Comfort: ${c.comfort}

## Stress and Wounds

- Stress: 0
- Wounds: ☐ ☐ ☐
`;
}
