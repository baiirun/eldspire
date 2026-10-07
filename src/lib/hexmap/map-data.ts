// Map data and rules for the Eldspire hex map prototype.
// Offset grid (odd rows shifted right), pointy-top hexes, north is row 0.
// Assumptions for this slice: 6-mile hexes, and the lighthouse lake lies west of Bellwether.

export const COLS = 24;
export const ROWS = 18;
export const SQ3 = Math.sqrt(3);
export const HOURS_PER_LAND_HEX = 3;
export const HOURS_PER_WATER_HEX = 2;
export const MILES_PER_HEX = 6;

export type TerrainType =
  | "deep"
  | "water"
  | "isle"
  | "marsh"
  | "grass"
  | "wheat"
  | "forest"
  | "hills"
  | "mountain"
  | "town"
  | "camp";

/** 0 unexplored, 1 rumoured, 2 seen, 3 visited */
export type FogState = 0 | 1 | 2 | 3;

export const TERRAIN: Record<TerrainType, { label: string; height: number; color: string }> = {
  deep: { label: "Deep water", height: -0.32, color: "#3e6f80" },
  water: { label: "Shallows", height: -0.18, color: "#78a9a4" },
  isle: { label: "Rock island", height: 0.16, color: "#a29c8e" },
  marsh: { label: "Marsh", height: 0.06, color: "#7d8b55" },
  grass: { label: "Grassland", height: 0.14, color: "#93b25a" },
  wheat: { label: "Purple wheat fields", height: 0.15, color: "#8f9a55" },
  forest: { label: "Forest", height: 0.2, color: "#5f8040" },
  hills: { label: "Hills", height: 0.42, color: "#b9a56c" },
  mountain: { label: "Mountains", height: 0.8, color: "#8f877a" },
  town: { label: "Walled city", height: 0.22, color: "#c9b98f" },
  camp: { label: "Carnival camp", height: 0.15, color: "#a7b864" },
};
export const ROAD_COLOR = "#d8c39a";

export type PlaceId =
  | "bellwether"
  | "docks"
  | "lighthouse"
  | "lakeshore"
  | "gallows"
  | "brightstone"
  | "goat"
  | "valspar"
  | "threeclaims";

export type Place = { c: number; r: number; name: string; type: TerrainType; big?: boolean };

export const PLACES: Record<PlaceId, Place> = {
  bellwether: { c: 15, r: 9, name: "Bellwether", type: "town", big: true },
  docks: { c: 14, r: 9, name: "Bellwether docks", type: "water" },
  lighthouse: { c: 9, r: 9, name: "The Lighthouse", type: "isle" },
  lakeshore: { c: 3, r: 9, name: "Lakeshore", type: "camp" },
  gallows: { c: 13, r: 13, name: "The Gallows Tree", type: "hills" },
  brightstone: { c: 20, r: 3, name: "Brightstone Manor", type: "hills" },
  goat: { c: 19, r: 6, name: "Burning goat effigy", type: "grass" },
  valspar: { c: 23, r: 10, name: "Road to Valspar", type: "grass" },
  threeclaims: { c: 9, r: 17, name: "Road to Three Claims", type: "grass" },
};

/** Labels for areas rather than single places. */
export const AREA_LABELS = [
  { c: 12, r: 0, text: "Iron Spire Mountains", big: true, lift: 2.2 },
  { c: 8, r: 6, text: "The Lake", big: false, lift: 0.6 },
];

type Coord = readonly [number, number];
const ROADS: Coord[][] = [
  [[9, 17], [13, 13], [15, 9]],
  [[15, 9], [19, 6], [20, 3]],
  [[15, 9], [23, 10]],
];
const RUMOURED: Coord[] = [[20, 3], [19, 6], [23, 10], [9, 17]];

export type Pin = { c: number; r: number; when: string; text: string; gm?: boolean };

const SEED_PINS: Pin[] = [
  { c: 13, r: 13, when: "Session 11", text: "Hanged men on the old tree. Trilby took from the bodies, and the bandits have not forgotten." },
  { c: 13, r: 13, when: "Audience only", gm: true, text: "Grey-cloaked hunters stood here holding a gold coin, looking toward Bellwether." },
  { c: 15, r: 9, when: "Sessions 12–13", text: "Thaniel won the arena duel. The 500g Glass House debt was forgiven for the Brightstone job." },
  { c: 9, r: 9, when: "After session 14", text: "Thaniel held here by Saromis’s bandits. The party agreed to work against Montana to free him." },
  { c: 3, r: 9, when: "After session 14", text: "Madame Molvay paid the party 600g for the quest." },
  { c: 3, r: 9, when: "Secret", gm: true, text: "Trilby is here. The Carnivale is hiding her in the Black Wagon." },
];

export type Tile = {
  i: number;
  c: number;
  r: number;
  x: number;
  z: number;
  /** 0..1 noise used for height and prop variety */
  n: number;
  type: TerrainType;
  height: number;
  road: boolean;
  place: PlaceId | null;
  name: string | null;
};

/* ---------------- Hex math ---------------- */

export const center = (c: number, r: number) => ({ x: SQ3 * (c + 0.5 * (r & 1)), z: 1.5 * r });

export function toCube(c: number, r: number) {
  const q = c - (r - (r & 1)) / 2;
  return { q, r, s: -q - r };
}

export const fromCube = (q: number, r: number): [number, number] => [q + (r - (r & 1)) / 2, r];

export function hexDistance(a: { c: number; r: number }, b: { c: number; r: number }) {
  const A = toCube(a.c, a.r);
  const B = toCube(b.c, b.r);
  return (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.s - B.s)) / 2;
}

const ODD_OFFSETS: Coord[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const EVEN_OFFSETS: Coord[] = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];

export function neighborCoords(c: number, r: number): [number, number][] {
  return ((r & 1) ? ODD_OFFSETS : EVEN_OFFSETS).map(([dc, dr]) => [c + dc, r + dr]);
}

function cubeRound(q: number, r: number, s: number): [number, number] {
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

/** Hexes on the straight line from a to b, both ends included. */
export function hexLine(a: Coord, b: Coord): [number, number][] {
  const A = toCube(a[0], a[1]);
  const B = toCube(b[0], b[1]);
  const n = (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.s - B.s)) / 2;
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const [q, r] = cubeRound(
      A.q + (B.q - A.q) * t + 1e-6,
      A.r + (B.r - A.r) * t + 1e-6,
      A.s + (B.s - A.s) * t - 2e-6,
    );
    out.push(fromCube(q, r));
  }
  return out;
}

/* ---------------- Deterministic terrain ---------------- */

export const hash = (x: number, y: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x: number, y: number) =>
  valueNoise(x, y) * 0.6 + valueNoise(x * 2.1, y * 2.1) * 0.3 + valueNoise(x * 4.3, y * 4.3) * 0.1;

export type HexMap = {
  tiles: Tile[];
  tileAt: (c: number, r: number) => Tile | undefined;
  neighbors: (t: Tile) => Tile[];
};

export function buildMap(): HexMap {
  const tiles: Tile[] = [];
  const byKey = new Map<string, Tile>();
  const tileAt = (c: number, r: number) => byKey.get(`${c},${r}`);
  const lake = center(9, 9);
  const near = (c: number, r: number, p: Place, d: number) => hexDistance({ c, r }, p) <= d;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, z } = center(c, r);
      const n = fbm(x * 0.3, z * 0.3);
      const lakeness = ((x - lake.x) / 10) ** 2 + ((z - lake.z) / 6.2) ** 2 + (n - 0.5) * 0.35;
      let type: TerrainType = "grass";
      if (r <= 1 || (r === 2 && n > 0.45)) type = "mountain";
      else if (r === 2 || (r === 3 && n > 0.58)) type = "hills";
      else if (lakeness < 0.45) type = "deep";
      else if (lakeness < 1) type = "water";
      else if (near(c, r, PLACES.gallows, 2) && hash(c, r) > 0.3) type = "marsh";
      else if (near(c, r, PLACES.bellwether, 3)) type = "wheat";
      else if (fbm(x * 0.22 + 10, z * 0.22) > 0.56 && !near(c, r, PLACES.lakeshore, 1)) type = "forest";
      const tile: Tile = { i: tiles.length, c, r, x, z, n, type, height: 0, road: false, place: null, name: null };
      tiles.push(tile);
      byKey.set(`${c},${r}`, tile);
    }
  }

  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      for (const [c, r] of hexLine(road[i], road[i + 1])) {
        const t = tileAt(c, r);
        if (!t) continue;
        t.road = true;
        if (t.type === "deep" || t.type === "water" || t.type === "marsh" || t.type === "forest") t.type = "grass";
      }
    }
  }

  for (const [id, p] of Object.entries(PLACES) as [PlaceId, Place][]) {
    const t = tileAt(p.c, p.r)!;
    t.type = p.type;
    t.name = p.name;
    t.place = id;
  }

  for (const t of tiles) {
    const base = TERRAIN[t.type].height;
    const bump =
      t.type === "mountain" ? t.n * 0.5
      : t.type === "hills" ? t.n * 0.25
      : t.type === "grass" || t.type === "forest" ? t.n * 0.06
      : 0;
    t.height = base + bump;
  }

  const neighbors = (t: Tile) =>
    neighborCoords(t.c, t.r)
      .map(([c, r]) => tileAt(c, r))
      .filter((n): n is Tile => Boolean(n));

  return { tiles, tileAt, neighbors };
}

export const isWater = (t: Tile) => t.type === "deep" || t.type === "water";
export const isPassable = (t: Tile) => t.type !== "mountain";

/* ---------------- Journey state ---------------- */

export type View = "table" | "gm";

export type JourneyState = {
  fog: FogState[];
  /** tile indices, oldest first */
  trail: number[];
  /** hours since midnight of day 1 */
  time: number;
  party: number;
  pins: Pin[];
  view: View;
  huntersShown: boolean;
};

/** Dusk on day 1 at Lakeshore, after Gallows Tree → Bellwether → lighthouse → across the lake. */
export function seedState(map: HexMap): JourneyState {
  const { tiles, tileAt, neighbors } = map;
  const route = [
    ...hexLine([13, 13], [15, 9]),
    ...hexLine([15, 9], [9, 9]).slice(1),
    ...hexLine([9, 9], [3, 9]).slice(1),
  ];
  const fog: FogState[] = tiles.map((t) => (t.r <= 1 ? 1 : 0));
  for (const [c, r] of RUMOURED) fog[tileAt(c, r)!.i] = 1;
  for (const [c, r] of route) {
    const t = tileAt(c, r)!;
    fog[t.i] = 3;
    for (const nb of neighbors(t)) fog[nb.i] = Math.max(fog[nb.i], 2) as FogState;
  }
  for (const t of tiles) {
    if (hexDistance(t, PLACES.bellwether) <= 2) fog[t.i] = Math.max(fog[t.i], 2) as FogState;
  }
  return {
    fog,
    trail: route.map(([c, r]) => tileAt(c, r)!.i),
    time: 18,
    party: tileAt(3, 9)!.i,
    pins: SEED_PINS.map((p) => ({ ...p })),
    view: "table",
    huntersShown: false,
  };
}

/** What a viewer sees: the GM always sees at least "seen". */
export const visibleFog = (state: JourneyState, t: Tile): FogState =>
  state.view === "gm" ? (Math.max(state.fog[t.i], 2) as FogState) : state.fog[t.i];

/** Marks a hex visited and its surroundings seen; high ground sees two hexes out. */
export function reveal(map: HexMap, state: JourneyState, t: Tile) {
  state.fog[t.i] = 3;
  const radius = t.type === "hills" || t.type === "isle" ? 2 : 1;
  for (const o of map.tiles) {
    if (hexDistance(o, t) <= radius) state.fog[o.i] = Math.max(state.fog[o.i], 2) as FogState;
  }
}

/** Shortest route by hex count, avoiding impassable hexes. Excludes the start. */
export function findPath(map: HexMap, from: Tile, to: Tile): Tile[] | null {
  const prev = new Map<number, Tile | null>([[from.i, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const nb of map.neighbors(cur)) {
      if (isPassable(nb) && !prev.has(nb.i)) {
        prev.set(nb.i, cur);
        queue.push(nb);
      }
    }
  }
  if (!prev.has(to.i)) return null;
  const path: Tile[] = [];
  for (let c: Tile | null | undefined = to; c && c !== from; c = prev.get(c.i)) path.unshift(c);
  return path;
}

export const travelHours = (t: Tile) => (isWater(t) ? HOURS_PER_WATER_HEX : HOURS_PER_LAND_HEX);

const PHASES: [number, string][] = [
  [5, "Night"], [8, "Dawn"], [12, "Morning"], [16, "Afternoon"], [20, "Dusk"], [24, "Night"],
];
export const phaseOf = (time: number) => PHASES.find(([end]) => time % 24 < end)![1];
export const dayOf = (time: number) => Math.floor(time / 24) + 1;
/** The next dawn (6am) after `time`. */
export const nextDawn = (time: number) => (Math.floor((time - 6) / 24) + 1) * 24 + 6;

/** The grey-cloaked hunters wait on the Bellwether shore, then cross after dawn on day 2. */
export const huntersTile = (map: HexMap, state: JourneyState) =>
  state.time >= 30 ? map.tileAt(4, 8)! : map.tileAt(15, 8)!;
