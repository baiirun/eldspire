import { oscTables, type OscTableKey } from "@/data/osc-tables";

export const characterFields = [
  "background",
  "practice",
  "relationship",
  "appearance",
  "vice",
  "haven",
  "nostalgicObject",
  "normalTrinket",
  "weirdTrinket",
  "complication",
  "firstBrush",
] as const;

export type CharacterField = (typeof characterFields)[number];

const fieldTables = {
  background: "backgrounds",
  practice: "practices",
  relationship: "relationships",
  appearance: "appearances",
  vice: "vices",
  haven: "havens",
  nostalgicObject: "nostalgicObjects",
  normalTrinket: "normalTrinkets",
  weirdTrinket: "weirdTrinkets",
  complication: "complications",
  firstBrush: "firstBrushes",
} as const satisfies Record<CharacterField, OscTableKey>;

export type RatedFeature = {
  name: string;
  rating: number;
};

export type GeneratedCharacter = Record<CharacterField, string> & {
  traits: RatedFeature[];
  rolls: Record<CharacterField, number>;
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

function draw(field: CharacterField, randomIndex: RandomIndex) {
  const table = oscTables[fieldTables[field]];
  const index = randomIndex(table.length);

  if (!Number.isInteger(index) || index < 0 || index >= table.length) {
    throw new RangeError(`Random index ${index} is invalid for ${field}`);
  }

  return { value: table[index], roll: index + 1 };
}

export function drawTraits(randomIndex: RandomIndex): RatedFeature[] {
  const pool = [...oscTables.traits];

  return [2, 1, 1].map((rating) => {
    const index = randomIndex(pool.length);
    if (!Number.isInteger(index) || index < 0 || index >= pool.length) {
      throw new RangeError(`Random index ${index} is invalid for traits`);
    }
    return { name: pool.splice(index, 1)[0], rating };
  });
}

export function generateCharacter(
  randomIndex: RandomIndex = cryptoRandomIndex,
): GeneratedCharacter {
  const values = {} as Record<CharacterField, string>;
  const rolls = {} as Record<CharacterField, number>;

  for (const field of characterFields) {
    const result = draw(field, randomIndex);
    values[field] = result.value;
    rolls[field] = result.roll;
  }

  return { ...values, rolls, traits: drawTraits(randomIndex) };
}

export function rerollField(
  character: GeneratedCharacter,
  field: CharacterField,
  randomIndex: RandomIndex = cryptoRandomIndex,
): GeneratedCharacter {
  const result = draw(field, randomIndex);
  return {
    ...character,
    [field]: result.value,
    rolls: { ...character.rolls, [field]: result.roll },
  };
}

export function characterMarkdown(character: GeneratedCharacter): string {
  const traits = character.traits
    .map((trait) => `- ${trait.name} ${trait.rating}`)
    .join("\n");

  return `# OSC Agent

## Background

- ${character.background}

## Rated Character Features

- Professional Practice: ${character.practice} 2
- Relationship: ${character.relationship} 2

## Traits

${traits}

## Character Texture

- Appearance: ${character.appearance}
- Vice: ${character.vice}
- Haven: ${character.haven}
- Nostalgic Object: ${character.nostalgicObject}
- Normal Trinket: ${character.normalTrinket}
- Optional Weird Trinket: ${character.weirdTrinket}

## Case File

- Complication: ${character.complication}
- First Brush With The Impossible: ${character.firstBrush}

## Pressure

- Current Stress: 0
- Stress Floor: 0
- Conditions:
`;
}
