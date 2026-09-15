export type CharacterKitSeed = Readonly<{
  name: string;
  description: string;
}>;

export const backgroundKits = [
  {
    name: "Crossroads Inn",
    description: "Your household fed, housed, and overheard people passing through.",
  },
  {
    name: "Contested Border Town",
    description: "You grew up where borders and rulers changed before families did.",
  },
  {
    name: "Traveling Troupe",
    description: "Your household earned its supper from one audience and road to the next.",
  },
  {
    name: "Monastery Ward",
    description: "A religious house raised you amid bells, labor, and borrowed books.",
  },
  {
    name: "Exiled Noble House",
    description: "Your family lost its lands and power, but not its name, obligations, or enemies.",
  },
  {
    name: "War Camp",
    description: "Your childhood followed baggage trains, winter quarters, and marching armies.",
  },
  {
    name: "Quarry Settlement",
    description: "You were raised among stonecutters, dust, blasting, and dangerous slopes.",
  },
  {
    name: "Floodplain Village",
    description: "Your community lived by seasonal floods, river work, muddy roads, and shared stores.",
  },
  {
    name: "Merchant Ship",
    description: "You grew up aboard a working vessel among sailors, cargo, and foreign ports.",
  },
  {
    name: "Caravan Family",
    description: "Home was a moving company of wagons, livestock, traders, and hired guards.",
  },
  {
    name: "Debtors' Prison",
    description: "You shared confinement with a relative whose obligations became part of your life.",
  },
  {
    name: "Roadside Shrine",
    description: "You were raised tending a small sanctuary used by travelers and local families.",
  },
  {
    name: "Healer's Household",
    description: "Your home received the sick, injured, frightened, and indebted at every hour.",
  },
  {
    name: "Tollbridge",
    description: "Your household kept a crossing and dealt with everyone who needed the road beyond it.",
  },
  {
    name: "Horse-Trading Clan",
    description: "You traveled between seasonal markets with kin, herds, and negotiated loyalties.",
  },
  {
    name: "City Workhouse",
    description: "You were raised under strict rules among crowded bunks and compulsory labor.",
  },
  {
    name: "Lighthouse",
    description: "Your household kept a warning light where storms, wrecks, and isolation shaped every season.",
  },
  {
    name: "Charcoal Camp",
    description: "You spent long seasons in woodland camps tending slow fires and hauling fuel.",
  },
  {
    name: "Refugee Column",
    description: "Your people carried what they could while searching for somewhere permitted to become home.",
  },
  {
    name: "Market Quarter",
    description: "You belonged to a crowded district of stalls, workshops, warehouses, lodging houses, and public deals.",
  },
] as const satisfies readonly CharacterKitSeed[];

export const archetypeKits = [
  {
    name: "Old-Road Wayfinder",
    description: "You guide people and expeditions across dangerous country.",
  },
  {
    name: "Grizzled Hunter",
    description: "You track, stalk, trap, and harvest wild creatures.",
  },
  {
    name: "Red-Chalk Surveyor",
    description: "You measure ruins, passages, boundaries, and unstable ground.",
  },
  {
    name: "Bitter-Root Herbalist",
    description: "You gather and prepare plants as medicines, poisons, and provisions.",
  },
  {
    name: "Dented-Mail Armorer",
    description: "You make, fit, and repair the protection people trust with their lives.",
  },
  {
    name: "Roadside Priest",
    description: "You carry rites, counsel, and sacred obligations between scattered communities.",
  },
  {
    name: "Relic Smuggler",
    description: "You move forbidden and coveted objects around laws, owners, and curses.",
  },
  {
    name: "Scarred Sellsword",
    description: "You hire out your violence, vigilance, and battlefield experience.",
  },
  {
    name: "Battlefield Physician",
    description: "You keep injured people alive under filthy and dangerous conditions.",
  },
  {
    name: "Deep Lantern-Bearer",
    description: "You lead light and attention through ruins where both are scarce.",
  },
  {
    name: "Vanishing-Path Cartographer",
    description: "You map roads and places that resist being reliably found again.",
  },
  {
    name: "Smoke-and-Vinegar Alchemist",
    description: "You prepare volatile compounds, reagents, and practical transformations.",
  },
  {
    name: "Unquiet Grave Tender",
    description: "You care for the dead and handle the problems that prevent them from resting.",
  },
  {
    name: "Clockwork Tinker",
    description: "You build, repair, and dismantle intricate mechanisms and old devices.",
  },
  {
    name: "Hedge Mage",
    description: "You practice useful magic learned outside formal institutions.",
  },
  {
    name: "Shrine-Sword Guardian",
    description: "You protect sacred people, places, and objects through force and vigilance.",
  },
  {
    name: "Masked Duelist",
    description: "You settle dangerous disputes through nerve, reputation, and practiced violence.",
  },
  {
    name: "Gallows-Smile Thief",
    description: "You steal, trespass, and escape from people prepared to punish you.",
  },
  {
    name: "Mule-Train Quartermaster",
    description: "You keep expeditions supplied, moving, and accountable for what they consume.",
  },
  {
    name: "Tired Monster Hunter",
    description: "You pursue dangerous creatures by learning their habits, signs, and weaknesses.",
  },
] as const satisfies readonly CharacterKitSeed[];
