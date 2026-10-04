// Three.js renderer and controller for the hex map. Browser only: import it from onMount.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  AREA_LABELS,
  COLS,
  PLACES,
  ROAD_COLOR,
  ROWS,
  SQ3,
  TERRAIN,
  buildMap,
  dayOf,
  findPath,
  hash,
  huntersTile,
  isWater,
  nextDawn,
  phaseOf,
  reveal,
  seedState,
  travelHours,
  visibleFog,
  type FogState,
  type JourneyState,
  type PlaceId,
  type Tile,
  type View,
} from "./map-data";

const STORE_KEY = "eldspire-hexmap-v1";

export type HexMapSnapshot = {
  day: number;
  phase: string;
  /** 0 at midnight .. 1 at the next midnight */
  dayFraction: number;
  view: View;
  huntersShown: boolean;
  moving: boolean;
  partyTile: Tile;
  selected: Tile | null;
  toast: string | null;
};

export type HexMapController = {
  map: ReturnType<typeof buildMap>;
  state: () => JourneyState;
  setView: (v: View) => void;
  select: (t: Tile | null) => void;
  travelTo: (t: Tile) => Promise<void>;
  makeCamp: () => void;
  reset: () => void;
  replay: () => void;
  toggleHunters: () => void;
  setFog: (t: Tile, fog: FogState) => void;
  addPin: (t: Tile, text: string) => void;
  dispose: () => void;
};

export function createHexMap(
  container: HTMLElement,
  labelLayer: HTMLElement,
  onChange: (s: HexMapSnapshot) => void,
): HexMapController {
  const map = buildMap();
  const { tiles, tileAt, neighbors } = map;

  let S = seedState(map);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as JourneyState | null;
    if (saved?.fog?.length === tiles.length) S = saved;
  } catch {
    // storage unavailable: start from the seed
  }
  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
    } catch {
      // storage unavailable: the session still works, it just won't persist
    }
  };
  const fogOf = (t: Tile) => visibleFog(S, t);
  const gm = () => S.view === "gm";

  let moving = false;
  let selected: Tile | null = null;
  let toast: string | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const emit = () =>
    onChange({
      day: dayOf(S.time),
      phase: phaseOf(S.time),
      dayFraction: (S.time % 24) / 24,
      view: S.view,
      huntersShown: S.huntersShown,
      moving,
      partyTile: tiles[S.party],
      selected,
      toast,
    });
  const say = (msg: string) => {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = null;
      emit();
    }, 3200);
    emit();
  };

  /* ---------------- Scene ---------------- */
  const size = () => ({ w: container.clientWidth || 1, h: container.clientHeight || 1 });
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size().w, size().h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x161b24, 40, 90);
  const camera = new THREE.PerspectiveCamera(40, size().w / size().h, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.2;
  controls.minDistance = 6;
  controls.maxDistance = 48;

  const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x3a3020, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
  const mapCenter = new THREE.Vector3((SQ3 * COLS) / 2, 0, (1.5 * ROWS) / 2);
  sun.target.position.copy(mapCenter);
  scene.add(hemi, sun, sun.target);

  // The board sits on a wooden slab, like a diorama on the table
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(SQ3 * COLS + 3, 0.6, 1.5 * ROWS + 3),
    new THREE.MeshStandardMaterial({ color: 0x3b2c1f, roughness: 0.9 }),
  );
  slab.position.set(mapCenter.x - 0.4, -1.3, mapCenter.z - 0.5);
  slab.receiveShadow = true;
  scene.add(slab);

  // Explored hexes are lit terrain; fogged hexes are unlit parchment so they read as paper at any hour
  const tileGeo = new THREE.CylinderGeometry(0.97, 0.97, 1, 6);
  tileGeo.translate(0, 0.5, 0);
  const tileMesh = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), tiles.length);
  tileMesh.castShadow = tileMesh.receiveShadow = true;
  const fogMat = new THREE.MeshBasicMaterial();
  const fogMesh = new THREE.InstancedMesh(tileGeo, fogMat, tiles.length);
  tileMesh.frustumCulled = fogMesh.frustumCulled = false;
  scene.add(tileMesh, fogMesh);

  const lakeCenter = tileAt(9, 9)!;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 17, 40, 28),
    new THREE.MeshStandardMaterial({ color: 0x5c7f8f, transparent: true, opacity: 0.62, roughness: 0.15, metalness: 0.1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(lakeCenter.x, -0.06, lakeCenter.z);
  scene.add(water);
  const waterBase = (water.geometry.attributes.position.array as Float32Array).slice();

  const rimGeo = new THREE.BufferGeometry();
  rimGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tiles.length * 12 * 3), 3));
  scene.add(new THREE.LineSegments(rimGeo, new THREE.LineBasicMaterial({ color: 0x2a2118, transparent: true, opacity: 0.28 })));

  const forestTiles = tiles.filter((t) => t.type === "forest");
  const mountainTiles = tiles.filter((t) => t.type === "mountain");
  const trees = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.2, 0.62, 6).translate(0, 0.31, 0),
    new THREE.MeshStandardMaterial({ color: 0x3d5a30, flatShading: true }),
    forestTiles.length * 3,
  );
  const peaks = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.75, 1, 5).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8580, flatShading: true }),
    mountainTiles.length,
  );
  trees.castShadow = peaks.castShadow = true;
  trees.frustumCulled = peaks.frustumCulled = false;
  scene.add(trees, peaks);

  const roadTiles = tiles.filter((t) => t.road);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xcdb88c, roughness: 1 });
  const roadGroup = new THREE.Group();
  scene.add(roadGroup);

  /* ---------------- Landmarks ---------------- */
  const nightLights: { light: THREE.PointLight; max: number; base?: number }[] = [];
  const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  const nightLight = (color: number, distance: number, y: number, max: number, base = 0) => {
    const light = new THREE.PointLight(color, base, distance);
    light.position.y = y;
    nightLights.push({ light, max, base });
    return light;
  };

  let clockFace!: THREE.MeshStandardMaterial;
  let beamPivot!: THREE.Group;
  let beamMat!: THREE.MeshBasicMaterial;
  let bulbs!: THREE.MeshBasicMaterial;
  let blackWagon!: THREE.Group;
  let flame!: THREE.Mesh;

  function buildBellwether() {
    const g = new THREE.Group();
    const stone = mat(0xe8e1d2);
    const roof = mat(0xa8432e);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const wall = part(new THREE.BoxGeometry(0.95, 0.28, 0.08), stone, Math.cos(a) * 0.78, 0.14, Math.sin(a) * 0.78);
      wall.rotation.y = -a + Math.PI / 2;
      g.add(wall);
    }
    for (const [x, z] of [[-0.35, -0.2], [0.3, -0.3], [-0.2, 0.35], [0.38, 0.25], [0, -0.48], [-0.5, 0.1]]) {
      g.add(part(new THREE.BoxGeometry(0.22, 0.18, 0.22), stone, x, 0.09, z));
      const r = part(new THREE.ConeGeometry(0.19, 0.14, 4), roof, x, 0.25, z);
      r.rotation.y = Math.PI / 4;
      g.add(r);
    }
    // the stained-glass clock tower
    g.add(part(new THREE.BoxGeometry(0.2, 1.15, 0.2), stone, 0.05, 0.575, 0.02));
    clockFace = new THREE.MeshStandardMaterial({ color: 0x6b3fa0, emissive: 0x6b3fa0, emissiveIntensity: 0.4 });
    const face = part(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), clockFace, 0.05, 0.95, 0.125);
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const spire = part(new THREE.ConeGeometry(0.16, 0.4, 4), roof, 0.05, 1.35, 0.02);
    spire.rotation.y = Math.PI / 4;
    g.add(spire);
    g.add(part(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12, 1, true), stone, -0.45, 0.06, -0.45)); // arena
    g.add(nightLight(0xffc36b, 4, 0.6, 2.5));
    return g;
  }

  function buildLighthouse() {
    const g = new THREE.Group();
    g.add(part(new THREE.DodecahedronGeometry(0.45, 0), mat(0x7a7772), 0, -0.15, 0));
    g.add(part(new THREE.CylinderGeometry(0.11, 0.17, 0.9, 10), mat(0xf0ebe0), 0, 0.55, 0));
    g.add(part(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 10), mat(0x9a3a2a), 0, 0.45, 0));
    g.add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 10), mat(0x2a2118), 0, 1.02, 0));
    g.add(part(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), 0, 1.1, 0));
    g.add(part(new THREE.ConeGeometry(0.13, 0.14, 10), mat(0x2a2118), 0, 1.24, 0));
    beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe7b0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 7, 20, 1, true).translate(0, -3.5, 0).rotateZ(Math.PI / 2), beamMat);
    beamPivot = new THREE.Group();
    beamPivot.position.y = 1.1;
    beamPivot.add(beam);
    g.add(beamPivot, nightLight(0xffd890, 6, 1.1, 3));
    return g;
  }

  function buildCarnivale() {
    const g = new THREE.Group();
    const colors = [0xb23a3a, 0xe7d9b0, 0x2f5f8a, 0xd19a2a];
    [[-0.35, -0.25, 0.32], [0.3, -0.3, 0.26], [-0.1, 0.3, 0.38], [0.42, 0.25, 0.24]].forEach(([x, z, s], i) => {
      g.add(part(new THREE.CylinderGeometry(s, s, s * 0.7, 8), mat(colors[(i + 1) % 4]), x, s * 0.35, z));
      g.add(part(new THREE.ConeGeometry(s * 1.1, s * 1.1, 8), mat(colors[i]), x, s * 0.7 + s * 0.55, z));
    });
    bulbs = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.add(part(new THREE.SphereGeometry(0.03, 6, 4), bulbs, Math.cos(a) * 0.72, 0.45 + Math.sin(i * 1.7) * 0.04, Math.sin(a) * 0.72));
    }
    blackWagon = new THREE.Group();
    blackWagon.position.set(-0.55, 0, 0.45);
    blackWagon.add(part(new THREE.BoxGeometry(0.32, 0.2, 0.18), mat(0x15130f), 0, 0.16, 0));
    for (const x of [-0.1, 0.1]) blackWagon.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8).rotateX(Math.PI / 2), mat(0x3a2a1a), x, 0.06, 0.1));
    g.add(blackWagon, nightLight(0xffb85c, 5, 0.8, 3));
    return g;
  }

  function buildGallows() {
    const g = new THREE.Group();
    const bark = mat(0x2b2420);
    g.add(part(new THREE.CylinderGeometry(0.06, 0.11, 0.9, 6), bark, 0, 0.45, 0));
    const limb = part(new THREE.CylinderGeometry(0.035, 0.05, 0.8, 5), bark, 0.22, 0.85, 0);
    limb.rotation.z = -1.2;
    const limb2 = part(new THREE.CylinderGeometry(0.03, 0.045, 0.6, 5), bark, -0.15, 0.95, 0.05);
    limb2.rotation.z = 0.9;
    g.add(limb, limb2, part(new THREE.IcosahedronGeometry(0.28, 0), mat(0x2f3a2a), -0.05, 1.15, 0));
    const rope = new THREE.LineBasicMaterial({ color: 0x1a1612 });
    for (const x of [0.22, 0.4, 0.54]) {
      const top = new THREE.Vector3(x, 0.86 - (x - 0.2) * 0.3, 0);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top, new THREE.Vector3(x, 0.6, 0)]), rope));
      g.add(part(new THREE.CapsuleGeometry(0.035, 0.14, 2, 6), mat(0x3b342c), x, 0.48, 0));
    }
    return g;
  }

  function buildBrightstone() {
    const g = new THREE.Group();
    const pale = mat(0xd9d4c6);
    g.add(part(new THREE.BoxGeometry(0.7, 0.3, 0.45), pale, 0, 0.15, 0));
    g.add(part(new THREE.BoxGeometry(0.2, 0.55, 0.2), pale, -0.3, 0.27, -0.15));
    const broken = part(new THREE.BoxGeometry(0.25, 0.2, 0.3), pale, 0.28, 0.38, 0.02);
    broken.rotation.z = 0.4;
    g.add(broken);
    const ooze = new THREE.MeshBasicMaterial({ color: 0xff8a1e }); // the orange ooze fissures
    for (const [x, z, rot] of [[-0.1, 0.26, 0.4], [0.2, 0.25, -0.3], [0.4, -0.1, 1.2]]) {
      const crack = part(new THREE.BoxGeometry(0.3, 0.02, 0.04), ooze, x, 0.02, z);
      crack.rotation.y = rot;
      g.add(crack);
    }
    g.add(nightLight(0xff7a1a, 3, 0.3, 1.5));
    return g;
  }

  function buildGoat() {
    const g = new THREE.Group();
    const wood = mat(0x5a4030);
    g.add(part(new THREE.BoxGeometry(0.4, 0.2, 0.16), wood, 0, 0.5, 0));
    for (const [x, z] of [[-0.15, -0.06], [0.15, -0.06], [-0.15, 0.06], [0.15, 0.06]]) {
      g.add(part(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 4), wood, x, 0.2, z));
    }
    g.add(part(new THREE.BoxGeometry(0.12, 0.2, 0.1), wood, 0.24, 0.66, 0));
    flame = part(new THREE.ConeGeometry(0.16, 0.45, 6), new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.85 }), 0, 0.8, 0);
    g.add(flame, nightLight(0xff8a30, 4, 0.9, 2.5, 0.6));
    return g;
  }

  function buildSign() {
    const g = new THREE.Group();
    const wood = mat(0x6b4e33);
    g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), wood, 0, 0.3, 0));
    g.add(part(new THREE.BoxGeometry(0.4, 0.1, 0.03), wood, 0.12, 0.5, 0));
    return g;
  }

  const builders: Partial<Record<PlaceId, () => THREE.Group>> = {
    bellwether: buildBellwether,
    lighthouse: buildLighthouse,
    lakeshore: buildCarnivale,
    gallows: buildGallows,
    brightstone: buildBrightstone,
    goat: buildGoat,
    valspar: buildSign,
    threeclaims: buildSign,
  };
  const landmarks: { g: THREE.Group; t: Tile }[] = [];
  for (const [id, build] of Object.entries(builders) as [PlaceId, () => THREE.Group][]) {
    const t = tileAt(PLACES[id].c, PLACES[id].r)!;
    const g = build();
    g.position.set(t.x, Math.max(t.height, 0), t.z);
    scene.add(g);
    landmarks.push({ g, t });
  }

  const hunters = new THREE.Group();
  {
    const cloak = mat(0x8d9096);
    const hood = mat(0x6f7278);
    for (const [x, z] of [[-0.22, 0.05], [0, -0.12], [0.22, 0.08]]) {
      hunters.add(part(new THREE.ConeGeometry(0.1, 0.38, 7), cloak, x, 0.19, z));
      hunters.add(part(new THREE.SphereGeometry(0.06, 8, 6), hood, x, 0.4, z));
    }
    hunters.add(part(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 12).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffcf5a }), 0, 0.36, -0.03));
  }
  scene.add(hunters);

  /* ---------------- Party token: four figures, and the eye coin while Tulk carries it ---------------- */
  const party = new THREE.Group();
  for (const [color, x, z] of [[0x6b3a2a, -0.14, -0.08], [0x2f4f6a, 0.12, -0.1], [0x5a6a2f, -0.08, 0.13], [0x7a5a2a, 0.14, 0.1]]) {
    party.add(part(new THREE.CylinderGeometry(0.05, 0.08, 0.22, 8), mat(color), x, 0.11, z));
    party.add(part(new THREE.SphereGeometry(0.055, 8, 6), mat(0xe0c4a0), x, 0.27, z));
  }
  const eye = new THREE.Group();
  eye.position.y = 0.75;
  eye.add(new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.035, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xd9a830, emissive: 0xb07a10, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }),
  ));
  eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2a2118 })));
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  eye.add(new THREE.Mesh(new THREE.RingGeometry(0.17, 0.3, 32), haloMat));
  party.add(eye);
  scene.add(party);

  /* ---------------- Trail, pins, rings ---------------- */
  let trailMesh: THREE.Mesh | null = null;
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffc24a, transparent: true, opacity: 0.9 });
  const pinGroup = new THREE.Group();
  scene.add(pinGroup);
  const topY = (t: Tile) => Math.max(t.height, -0.06);
  const shownHeight = (t: Tile) => (fogOf(t) >= 2 ? t.height : 0.05);
  const hexPoints = (t: Tile, y: number, s = 0.97) =>
    Array.from({ length: 7 }, (_, k) => {
      const a = ((k % 6) / 6) * Math.PI * 2;
      return new THREE.Vector3(t.x + Math.sin(a) * s, y, t.z + Math.cos(a) * s);
    });
  const selRing = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd36b }));
  const hoverRing = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.7 }));
  selRing.visible = hoverRing.visible = false;
  scene.add(selRing, hoverRing);
  const ringAt = (ring: THREE.Line, t: Tile | null) => {
    ring.visible = Boolean(t);
    if (t) ring.geometry.setFromPoints(hexPoints(t, shownHeight(t) + 0.03, 0.9));
  };

  /* ---------------- Fog-aware drawing ---------------- */
  const PARCHMENT = new THREE.Color(0xe9dcb8);
  const RUMOUR = new THREE.Color(0xc9b182);
  const GREY = new THREE.Color(0xb9b4a6);
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

  function refresh() {
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const rims = rimGeo.attributes.position.array as Float32Array;
    for (const t of tiles) {
      const fog = fogOf(t);
      const h = shownHeight(t);
      m.makeScale(1, h + 1, 1);
      m.setPosition(t.x, -1, t.z);
      tileMesh.setMatrixAt(t.i, fog >= 2 ? m : HIDDEN);
      fogMesh.setMatrixAt(t.i, fog >= 2 ? HIDDEN : m);
      if (fog === 0) col.copy(PARCHMENT).offsetHSL(0, 0, (hash(t.c, t.r) - 0.5) * 0.04);
      else if (fog === 1) col.copy(RUMOUR).offsetHSL(0, 0, (hash(t.c, t.r) - 0.5) * 0.04);
      else {
        col.set(t.road && !t.place ? ROAD_COLOR : TERRAIN[t.type].color);
        if (fog === 2 && !gm()) col.lerp(GREY, 0.4);
      }
      (fog >= 2 ? tileMesh : fogMesh).setColorAt(t.i, col);
      const p = hexPoints(t, h + 0.005);
      for (let k = 0; k < 6; k++) rims.set([p[k].x, p[k].y, p[k].z, p[k + 1].x, p[k + 1].y, p[k + 1].z], (t.i * 6 + k) * 6);
    }
    for (const mesh of [tileMesh, fogMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.boundingSphere = null;
    }
    rimGeo.attributes.position.needsUpdate = true;

    let k = 0;
    for (const t of forestTiles) {
      for (let j = 0; j < 3; j++, k++) {
        const a = j * 2.1 + t.n * 6;
        const s = fogOf(t) >= 2 ? 0.8 + hash(t.c + j, t.r) * 0.5 : 0;
        m.makeScale(s, s, s);
        m.setPosition(t.x + Math.cos(a) * 0.45, t.height, t.z + Math.sin(a) * 0.45);
        trees.setMatrixAt(k, m);
      }
    }
    trees.instanceMatrix.needsUpdate = true;
    mountainTiles.forEach((t, j) => {
      const s = fogOf(t) >= 2 ? 1 : 0;
      m.makeScale(s, s * (0.8 + t.n * 1.4), s);
      m.setPosition(t.x, t.height, t.z);
      peaks.setMatrixAt(j, m);
    });
    peaks.instanceMatrix.needsUpdate = true;

    for (const child of roadGroup.children) (child as THREE.Mesh).geometry.dispose();
    roadGroup.clear();
    for (const t of roadTiles) {
      for (const nb of neighbors(t)) {
        if (!nb.road || nb.i < t.i || fogOf(t) < 2 || fogOf(nb) < 2) continue;
        const a = new THREE.Vector3(t.x, t.height + 0.02, t.z);
        const b = new THREE.Vector3(nb.x, nb.height + 0.02, nb.z);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, a.distanceTo(b)), roadMat);
        seg.position.copy(a).add(b).multiplyScalar(0.5);
        seg.lookAt(b);
        seg.receiveShadow = true;
        roadGroup.add(seg);
      }
    }

    for (const { g, t } of landmarks) g.visible = fogOf(t) >= 2;
    blackWagon.visible = gm();
    rebuildTrail();
    rebuildPins();
    const ht = huntersTile(map, S);
    hunters.position.set(ht.x - 0.2, topY(ht), ht.z + 0.2);
    hunters.visible = gm() || (S.huntersShown && fogOf(ht) >= 2);
    ringAt(selRing, selected);
  }

  function rebuildTrail() {
    if (trailMesh) {
      scene.remove(trailMesh);
      trailMesh.geometry.dispose();
      trailMesh = null;
    }
    const points = S.trail.map((i) => tiles[i]).map((t) => new THREE.Vector3(t.x, topY(t) + 0.12, t.z));
    if (points.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    trailMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 10, 0.045, 6), trailMat);
    scene.add(trailMesh);
  }

  const pinStick = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4);
  const pinHead = new THREE.SphereGeometry(0.07, 10, 8);
  const pinMats = { table: mat(0x8e2f22), gm: mat(0x4a4e56), stick: mat(0x2a2118) };
  function rebuildPins() {
    pinGroup.clear();
    const perTile = new Map<number, number>();
    for (const p of S.pins) {
      const t = tileAt(p.c, p.r);
      if (!t || fogOf(t) < 2 || (p.gm && !gm())) continue;
      const n = perTile.get(t.i) ?? 0;
      perTile.set(t.i, n + 1);
      const g = new THREE.Group();
      g.position.set(t.x + 0.55 - n * 0.16, topY(t), t.z - 0.35);
      g.add(part(pinStick, pinMats.stick, 0, 0.25, 0), part(pinHead, p.gm ? pinMats.gm : pinMats.table, 0, 0.52, 0));
      pinGroup.add(g);
    }
  }

  /* ---------------- Labels (HTML, projected each frame) ---------------- */
  type Label = { el: HTMLDivElement; t: Tile; base: string; lift: number; always: boolean };
  const labels: Label[] = [];
  const addLabel = (text: string, t: Tile, cls: string, lift: number, always: boolean) => {
    const el = document.createElement("div");
    el.className = `hexmap-label ${cls}`;
    el.textContent = text;
    labelLayer.appendChild(el);
    labels.push({ el, t, base: el.className, lift, always });
  };
  for (const [id, p] of Object.entries(PLACES) as [PlaceId, (typeof PLACES)[PlaceId]][]) {
    if (id === "docks") continue;
    addLabel(p.name, tileAt(p.c, p.r)!, p.big ? "is-big" : "", id === "bellwether" ? 1.9 : 1.4, false);
  }
  for (const a of AREA_LABELS) addLabel(a.text, tileAt(a.c, a.r)!, a.big ? "is-big" : "", a.lift, true);
  const hunterLabel = document.createElement("div");
  hunterLabel.className = "hexmap-label is-gm";
  labelLayer.appendChild(hunterLabel);

  const projected = new THREE.Vector3();
  const place = (el: HTMLElement, v: THREE.Vector3) => {
    projected.copy(v).project(camera);
    el.hidden = projected.z > 1;
    const { w, h } = size();
    el.style.transform = `translate(${(projected.x * 0.5 + 0.5) * w}px, ${(-projected.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  };
  const anchor = new THREE.Vector3();
  function drawLabels() {
    for (const l of labels) {
      const fog = fogOf(l.t);
      if (fog < 1 && !l.always) {
        l.el.hidden = true;
        continue;
      }
      l.el.className = l.base + (fog === 1 ? " is-rumour" : "");
      place(l.el, anchor.set(l.t.x, topY(l.t) + l.lift, l.t.z));
    }
    hunterLabel.hidden = !hunters.visible;
    if (hunters.visible) {
      hunterLabel.textContent = gm() && !S.huntersShown ? "Hunters (hidden from table)" : "Grey-cloaked hunters";
      place(hunterLabel, anchor.copy(hunters.position).setY(hunters.position.y + 0.8));
    }
  }

  /* ---------------- Time and light ---------------- */
  const SKY = { night: new THREE.Color(0x141a2a), dusk: new THREE.Color(0x9a6650), day: new THREE.Color(0xa9bdc9) };
  let night = 0;
  function applyTime() {
    const hour = S.time % 24;
    const angle = ((hour - 6) / 12) * Math.PI;
    const elevation = Math.sin(angle);
    const warm = 1 - Math.min(1, Math.max(0, elevation) * 2.2);
    night = Math.min(1, Math.max(0, 0.35 - elevation * 2.2));
    sun.position.set(mapCenter.x + Math.cos(angle) * 40, Math.max(elevation, 0.05) * 40, mapCenter.z - 18);
    sun.color.setRGB(1, 1 - warm * 0.35, 1 - warm * 0.6);
    sun.intensity = Math.max(0, elevation) * 2.2 + (1 - night) * 0.9;
    hemi.intensity = 0.55 + (1 - night) * 0.6;
    hemi.color.set(night > 0.5 ? 0x6a7aa0 : 0xdfe8f0);
    const sky = SKY.day.clone().lerp(SKY.dusk, warm * (1 - night)).lerp(SKY.night, night);
    scene.background = sky;
    (scene.fog as THREE.Fog).color.copy(sky);
    fogMat.color.setScalar(1 - night * 0.45);
  }

  /* ---------------- Travel ---------------- */
  const partyPos = new THREE.Vector3();
  const partyGoal = new THREE.Vector3();
  const setPartyGoal = (t: Tile) => partyGoal.set(t.x, topY(t) + (isWater(t) ? 0.05 : 0), t.z);

  async function travelTo(target: Tile) {
    if (moving) return;
    const path = findPath(map, tiles[S.party], target);
    if (!path?.length) {
      say(target.type === "mountain" ? "The Iron Spires are impassable from here." : "No way through.");
      return;
    }
    moving = true;
    emit();
    const dayBefore = dayOf(S.time);
    for (const t of path) {
      S.party = t.i;
      S.trail.push(t.i);
      S.time += travelHours(t);
      setPartyGoal(t);
      reveal(map, S, t);
      refresh();
      applyTime();
      emit();
      await new Promise((r) => setTimeout(r, 420));
    }
    moving = false;
    save();
    const newDay = dayOf(S.time) !== dayBefore ? `; day ${dayOf(S.time)} begins` : "";
    say(`${path.length} ${path.length === 1 ? "hex" : "hexes"}, about ${path.length * 6} miles${newDay}.`);
  }

  /* ---------------- Picking ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([tileMesh, fogMesh])[0];
    return hit?.instanceId != null ? tiles[hit.instanceId] : null;
  }
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    controller.select(pick(e));
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const t = pick(e);
    ringAt(hoverRing, t);
    renderer.domElement.style.cursor = t ? "pointer" : "";
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);

  const resize = new ResizeObserver(() => {
    const { w, h } = size();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resize.observe(container);

  /* ---------------- Loop ---------------- */
  setPartyGoal(tiles[S.party]);
  partyPos.copy(partyGoal);
  const lookAt = tileAt(9, 10)!; // frame the lake between Lakeshore and Bellwether
  controls.target.set(lookAt.x, 0, lookAt.z);
  camera.position.set(lookAt.x + 2, 19, lookAt.z + 17);

  let replay: { curve: THREE.CatmullRomCurve3; t0: number; dur: number } | null = null;
  const clock = new THREE.Clock();
  const lastTarget = new THREE.Vector3();
  const replayOffset = new THREE.Vector3(4, 8, 8);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    partyPos.lerp(partyGoal, 1 - Math.pow(0.0005, dt));
    party.position.copy(partyPos);
    eye.position.y = 0.75 + Math.sin(time * 2) * 0.05;
    eye.lookAt(camera.position);
    haloMat.opacity = 0.18 + (Math.sin(time * 3) * 0.5 + 0.5) * 0.3;
    if (moving) {
      lastTarget.copy(controls.target);
      controls.target.lerp(partyPos, 0.06);
      camera.position.add(controls.target.clone().sub(lastTarget));
    }
    if (replay) {
      const k = Math.min(1, (performance.now() - replay.t0) / replay.dur);
      const p = replay.curve.getPointAt(k);
      controls.target.lerp(p, 0.12);
      camera.position.lerp(p.clone().add(replayOffset), 0.06);
      if (k >= 1) {
        replay = null;
        controls.enabled = true;
      }
    }
    if (!reducedMotion) {
      const a = water.geometry.attributes.position;
      const arr = a.array as Float32Array;
      for (let i = 0; i < a.count; i++) {
        arr[i * 3 + 2] = waterBase[i * 3 + 2] + Math.sin(time * 0.9 + waterBase[i * 3] * 0.8 + waterBase[i * 3 + 1] * 0.6) * 0.025;
      }
      a.needsUpdate = true;
    }
    beamPivot.rotation.y = time * 0.7;
    beamMat.opacity = Math.max(0, night - 0.3) * 0.16;
    bulbs.color.setHSL(0.11, 0.9, 0.45 + night * 0.25 + Math.sin(time * 6) * 0.03);
    flame.scale.y = 1 + Math.sin(time * 13) * 0.12 + Math.sin(time * 7.3) * 0.08;
    clockFace.emissiveIntensity = 0.3 + night * 1.6;
    for (const n of nightLights) n.light.intensity = (n.base ?? 0) + night * n.max;
    controls.update();
    renderer.render(scene, camera);
    drawLabels();
    frame = requestAnimationFrame(loop);
  }

  const controller: HexMapController = {
    map,
    state: () => S,
    setView(v) {
      S.view = v;
      save();
      refresh();
      emit();
    },
    select(t) {
      selected = t;
      ringAt(selRing, t);
      emit();
    },
    travelTo,
    makeCamp() {
      if (moving) return;
      S.time = nextDawn(S.time);
      save();
      applyTime();
      refresh();
      say(`The party makes camp. Dawn, day ${dayOf(S.time)}.`);
    },
    reset() {
      if (moving) return;
      const view = S.view;
      S = seedState(map);
      S.view = view;
      save();
      setPartyGoal(tiles[S.party]);
      partyPos.copy(partyGoal);
      selected = null;
      applyTime();
      refresh();
      say("Back to dusk at Lakeshore.");
    },
    replay() {
      if (moving || S.trail.length < 2) return;
      const points = S.trail.map((i) => tiles[i]).map((t) => new THREE.Vector3(t.x, topY(t), t.z));
      replay = { curve: new THREE.CatmullRomCurve3(points), t0: performance.now(), dur: Math.min(14000, 1800 + points.length * 450) };
      controls.enabled = false;
      say("Previously on Eldspire…");
    },
    toggleHunters() {
      S.huntersShown = !S.huntersShown;
      save();
      refresh();
      say(S.huntersShown ? "Grey figures stand on the far shore." : "The hunters slip out of sight.");
    },
    setFog(t, fog) {
      S.fog[t.i] = fog;
      save();
      refresh();
      emit();
    },
    addPin(t, text) {
      S.pins.push({ c: t.c, r: t.r, when: `Day ${dayOf(S.time)}`, text });
      save();
      refresh();
      emit();
    },
    dispose() {
      cancelAnimationFrame(frame);
      clearTimeout(toastTimer);
      resize.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.replaceChildren();
    },
  };

  applyTime();
  refresh();
  emit();
  loop();
  return controller;
}
