import { eldspireTables, type EldspireTableKey } from "@/data/eldspire-tables";

export const characterFields = [
  "background",
  "archetype",
  "hearthTie",
  "roadTie",
  "appearance",
  "keepsake",
  "mundaneItem",
  "comfort",
] as const;

export type CharacterField = (typeof characterFields)[number];

const fieldTables = {
  background: "backgrounds",
  archetype: "archetypes",
  hearthTie: "hearthTies",
  roadTie: "roadTies",
  appearance: "appearances",
  keepsake: "keepsakes",
  mundaneItem: "mundaneItems",
  comfort: "comforts",
} as const satisfies Record<CharacterField, EldspireTableKey>;

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
  const table = eldspireTables[fieldTables[field]];
  const index = randomIndex(table.length);

  if (!Number.isInteger(index) || index < 0 || index >= table.length) {
    throw new RangeError(`Random index ${index} is invalid for ${field}`);
  }

  return { value: table[index], roll: index + 1 };
}

export function drawTraits(randomIndex: RandomIndex): RatedFeature[] {
  const pool = [...eldspireTables.traits];

  return [2, 1, 1, 1].map((rating) => {
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

  return {
    ...values,
    rolls,
    traits: drawTraits(randomIndex),
  };
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

function sentence(value: string): string {
  return value.replace(/\.$/, "");
}

export function characterMarkdown(character: GeneratedCharacter): string {
  const traitLines = character.traits
    .map((trait) => `- ${trait.name} ${trait.rating}`)
    .join("\n");

  return `# Generated Expedition Character

This traveler carries the background ${sentence(character.background)} and moves through the world as a ${sentence(character.archetype).toLowerCase()}. They are ${sentence(character.appearance).toLowerCase()}, remain tied to ${sentence(character.hearthTie).toLowerCase()}, and trust ${sentence(character.roadTie).toLowerCase()} on the road.

## Character Features

- Archetype: ${character.archetype} 2

## Traits

${traitLines}

## Texture

- Background: ${character.background}
- Appearance: ${character.appearance}
- Hearth Tie: ${character.hearthTie}
- Road Tie: ${character.roadTie}
- Keepsake: ${character.keepsake}
- Mundane Item: ${character.mundaneItem}
- Comfort: ${character.comfort}

## Starting Pressure

- Current Fatigue: 0
`;
}
