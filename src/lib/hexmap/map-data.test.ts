import { describe, expect, it } from "vitest";
import {
  COLS,
  PLACES,
  ROWS,
  buildMap,
  dayOf,
  findPath,
  hexDistance,
  hexLine,
  huntersTile,
  isPassable,
  isWater,
  nextDawn,
  phaseOf,
  reveal,
  seedState,
  visibleFog,
} from "./map-data";

describe("hex math", () => {
  it("measures distance on the odd-row offset grid", () => {
    expect(hexDistance({ c: 0, r: 0 }, { c: 0, r: 0 })).toBe(0);
    expect(hexDistance({ c: 3, r: 9 }, { c: 15, r: 9 })).toBe(12);
    expect(hexDistance({ c: 5, r: 5 }, { c: 5, r: 6 })).toBe(1);
    expect(hexDistance({ c: 5, r: 5 }, { c: 6, r: 6 })).toBe(1);
  });

  it("draws a line of adjacent hexes, both ends included", () => {
    const line = hexLine([13, 13], [15, 9]);
    expect(line[0]).toEqual([13, 13]);
    expect(line.at(-1)).toEqual([15, 9]);
    expect(line).toHaveLength(5);
    for (let i = 1; i < line.length; i++) {
      const [c1, r1] = line[i - 1];
      const [c2, r2] = line[i];
      expect(hexDistance({ c: c1, r: r1 }, { c: c2, r: r2 })).toBe(1);
    }
  });
});

describe("buildMap", () => {
  const map = buildMap();

  it("builds the full grid with six neighbours inside it", () => {
    expect(map.tiles).toHaveLength(COLS * ROWS);
    expect(map.neighbors(map.tileAt(10, 10)!)).toHaveLength(6);
    expect(map.neighbors(map.tileAt(0, 0)!).length).toBeLessThan(6);
  });

  it("places the named locations with their terrain", () => {
    expect(map.tileAt(PLACES.bellwether.c, PLACES.bellwether.r)!.type).toBe("town");
    expect(map.tileAt(PLACES.lighthouse.c, PLACES.lighthouse.r)!.name).toBe("The Lighthouse");
    expect(map.tileAt(PLACES.lakeshore.c, PLACES.lakeshore.r)!.place).toBe("lakeshore");
  });

  it("puts the lake between Lakeshore and Bellwether", () => {
    for (let c = 5; c <= 13; c++) {
      if (c === PLACES.lighthouse.c) continue;
      expect(isWater(map.tileAt(c, 9)!)).toBe(true);
    }
  });

  it("walls the north edge with the Iron Spires", () => {
    expect(map.tiles.filter((t) => t.r <= 1).every((t) => !isPassable(t))).toBe(true);
  });

  it("is deterministic", () => {
    const again = buildMap();
    expect(again.tiles.map((t) => t.type)).toEqual(map.tiles.map((t) => t.type));
  });
});

describe("journey state", () => {
  const map = buildMap();

  it("starts at dusk on day 1 at Lakeshore with the lake crossing on the trail", () => {
    const s = seedState(map);
    expect(dayOf(s.time)).toBe(1);
    expect(phaseOf(s.time)).toBe("Dusk");
    expect(map.tiles[s.party].name).toBe("Lakeshore");
    expect(map.tiles[s.trail[0]].name).toBe("The Gallows Tree");
    expect(s.trail.map((i) => map.tiles[i].name)).toContain("The Lighthouse");
    expect(s.trail.every((i) => s.fog[i] === 3)).toBe(true);
  });

  it("keeps unexplored land hidden from the table but not the GM", () => {
    const s = seedState(map);
    const far = map.tileAt(22, 16)!;
    expect(visibleFog(s, far)).toBe(0);
    expect(visibleFog({ ...s, view: "gm" }, far)).toBe(2);
  });

  it("reveals further from high ground", () => {
    const s = seedState(map);
    const hill = map.tiles.find((t) => t.type === "hills" && t.r > 3 && t.c > 2 && t.c < COLS - 3)!;
    reveal(map, s, hill);
    const twoAway = map.tiles.filter((t) => hexDistance(t, hill) === 2);
    expect(twoAway.every((t) => s.fog[t.i] >= 2)).toBe(true);
  });

  it("finds a route around the mountains", () => {
    const from = map.tileAt(3, 9)!;
    const to = map.tileAt(PLACES.brightstone.c, PLACES.brightstone.r)!;
    const path = findPath(map, from, to)!;
    expect(path.at(-1)).toBe(to);
    expect(path).toHaveLength(hexDistance(from, to));
    expect(path.every(isPassable)).toBe(true);
    expect(findPath(map, from, map.tileAt(5, 0)!)).toBeNull();
  });

  it("moves the hunters across the lake after dawn on day 2", () => {
    const s = seedState(map);
    expect(huntersTile(map, s).c).toBeGreaterThan(PLACES.lighthouse.c);
    s.time = nextDawn(s.time);
    expect(dayOf(s.time)).toBe(2);
    expect(phaseOf(s.time)).toBe("Dawn");
    expect(huntersTile(map, s).c).toBeLessThan(PLACES.lighthouse.c);
  });
});
