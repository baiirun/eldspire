// Three.js renderer and controller for the hex map. Browser only: import it from onMount.
//
// Art direction: a painted pop-up diorama. The world starts as an inked parchment map lying on
// the table; each hex the party learns about rises out of the paper as a little block of terrain,
// with soil strata on its sides, painted tops, trees, wheat rows and hand-built landmarks.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
  fromCube,
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
/** Height of the terrain above the parchment, so even the lake bed rises out of the paper. */
const BASE = 0.55;
const WATER_Y = BASE - 0.07;
const HEX_R = 0.975;

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

/* ---------------- Geometry helpers ---------------- */

/** Bakes one flat colour into a geometry's vertex colours so mixed props can share one mesh. */
function tint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
const merged = (...parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts);
  if (!g) throw new Error("hexmap: could not merge prop geometry");
  g.computeVertexNormals();
  return g;
};

/** A hex top with a chamfered rim, so tiles catch the light along their edges. */
function capGeometry() {
  const ring = (r: number, y: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2;
      return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
    });
  const inner = ring(0.84, 0);
  const outer = ring(HEX_R, -0.07);
  const centre = new THREE.Vector3();
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.y < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (let k = 0; k < 6; k++) {
    const k1 = (k + 1) % 6;
    tri(centre, inner[k], inner[k1]);
    tri(inner[k], outer[k], outer[k1]);
    tri(inner[k], outer[k1], inner[k1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** The side wall of a hex column, light soil at the top fading to dark earth at the base. */
function skirtGeometry() {
  const g = new THREE.CylinderGeometry(HEX_R, HEX_R, 1, 6, 3, true).toNonIndexed();
  g.translate(0, 0.5, 0);
  const top = new THREE.Color("#c9b48c");
  const bottom = new THREE.Color("#4f3a28");
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // a darker band a third of the way down reads as a soil stratum
    c.copy(bottom).lerp(top, Math.pow(y, 0.7)).multiplyScalar(y > 0.6 && y < 0.7 ? 0.82 : 1);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Adds painterly mottling (and optional shimmer) in world space to a standard material. */
function painted(mat: THREE.MeshStandardMaterial, amount: number, scale: number, time?: { value: number }) {
  mat.onBeforeCompile = (shader) => {
    if (time) shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPaintPos;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 paintPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          paintPos = instanceMatrix * paintPos;
        #endif
        vPaintPos = (modelMatrix * paintPos).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vPaintPos;
        ${time ? "uniform float uTime;" : ""}
        float paintHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float paintNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(paintHash(i), paintHash(i + vec2(1, 0)), u.x), mix(paintHash(i + vec2(0, 1)), paintHash(i + vec2(1, 1)), u.x), u.y);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 paintUv = vPaintPos.xz * ${scale.toFixed(2)};
        ${time ? "paintUv += vec2(uTime * 0.15, uTime * 0.08);" : ""}
        float paint = paintNoise(paintUv) * 0.65 + paintNoise(paintUv * 3.7) * 0.35;
        diffuseColor.rgb *= 1.0 + ${amount.toFixed(3)} * (paint - 0.5);
        ${time ? "diffuseColor.rgb += 0.10 * smoothstep(0.72, 0.95, paintNoise(vPaintPos.xz * 2.4 - uTime * 0.2));" : ""}`,
      );
  };
  return mat;
}

/* ---------------- Time of day ---------------- */

type Light = {
  top: string; horizon: string; sun: string; sunI: number;
  hemiSky: string; hemiGround: string; hemiI: number; night: number; exposure: number;
};
const KEYFRAMES: [number, Light][] = [
  [0, { top: "#0b1022", horizon: "#2c3456", sun: "#9fb2ff", sunI: 0.55, hemiSky: "#646a98", hemiGround: "#3a2a1c", hemiI: 0.8, night: 1, exposure: 1.15 }],
  [5, { top: "#121a35", horizon: "#3b3d63", sun: "#9fb2ff", sunI: 0.5, hemiSky: "#6a6f98", hemiGround: "#3a2a1c", hemiI: 0.8, night: 0.95, exposure: 1.12 }],
  [6.5, { top: "#5d6fa0", horizon: "#f2b98a", sun: "#ffb27a", sunI: 1.4, hemiSky: "#c4b4c8", hemiGround: "#5a4632", hemiI: 0.8, night: 0.35, exposure: 1.05 }],
  [9, { top: "#6e9ccc", horizon: "#e6e3d2", sun: "#fff0d8", sunI: 2.6, hemiSky: "#cfe0ee", hemiGround: "#6b5a3a", hemiI: 1.0, night: 0, exposure: 1.0 }],
  [15, { top: "#6a98c8", horizon: "#ece2c8", sun: "#ffe8c4", sunI: 2.6, hemiSky: "#d4e2ec", hemiGround: "#6b5a3a", hemiI: 1.0, night: 0, exposure: 1.0 }],
  [18, { top: "#4b4f86", horizon: "#f09a64", sun: "#ffad6e", sunI: 1.7, hemiSky: "#c4b2c4", hemiGround: "#5a4632", hemiI: 0.9, night: 0.3, exposure: 1.08 }],
  [20, { top: "#1b2045", horizon: "#6a4a6a", sun: "#9fb2ff", sunI: 0.6, hemiSky: "#6a6a98", hemiGround: "#3a2a1c", hemiI: 0.8, night: 0.85, exposure: 1.12 }],
  [24, { top: "#0b1022", horizon: "#2c3456", sun: "#9fb2ff", sunI: 0.55, hemiSky: "#646a98", hemiGround: "#3a2a1c", hemiI: 0.8, night: 1, exposure: 1.15 }],
];
function lightAt(hour: number): Light {
  const i = KEYFRAMES.findIndex(([h]) => h > hour);
  const [h0, a] = KEYFRAMES[i - 1];
  const [h1, b] = KEYFRAMES[i];
  const t = (hour - h0) / (h1 - h0);
  const mix = (x: string, y: string) => "#" + new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString();
  const num = (x: number, y: number) => x + (y - x) * t;
  return {
    top: mix(a.top, b.top), horizon: mix(a.horizon, b.horizon), sun: mix(a.sun, b.sun), sunI: num(a.sunI, b.sunI),
    hemiSky: mix(a.hemiSky, b.hemiSky), hemiGround: mix(a.hemiGround, b.hemiGround), hemiI: num(a.hemiI, b.hemiI),
    night: num(a.night, b.night), exposure: num(a.exposure, b.exposure),
  };
}

/* ---------------- Controller ---------------- */

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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* ---------------- Renderer, sky, light ---------------- */
  const size = () => ({ w: container.clientWidth || 1, h: container.clientHeight || 1 });
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size().w, size().h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe6e3d2, 55, 120);
  const camera = new THREE.PerspectiveCamera(34, size().w / size().h, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.18;
  controls.minDistance = 5;
  controls.maxDistance = 55;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size().w / 2, size().h / 2), 0.4, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "uniform vec3 top; uniform vec3 horizon; varying vec3 vDir; void main() { float h = smoothstep(-0.05, 0.55, vDir.y); gl_FragColor = vec4(mix(horizon, top, h), 1.0); }",
    }),
  );
  scene.add(sky);

  const mapCenter = new THREE.Vector3((SQ3 * COLS) / 2, 0, (1.5 * ROWS) / 2);
  sky.position.copy(mapCenter);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 22, bottom: -22, near: 1, far: 140 });
  sun.target.position.copy(mapCenter);
  scene.add(hemi, sun, sun.target);

  /* ---------------- Table and parchment ---------------- */
  const minX = -2.2, maxX = SQ3 * (COLS + 0.5) + 1.2;
  const minZ = -2.2, maxZ = 1.5 * (ROWS - 1) + 2.2;
  const paperW = maxX - minX, paperH = maxZ - minZ;
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(paperW + 14, 1, paperH + 14),
    painted(new THREE.MeshStandardMaterial({ color: 0x5a3c26, roughness: 0.85 }), 0.35, 0.6),
  );
  table.position.set(minX + paperW / 2, -0.52, minZ + paperH / 2);
  table.receiveShadow = true;
  scene.add(table);

  const paperCanvas = document.createElement("canvas");
  paperCanvas.width = 2048;
  paperCanvas.height = Math.round((2048 * paperH) / paperW);
  const paperTex = new THREE.CanvasTexture(paperCanvas);
  paperTex.colorSpace = THREE.SRGBColorSpace;
  paperTex.anisotropy = 8;
  const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, emissive: 0xffffff, emissiveMap: paperTex, emissiveIntensity: 0.12 });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(paperW, paperH), paperMat);
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(minX + paperW / 2, 0.001, minZ + paperH / 2);
  paper.receiveShadow = true;
  scene.add(paper);

  const paperBase = drawPaperBase(paperCanvas.width, paperCanvas.height);
  const toPaper = (x: number, z: number): [number, number] => [
    ((x - minX) / paperW) * paperCanvas.width,
    ((z - minZ) / paperH) * paperCanvas.height,
  ];
  const pxPerUnit = paperCanvas.width / paperW;
  let paperKey = "";
  function drawPaper() {
    const key = tiles.map(fogOf).join("");
    if (key === paperKey) return;
    paperKey = key;
    const ctx = paperCanvas.getContext("2d")!;
    ctx.drawImage(paperBase, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const t of tiles) {
      const fog = fogOf(t);
      const [cx, cy] = toPaper(t.x, t.z);
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = cx + Math.sin(a) * HEX_R * pxPerUnit;
        const py = cy + Math.cos(a) * HEX_R * pxPerUnit;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.strokeStyle = fog === 1 ? "rgba(58,40,24,0.55)" : "rgba(58,40,24,0.16)";
      ctx.lineWidth = fog === 1 ? 2 : 1.2;
      ctx.stroke();
      if (fog === 1) {
        ctx.fillStyle = "rgba(120,88,48,0.10)";
        ctx.fill();
        drawGlyph(ctx, t, cx, cy, pxPerUnit);
      }
    }
    paperTex.needsUpdate = true;
  }

  /* ---------------- Terrain blocks ---------------- */
  const capMat = painted(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), 0.32, 2.6);
  const caps = new THREE.InstancedMesh(capGeometry(), capMat, tiles.length);
  const skirtMat = painted(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), 0.4, 4);
  const skirts = new THREE.InstancedMesh(skirtGeometry(), skirtMat, tiles.length);
  caps.castShadow = caps.receiveShadow = skirts.castShadow = skirts.receiveShadow = true;
  caps.frustumCulled = skirts.frustumCulled = false;
  scene.add(caps, skirts);

  const waterTime = { value: 0 };
  const waterMat = painted(
    new THREE.MeshStandardMaterial({ color: 0x4a93a6, emissive: 0x15404c, emissiveIntensity: 0.6, transparent: true, opacity: 0.9, roughness: 0.32, metalness: 0.05 }),
    0.25, 1.4, waterTime,
  );
  const waterTiles = tiles.filter(isWater);
  const waterTop = new THREE.CircleGeometry(1.004, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
  const waterSurf = new THREE.InstancedMesh(waterTop, waterMat, waterTiles.length);
  waterSurf.frustumCulled = false;
  waterSurf.receiveShadow = true;
  scene.add(waterSurf);

  const skirtColor = (t: Tile) =>
    isWater(t) ? "#3f7d8f" : t.type === "mountain" || t.type === "isle" ? "#9a9488" : t.type === "hills" ? "#e2cf9e" : "#ffffff";

  /* ---------------- Props: trees, wheat, rocks, peaks, reeds, roads ---------------- */
  const conifer = merged(
    tint(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5).translate(0, 0.08, 0), "#5b4030"),
    tint(new THREE.ConeGeometry(0.2, 0.36, 7).translate(0, 0.3, 0), "#3f6a3a"),
    tint(new THREE.ConeGeometry(0.15, 0.3, 7).translate(0, 0.5, 0), "#4d7d43"),
  );
  const broadleaf = merged(
    tint(new THREE.CylinderGeometry(0.03, 0.045, 0.2, 5).translate(0, 0.1, 0), "#5b4030"),
    tint(new THREE.IcosahedronGeometry(0.2, 0).translate(0, 0.32, 0), "#6f9a45"),
    tint(new THREE.IcosahedronGeometry(0.13, 0).translate(0.1, 0.42, 0.04), "#82ab4f"),
  );
  const bush = tint(new THREE.IcosahedronGeometry(0.11, 0).translate(0, 0.07, 0), "#6c9446");
  const rock = tint(new THREE.DodecahedronGeometry(0.12, 0).translate(0, 0.05, 0), "#a7a092");
  const peak = merged(
    tint(new THREE.ConeGeometry(0.6, 1, 5).translate(0, 0.5, 0), "#a39886"),
    tint(new THREE.ConeGeometry(0.36, 0.55, 5).rotateY(0.6).translate(0.24, 0.27, 0.12), "#948a7a"),
    tint(new THREE.ConeGeometry(0.31, 0.52, 5).translate(0, 0.74, 0), "#f7f3ea"),
  );
  const reed = tint(new THREE.ConeGeometry(0.018, 0.26, 3).translate(0, 0.13, 0), "#8a8a48");
  const furrow = tint(new THREE.BoxGeometry(1, 0.06, 0.09).translate(0, 0.035, 0), "#c4b2d0");
  const roadStrip = tint(new THREE.BoxGeometry(0.22, 0.025, 1).translate(0, 0.012, 0.5), ROAD_COLOR);
  const pool = tint(new THREE.CircleGeometry(0.2, 10).rotateX(-Math.PI / 2).translate(0, 0.01, 0), "#4f8a8f");

  type PropSpec = { tile: Tile; local: THREE.Matrix4; tint?: THREE.Color };
  const propSpecs = new Map<THREE.BufferGeometry, PropSpec[]>();
  const addProp = (geo: THREE.BufferGeometry, tile: Tile, x: number, z: number, s: number, rotY = 0, sy = s, tintColor?: THREE.Color) => {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(s, sy, s),
    );
    if (!propSpecs.has(geo)) propSpecs.set(geo, []);
    propSpecs.get(geo)!.push({ tile, local, tint: tintColor });
  };
  for (const t of tiles) {
    const rnd = (k: number) => hash(t.c * 7.31 + k * 1.7, t.r * 3.17 + k * 2.3);
    const scatter = (k: number, rMin: number, rMax: number): [number, number] => {
      const a = rnd(k) * Math.PI * 2;
      const r = rMin + rnd(k + 50) * (rMax - rMin);
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    const green = (k: number) => new THREE.Color().setHSL(0.24 + (rnd(k) - 0.5) * 0.06, 0.5, 0.5 + (rnd(k + 9) - 0.5) * 0.25).multiplyScalar(1.8);
    if (t.road) {
      for (const nb of neighbors(t)) {
        if (!nb.road) continue;
        addProp(roadStrip, t, 0, 0, 1, Math.atan2(nb.x - t.x, nb.z - t.z), 1);
      }
    }
    if (t.place) continue;
    if (t.type === "forest") {
      for (let k = 0; k < 6; k++) {
        const [x, z] = scatter(k, 0.1, 0.68);
        addProp(rnd(k + 20) > 0.45 ? conifer : broadleaf, t, x, z, 0.85 + rnd(k + 30) * 0.5, rnd(k + 40) * 6, undefined, green(k));
      }
    } else if (t.type === "grass" && !t.road) {
      const n = Math.floor(rnd(1) * 3);
      for (let k = 0; k < n; k++) {
        const [x, z] = scatter(k + 3, 0.25, 0.65);
        addProp(k === 0 && rnd(5) > 0.5 ? broadleaf : bush, t, x, z, 0.8 + rnd(k + 8) * 0.5, rnd(k) * 6, undefined, green(k + 3));
      }
    } else if (t.type === "wheat" && !t.road) {
      const angle = Math.floor(rnd(2) * 3) * (Math.PI / 3);
      for (let k = -2; k <= 2; k++) {
        const off = k * 0.25;
        const len = 2 * Math.sqrt(Math.max(0, 0.74 * 0.74 - off * off));
        const purple = new THREE.Color().setHSL(0.8 + (rnd(k + 60) - 0.5) * 0.05, 0.22, 0.66 + (rnd(k + 70) - 0.5) * 0.1).multiplyScalar(1.15);
        // rows run along the rotated x axis, so step them out sideways along its normal
        addProp(furrow, t, Math.sin(angle) * off, Math.cos(angle) * off, 1, angle, 1, purple);
        propSpecs.get(furrow)!.at(-1)!.local.scale(new THREE.Vector3(len, 1, 1));
      }
    } else if (t.type === "hills") {
      for (let k = 0; k < 3; k++) {
        const [x, z] = scatter(k + 11, 0.2, 0.62);
        addProp(k === 2 ? bush : rock, t, x, z, 0.8 + rnd(k + 13) * 0.9, rnd(k) * 6);
      }
    } else if (t.type === "mountain") {
      const n = 1 + Math.floor(rnd(3) * 2.5);
      for (let k = 0; k < n; k++) {
        const [x, z] = k ? scatter(k + 17, 0.3, 0.45) : [0, 0];
        const s = (k ? 0.55 : 0.95) * (0.85 + rnd(k + 19) * 0.3);
        addProp(peak, t, x, z, s * 1.1, rnd(k) * 6, s * (0.85 + t.n * 0.7));
      }
    } else if (t.type === "marsh") {
      addProp(pool, t, -0.15, 0.1, 1 + rnd(4));
      for (let k = 0; k < 8; k++) {
        const [x, z] = scatter(k + 23, 0.25, 0.75);
        addProp(reed, t, x, z, 0.8 + rnd(k + 29) * 0.6, 0);
      }
    }
  }
  const propMat = painted(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), 0.25, 6);
  const props: { mesh: THREE.InstancedMesh; specs: PropSpec[] }[] = [];
  const propsByTile = new Map<number, { mesh: THREE.InstancedMesh; index: number; local: THREE.Matrix4 }[]>();
  for (const [geo, specs] of propSpecs) {
    const mesh = new THREE.InstancedMesh(geo, propMat, specs.length);
    mesh.castShadow = geo !== roadStrip && geo !== pool;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    specs.forEach((sp, index) => {
      mesh.setColorAt(index, sp.tint ?? new THREE.Color(1, 1, 1));
      if (!propsByTile.has(sp.tile.i)) propsByTile.set(sp.tile.i, []);
      propsByTile.get(sp.tile.i)!.push({ mesh, index, local: sp.local });
    });
    scene.add(mesh);
    props.push({ mesh, specs });
  }

  /* ---------------- Landmarks ---------------- */
  type Glow = { mat: THREE.MeshStandardMaterial; day: number; night: number };
  const glows: Glow[] = [];
  const nightLights: { light: THREE.PointLight; max: number; base?: number }[] = [];
  const mat = (color: THREE.ColorRepresentation, rough = 0.85) =>
    painted(new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true }), 0.18, 9);
  const glowMat = (color: THREE.ColorRepresentation, day: number, night: number) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: day, flatShading: true });
    glows.push({ mat: m, day, night });
    return m;
  };
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  const nightLight = (color: number, distance: number, y: number, max: number, base = 0) => {
    const light = new THREE.PointLight(color, base, distance, 1.6);
    light.position.y = y;
    nightLights.push({ light, max, base });
    return light;
  };

  let beamPivot!: THREE.Group;
  let beamMat!: THREE.ShaderMaterial;
  let blackWagon!: THREE.Group;
  let flame!: THREE.Mesh;
  let bigTop!: THREE.Group;
  const pennants: THREE.Mesh[] = [];

  function buildBellwether() {
    const g = new THREE.Group();
    const stone = mat("#ece6d6");
    const roof = mat("#b5482f");
    const roof2 = mat("#8f3b2a");
    const wood = mat("#7a5a3c");
    const windows = glowMat("#ffcf7a", 0, 2.4);
    // walls with merlons
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const wall = new THREE.Group();
      wall.position.set(Math.cos(a) * 0.74, 0, Math.sin(a) * 0.74);
      wall.rotation.y = -a + Math.PI / 2;
      wall.add(part(new THREE.BoxGeometry(0.86, 0.26, 0.09), stone, 0, 0.13, 0));
      for (let m = -3; m <= 3; m++) wall.add(part(new THREE.BoxGeometry(0.07, 0.06, 0.1), stone, m * 0.12, 0.29, 0));
      g.add(wall);
      g.add(part(new THREE.CylinderGeometry(0.08, 0.09, 0.38, 8), stone, Math.cos(a + Math.PI / 6) * 0.85, 0.19, Math.sin(a + Math.PI / 6) * 0.85));
      g.add(part(new THREE.ConeGeometry(0.1, 0.14, 8), roof2, Math.cos(a + Math.PI / 6) * 0.85, 0.45, Math.sin(a + Math.PI / 6) * 0.85));
    }
    // houses: white stone, red roofs, a lit window each
    const houses = [[-0.38, -0.18, 0.2], [0.32, -0.32, 0.4], [-0.18, 0.38, 1.1], [0.4, 0.22, 0.2], [0.02, -0.5, 0.9], [-0.52, 0.12, 0.5], [0.18, 0.5, 0.3], [-0.42, -0.42, 1.3], [0.52, -0.05, 0.7]];
    for (const [x, z, r] of houses) {
      const h = 0.14 + hash(x * 9, z * 9) * 0.1;
      g.add(part(new THREE.BoxGeometry(0.2, h, 0.16), stone, x, h / 2, z, r));
      const rf = part(new THREE.CylinderGeometry(0.001, 0.13, 0.12, 4, 1), roof, x, h + 0.06, z, r + Math.PI / 4);
      rf.scale.set(1.15, 1, 0.9);
      g.add(rf);
      g.add(part(new THREE.BoxGeometry(0.04, 0.05, 0.005), windows, x + Math.sin(r) * 0.081, h * 0.55, z + Math.cos(r) * 0.081, r));
    }
    // the 100-ft stained-glass clock tower
    const tower = new THREE.Group();
    tower.position.set(0.04, 0, 0.02);
    tower.add(part(new THREE.BoxGeometry(0.22, 1.2, 0.22), stone, 0, 0.6, 0));
    tower.add(part(new THREE.BoxGeometry(0.26, 0.06, 0.26), stone, 0, 1.2, 0));
    const glass = glowMat("#9a5ad0", 0.5, 3.2);
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * Math.PI * 2;
      tower.add(part(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 16).rotateX(Math.PI / 2), glass, Math.sin(a) * 0.112, 0.98, Math.cos(a) * 0.112, a));
      tower.add(part(new THREE.BoxGeometry(0.05, 0.16, 0.005), glowMat("#e0a84a", 0.3, 2.4), Math.sin(a) * 0.112, 0.62, Math.cos(a) * 0.112, a));
    }
    tower.add(part(new THREE.ConeGeometry(0.17, 0.46, 4), roof, 0, 1.46, 0, Math.PI / 4));
    tower.add(part(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 4), wood, 0, 1.76, 0));
    const flag = part(new THREE.PlaneGeometry(0.14, 0.08), new THREE.MeshStandardMaterial({ color: "#2f5f8a", side: THREE.DoubleSide }), 0.07, 1.8, 0);
    pennants.push(flag);
    tower.add(flag);
    g.add(tower);
    // the duelling arena
    g.add(part(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 14, 1, true), mat("#d8cdb4"), -0.08, 0.06, -0.2));
    // shanty outskirts beyond the walls
    for (const [x, z, r] of [[1.0, 0.25, 0.3], [0.95, -0.4, 1.0], [0.62, 0.78, 2.2], [-0.2, -0.95, 0.8]]) {
      g.add(part(new THREE.BoxGeometry(0.12, 0.08, 0.1), wood, x, 0.04, z, r));
      g.add(part(new THREE.BoxGeometry(0.15, 0.015, 0.13), mat("#8a8f96", 0.4), x, 0.09, z, r + 0.1));
    }
    g.add(nightLight(0xffc36b, 4, 0.7, 3));
    return g;
  }

  function buildLighthouse() {
    const g = new THREE.Group();
    g.add(part(new THREE.DodecahedronGeometry(0.42, 0), mat("#8c877d"), 0, -0.12, 0));
    g.add(part(new THREE.DodecahedronGeometry(0.22, 0), mat("#9b968a"), 0.36, -0.05, 0.2));
    const white = mat("#f3efe4");
    const red = mat("#b23b2e");
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      const y0 = 0.1 + b * 0.18;
      const r0 = 0.17 - b * 0.012;
      g.add(part(new THREE.CylinderGeometry(r0 - 0.012, r0, 0.18, 12), b % 2 ? red : white, 0, y0 + 0.09, 0));
    }
    g.add(part(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12), mat("#2a2118"), 0, 1.02, 0));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      g.add(part(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 3), mat("#2a2118"), Math.sin(a) * 0.14, 1.07, Math.cos(a) * 0.14));
    }
    g.add(part(new THREE.SphereGeometry(0.075, 12, 8), glowMat("#ffe2a0", 1.2, 6), 0, 1.13, 0));
    g.add(part(new THREE.ConeGeometry(0.12, 0.14, 12), red, 0, 1.27, 0));
    g.add(part(new THREE.BoxGeometry(0.16, 0.1, 0.12), white, 0.3, 0.05, -0.18, 0.5));
    g.add(part(new THREE.CylinderGeometry(0.001, 0.12, 0.08, 4), red, 0.3, 0.14, -0.18, 0.5 + Math.PI / 4));
    // the cone's apex sits at the lamp (uv.y = 1); light fades out along its length
    beamMat = new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform float opacity; varying vec2 vUv; void main() { gl_FragColor = vec4(1.0, 0.9, 0.68, opacity * pow(vUv.y, 2.2)); }",
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.55, 5, 24, 1, true).translate(0, -2.5, 0).rotateZ(Math.PI / 2 - 0.08), beamMat);
    beamPivot = new THREE.Group();
    beamPivot.position.y = 1.13;
    beamPivot.add(beam);
    g.add(beamPivot, nightLight(0xffd890, 7, 1.15, 4));
    return g;
  }

  function buildCarnivale() {
    const g = new THREE.Group();
    // the big top: alternating stripes
    bigTop = new THREE.Group();
    const stripeA = mat("#c23b33");
    const stripeB = mat("#f1e6c8");
    for (let k = 0; k < 10; k++) {
      const geo = new THREE.CylinderGeometry(0.001, 0.42, 0.34, 1, 1, false, (k / 10) * Math.PI * 2, (Math.PI * 2) / 10);
      bigTop.add(part(geo, k % 2 ? stripeA : stripeB, 0, 0.47, 0));
      const wall = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 1, 1, true, (k / 10) * Math.PI * 2, (Math.PI * 2) / 10);
      bigTop.add(part(wall, k % 2 ? stripeB : stripeA, 0, 0.15, 0));
    }
    bigTop.add(part(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), mat("#5b4030"), 0, 0.72, 0));
    const topFlag = part(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshStandardMaterial({ color: "#d8a030", side: THREE.DoubleSide }), 0.06, 0.78, 0);
    pennants.push(topFlag);
    bigTop.add(topFlag);
    bigTop.position.set(-0.08, 0, -0.1);
    g.add(bigTop);
    // smaller tents and painted wagons
    const tentCols = ["#2f5f8a", "#d19a2a", "#5a7a3a"];
    [[0.45, 0.3, 0.17], [0.45, -0.38, 0.15], [-0.15, 0.55, 0.14]].forEach(([x, z, s], i) => {
      g.add(part(new THREE.CylinderGeometry(s, s, s * 0.8, 8), stripeB, x, s * 0.4, z));
      g.add(part(new THREE.ConeGeometry(s * 1.15, s * 1.1, 8), mat(tentCols[i]), x, s * 0.8 + s * 0.55, z));
    });
    for (const [x, z, r, c] of [[0.7, 0.0, 1.2, "#7a3a8a"], [0.15, -0.68, 0.3, "#2f6f6a"]] as const) {
      const wagon = new THREE.Group();
      wagon.position.set(x, 0, z);
      wagon.rotation.y = r;
      wagon.add(part(new THREE.BoxGeometry(0.28, 0.16, 0.15), mat(c), 0, 0.13, 0));
      wagon.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.28, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), mat("#e9dcb8"), 0, 0.21, 0));
      g.add(wagon);
    }
    // strings of lights between poles
    const bulbs = glowMat("#ffd27a", 0.6, 4);
    const poles: [number, number][] = [[-0.6, -0.5], [0.65, -0.62], [0.78, 0.55], [-0.55, 0.62]];
    for (const [x, z] of poles) g.add(part(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), mat("#5b4030"), x, 0.25, z));
    for (let p = 0; p < poles.length; p++) {
      const [x0, z0] = poles[p];
      const [x1, z1] = poles[(p + 1) % poles.length];
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        const sag = Math.sin(t * Math.PI) * 0.12;
        g.add(part(new THREE.SphereGeometry(0.018, 6, 4), bulbs, x0 + (x1 - x0) * t, 0.48 - sag, z0 + (z1 - z0) * t));
      }
    }
    // Trilby's hiding place, GM only
    blackWagon = new THREE.Group();
    blackWagon.position.set(-0.62, 0, 0.1);
    blackWagon.add(part(new THREE.BoxGeometry(0.3, 0.2, 0.17), mat("#16130f"), 0, 0.15, 0));
    blackWagon.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.005), glowMat("#ff8a3a", 0.2, 1.5), 0.08, 0.17, 0.088));
    g.add(blackWagon, nightLight(0xffb85c, 5, 0.8, 3.5));
    return g;
  }

  function buildGallows() {
    const g = new THREE.Group();
    const bark = mat("#2b2420");
    g.add(part(new THREE.CylinderGeometry(0.06, 0.12, 0.95, 6), bark, 0, 0.47, 0));
    const limb = part(new THREE.CylinderGeometry(0.03, 0.05, 0.8, 5), bark, 0.24, 0.86, 0);
    limb.rotation.z = -1.2;
    const limb2 = part(new THREE.CylinderGeometry(0.025, 0.045, 0.55, 5), bark, -0.16, 0.98, 0.05);
    limb2.rotation.z = 0.95;
    const limb3 = part(new THREE.CylinderGeometry(0.02, 0.035, 0.45, 5), bark, 0.02, 1.1, -0.12);
    limb3.rotation.x = 0.7;
    g.add(limb, limb2, limb3);
    const rope = new THREE.LineBasicMaterial({ color: 0x1a1612 });
    for (const x of [0.24, 0.42, 0.56]) {
      const top = new THREE.Vector3(x, 0.88 - (x - 0.2) * 0.32, 0);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top, new THREE.Vector3(x, 0.62, 0)]), rope));
      g.add(part(new THREE.CapsuleGeometry(0.035, 0.15, 2, 6), mat("#3b342c"), x, 0.5, 0));
    }
    // crows
    for (const [x, y, z] of [[-0.2, 1.12, 0.1], [0.4, 0.92, 0.02]]) {
      g.add(part(new THREE.ConeGeometry(0.03, 0.09, 4).rotateZ(Math.PI / 2), mat("#141210"), x, y, z));
    }
    return g;
  }

  function buildBrightstone() {
    const g = new THREE.Group();
    const pale = mat("#e2ddd0");
    g.add(part(new THREE.BoxGeometry(0.72, 0.32, 0.46), pale, 0, 0.16, 0));
    g.add(part(new THREE.BoxGeometry(0.22, 0.6, 0.22), pale, -0.32, 0.3, -0.14));
    g.add(part(new THREE.ConeGeometry(0.17, 0.2, 4), mat("#6f6a64"), -0.32, 0.7, -0.14, Math.PI / 4));
    for (const x of [-0.2, -0.05, 0.1]) g.add(part(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), pale, x, 0.14, 0.27));
    const broken = part(new THREE.BoxGeometry(0.26, 0.2, 0.3), pale, 0.3, 0.38, 0.02);
    broken.rotation.z = 0.45;
    g.add(broken);
    const ooze = glowMat("#ff8a1e", 1.4, 3.4);
    for (const [x, z, rot, l] of [[-0.1, 0.32, 0.4, 0.4], [0.24, 0.3, -0.3, 0.3], [0.45, -0.1, 1.2, 0.35], [-0.5, 0.2, 2.1, 0.25]]) {
      g.add(part(new THREE.BoxGeometry(l, 0.025, 0.045), ooze, x, 0.015, z, rot));
    }
    g.add(nightLight(0xff7a1a, 3, 0.3, 2, 0.4));
    return g;
  }

  function buildGoat() {
    const g = new THREE.Group();
    const wood = mat("#6a4a32");
    g.add(part(new THREE.BoxGeometry(0.4, 0.2, 0.16), wood, 0, 0.5, 0));
    for (const [x, z] of [[-0.15, -0.06], [0.15, -0.06], [-0.15, 0.06], [0.15, 0.06]]) {
      g.add(part(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 4), wood, x, 0.2, z));
    }
    g.add(part(new THREE.BoxGeometry(0.12, 0.2, 0.1), wood, 0.24, 0.66, 0));
    g.add(part(new THREE.ConeGeometry(0.02, 0.12, 4).rotateZ(-0.5), wood, 0.28, 0.8, 0.04));
    g.add(part(new THREE.ConeGeometry(0.02, 0.12, 4).rotateZ(-0.5), wood, 0.28, 0.8, -0.04));
    const fire = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff8a2a").multiplyScalar(2.2), transparent: true, opacity: 0.9 });
    flame = part(new THREE.ConeGeometry(0.17, 0.5, 7), fire, 0.02, 0.82, 0);
    flame.castShadow = false;
    g.add(flame, nightLight(0xff8a30, 5, 0.9, 3, 1.2));
    return g;
  }

  function buildSign() {
    const g = new THREE.Group();
    const wood = mat("#7a5a3c");
    g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), wood, 0, 0.3, 0));
    g.add(part(new THREE.BoxGeometry(0.42, 0.1, 0.03), wood, 0.12, 0.5, 0));
    g.add(part(new THREE.ConeGeometry(0.07, 0.1, 3).rotateZ(-Math.PI / 2), wood, 0.36, 0.5, 0));
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
  const landmarkByTile = new Map<number, THREE.Group>();
  for (const [id, build] of Object.entries(builders) as [PlaceId, () => THREE.Group][]) {
    const t = tileAt(PLACES[id].c, PLACES[id].r)!;
    // the city is the heart of the map, so it stands a little larger than the rest
    const g = new THREE.Group();
    const model = build();
    if (id === "bellwether") model.scale.setScalar(1.35);
    g.add(model);
    g.position.set(t.x, 0, t.z);
    g.visible = false;
    scene.add(g);
    landmarkByTile.set(t.i, g);
  }

  const hunters = new THREE.Group();
  {
    const cloak = mat("#8d9096");
    const hood = mat("#6f7278");
    for (const [x, z] of [[-0.22, 0.05], [0, -0.12], [0.22, 0.08]]) {
      hunters.add(part(new THREE.ConeGeometry(0.1, 0.4, 7), cloak, x, 0.2, z));
      hunters.add(part(new THREE.SphereGeometry(0.06, 8, 6), hood, x, 0.42, z));
    }
    hunters.add(part(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 12).rotateX(Math.PI / 2), glowMat("#ffcf5a", 1.5, 3), 0, 0.36, -0.08));
  }
  scene.add(hunters);

  /* ---------------- Party miniature, with the eye coin while Tulk carries it ---------------- */
  const party = new THREE.Group();
  party.add(part(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 24), new THREE.MeshStandardMaterial({ color: "#8a6a3a", metalness: 0.6, roughness: 0.35 }), 0, 0.025, 0));
  for (const [color, x, z] of [["#8a3a2a", -0.14, -0.08], ["#2f4f7a", 0.12, -0.1], ["#5a6a2f", -0.08, 0.13], ["#7a5a2a", 0.14, 0.1]] as const) {
    party.add(part(new THREE.ConeGeometry(0.075, 0.24, 8), mat(color), x, 0.17, z));
    party.add(part(new THREE.SphereGeometry(0.05, 10, 8), mat("#e8cfa8"), x, 0.32, z));
  }
  party.add(part(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4), mat("#3a2a1a"), 0.22, 0.26, -0.18));
  const banner = part(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ color: "#a33a2a", side: THREE.DoubleSide }), 0.29, 0.42, -0.18);
  pennants.push(banner);
  party.add(banner);
  const eye = new THREE.Group();
  eye.position.y = 0.85;
  eye.add(new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.035, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xd9a830, emissive: 0xc08a20, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.25 }),
  ));
  eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2a2118 })));
  const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd36b).multiplyScalar(1.6), transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  eye.add(new THREE.Mesh(new THREE.RingGeometry(0.17, 0.3, 32), haloMat));
  party.add(eye);
  scene.add(party);

  /* ---------------- Trail of gold dashes, pins, rings ---------------- */
  const MAX_DASHES = 4000;
  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.15, 0.025, 0.06),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc24a").multiplyScalar(1.4) }),
    MAX_DASHES,
  );
  dashes.frustumCulled = false;
  scene.add(dashes);
  const pinGroup = new THREE.Group();
  scene.add(pinGroup);

  const surfaceY = (t: Tile) => (isWater(t) ? WATER_Y : BASE + t.height);
  const hexPoints = (t: Tile, y: number, s = HEX_R) =>
    Array.from({ length: 7 }, (_, k) => {
      const a = ((k % 6) / 6) * Math.PI * 2;
      return new THREE.Vector3(t.x + Math.sin(a) * s, y, t.z + Math.cos(a) * s);
    });
  const selRing = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color("#ffd36b").multiplyScalar(1.5) }));
  const hoverRing = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.8 }));
  selRing.visible = hoverRing.visible = false;
  scene.add(selRing, hoverRing);
  const ringAt = (ring: THREE.Line, t: Tile | null) => {
    ring.visible = Boolean(t);
    if (t) ring.geometry.setFromPoints(hexPoints(t, (rise[t.i] > 0.5 ? surfaceY(t) : 0) + 0.03, 0.9));
  };

  /* ---------------- Rising tiles ---------------- */
  // rise[i] animates 0 → 1 as a hex is revealed: it climbs out of the paper and its props grow.
  const rise = new Float32Array(tiles.length);
  const riseTarget = new Float32Array(tiles.length);
  const animating = new Set<number>();
  const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  const m4 = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const waterIndex = new Map(waterTiles.map((t, i) => [t.i, i]));

  function placeTile(t: Tile) {
    const e = easeOut(rise[t.i]);
    if (e <= 0.001) {
      caps.setMatrixAt(t.i, HIDDEN);
      skirts.setMatrixAt(t.i, HIDDEN);
      const wi = waterIndex.get(t.i);
      if (wi !== undefined) waterSurf.setMatrixAt(wi, HIDDEN);
      for (const p of propsByTile.get(t.i) ?? []) p.mesh.setMatrixAt(p.index, HIDDEN);
      const lm = landmarkByTile.get(t.i);
      if (lm) lm.visible = false;
      return;
    }
    const top = (BASE + t.height) * e;
    caps.setMatrixAt(t.i, m4.makeTranslation(t.x, top, t.z));
    const wall = Math.max(0.02, (isWater(t) ? WATER_Y * e : top - 0.07));
    skirts.setMatrixAt(t.i, m4.makeScale(1, wall, 1).setPosition(t.x, 0, t.z));
    const wi = waterIndex.get(t.i);
    if (wi !== undefined) waterSurf.setMatrixAt(wi, m4.makeTranslation(t.x, WATER_Y * e, t.z));
    for (const p of propsByTile.get(t.i) ?? []) {
      m4.makeTranslation(t.x, top, t.z).multiply(tmp.makeScale(e, e, e)).multiply(p.local);
      p.mesh.setMatrixAt(p.index, m4);
    }
    const lm = landmarkByTile.get(t.i);
    if (lm) {
      lm.visible = true;
      lm.position.y = isWater(t) ? WATER_Y * e : top;
      lm.scale.setScalar(Math.max(0.001, e));
    }
  }
  function flushTiles() {
    caps.instanceMatrix.needsUpdate = true;
    skirts.instanceMatrix.needsUpdate = true;
    waterSurf.instanceMatrix.needsUpdate = true;
    for (const p of props) p.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- Fog-aware refresh ---------------- */
  const GREY = new THREE.Color("#c9c2b0");
  function refresh(instant = false) {
    const col = new THREE.Color();
    for (const t of tiles) {
      const target = fogOf(t) >= 2 ? 1 : 0;
      riseTarget[t.i] = target;
      if (instant || reducedMotion) {
        rise[t.i] = target;
        animating.delete(t.i);
      } else if (rise[t.i] !== target) animating.add(t.i);
      placeTile(t);
      col
        .set(t.road && !t.place ? ROAD_COLOR : TERRAIN[t.type].color)
        .offsetHSL((hash(t.r, t.c) - 0.5) * 0.03, (hash(t.c + 3, t.r) - 0.5) * 0.08, (hash(t.c, t.r) - 0.5) * 0.1);
      if (fogOf(t) === 2 && !gm()) col.lerp(GREY, 0.3);
      caps.setColorAt(t.i, col);
      skirts.setColorAt(t.i, col.set(skirtColor(t)));
    }
    flushTiles();
    caps.instanceColor!.needsUpdate = true;
    skirts.instanceColor!.needsUpdate = true;
    drawPaper();
    blackWagon.visible = gm();
    rebuildTrail();
    rebuildPins();
    const ht = huntersTile(map, S);
    hunters.position.set(ht.x - 0.2, surfaceY(ht), ht.z + 0.2);
    hunters.visible = gm() || (S.huntersShown && fogOf(ht) >= 2);
    ringAt(selRing, selected);
  }

  function rebuildTrail() {
    const points = S.trail.map((i) => tiles[i]).map((t) => new THREE.Vector3(t.x, surfaceY(t) + 0.06, t.z));
    let n = 0;
    if (points.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
      const len = curve.getLength();
      const count = Math.min(MAX_DASHES, Math.floor(len / 0.24));
      const p = new THREE.Vector3();
      const ahead = new THREE.Vector3();
      for (; n < count; n++) {
        const u = n / count;
        curve.getPointAt(u, p);
        curve.getPointAt(Math.min(1, u + 0.001), ahead);
        tmp.lookAt(ahead, p, new THREE.Vector3(0, 1, 0));
        m4.makeRotationFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(tmp)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        m4.setPosition(p);
        dashes.setMatrixAt(n, m4);
      }
    }
    dashes.count = n;
    dashes.instanceMatrix.needsUpdate = true;
  }

  const pinStick = new THREE.CylinderGeometry(0.01, 0.01, 0.55, 4);
  const pinFlag = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.12, 0), new THREE.Vector3(0.16, -0.06, 0),
  ]);
  pinFlag.computeVertexNormals();
  const pinMats = {
    table: new THREE.MeshStandardMaterial({ color: "#a32e22", side: THREE.DoubleSide }),
    gm: new THREE.MeshStandardMaterial({ color: "#4a4e56", side: THREE.DoubleSide }),
    stick: mat("#2a2118"),
  };
  function rebuildPins() {
    pinGroup.clear();
    const perTile = new Map<number, number>();
    for (const p of S.pins) {
      const t = tileAt(p.c, p.r);
      if (!t || fogOf(t) < 2 || (p.gm && !gm())) continue;
      const n = perTile.get(t.i) ?? 0;
      perTile.set(t.i, n + 1);
      const g = new THREE.Group();
      g.position.set(t.x + 0.58 - n * 0.17, surfaceY(t), t.z - 0.38);
      g.add(part(pinStick, pinMats.stick, 0, 0.275, 0), part(pinFlag, p.gm ? pinMats.gm : pinMats.table, 0, 0.55, 0));
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
    addLabel(p.name, tileAt(p.c, p.r)!, p.big ? "is-big" : "", id === "bellwether" ? 2.2 : 1.6, false);
  }
  for (const a of AREA_LABELS) addLabel(a.text, tileAt(a.c, a.r)!, `${a.big ? "is-big" : ""} is-area`, a.lift + 0.4, true);
  const hunterLabel = document.createElement("div");
  hunterLabel.className = "hexmap-label is-gm";
  labelLayer.appendChild(hunterLabel);

  const projected = new THREE.Vector3();
  const place = (el: HTMLElement, v: THREE.Vector3) => {
    projected.copy(v).project(camera);
    const { w, h } = size();
    const y = (-projected.y * 0.5 + 0.5) * h;
    // lettering that would be cut off by the top edge is left off rather than shown half-drawn
    el.hidden = projected.z > 1 || y < 22;
    el.style.transform = `translate(${(projected.x * 0.5 + 0.5) * w}px, ${y}px) translate(-50%, -100%)`;
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
      const y = fog >= 2 ? surfaceY(l.t) * easeOut(rise[l.t.i]) : 0;
      place(l.el, anchor.set(l.t.x, y + l.lift, l.t.z));
    }
    hunterLabel.hidden = !hunters.visible;
    if (hunters.visible) {
      hunterLabel.textContent = gm() && !S.huntersShown ? "Hunters (hidden from table)" : "Grey-cloaked hunters";
      place(hunterLabel, anchor.copy(hunters.position).setY(hunters.position.y + 0.85));
    }
  }

  /* ---------------- Time and light ---------------- */
  let night = 0;
  function applyTime() {
    const hour = S.time % 24;
    const L = lightAt(hour);
    night = L.night;
    const angle = ((hour - 6) / 12) * Math.PI;
    const elevation = Math.sin(angle);
    // after dark the key light is the moon, opposite the sun
    const a = elevation > -0.05 ? angle : angle + Math.PI;
    const el = Math.max(0.18, Math.abs(Math.sin(a)));
    // light from the viewer's side so faces turned to the table are lit and shadows fall away north
    sun.position.set(mapCenter.x + Math.cos(a) * 40, el * 40 + 8, mapCenter.z + 16);
    sun.color.set(L.sun);
    sun.intensity = L.sunI;
    hemi.color.set(L.hemiSky);
    hemi.groundColor.set(L.hemiGround);
    hemi.intensity = L.hemiI;
    skyUniforms.top.value.set(L.top);
    skyUniforms.horizon.value.set(L.horizon);
    (scene.fog as THREE.Fog).color.set(L.horizon);
    renderer.toneMappingExposure = L.exposure;
    paperMat.emissiveIntensity = 0.1 + night * 0.06;
    bloom.strength = 0.25 + night * 0.75;
    for (const g of glows) g.mat.emissiveIntensity = g.day + (g.night - g.day) * night;
  }

  /* ---------------- Travel ---------------- */
  const partyPos = new THREE.Vector3();
  const partyGoal = new THREE.Vector3();
  const setPartyGoal = (t: Tile) => partyGoal.set(t.x, surfaceY(t), t.z);

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
      await new Promise((r) => setTimeout(r, 480));
    }
    moving = false;
    save();
    const newDay = dayOf(S.time) !== dayBefore ? `; day ${dayOf(S.time)} begins` : "";
    say(`${path.length} ${path.length === 1 ? "hex" : "hexes"}, about ${path.length * 6} miles${newDay}.`);
  }

  /* ---------------- Picking ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function tileAtPoint(x: number, z: number) {
    const r = z / 1.5;
    const q = x / SQ3 - r / 2;
    const s = -q - r;
    let rq = Math.round(q), rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    const [c, row] = fromCube(rq, rr);
    return tileAt(c, row) ?? null;
  }
  function pick(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([caps, waterSurf, paper], false)[0];
    if (!hit) return null;
    if (hit.object === caps && hit.instanceId != null) return tiles[hit.instanceId];
    return tileAtPoint(hit.point.x, hit.point.z);
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
    composer.setSize(w, h);
  });
  resize.observe(container);

  /* ---------------- Loop ---------------- */
  setPartyGoal(tiles[S.party]);
  partyPos.copy(partyGoal);
  /** Points the camera at everything the table has seen, pulled back far enough to fit it. */
  function frameKnown() {
    const known = tiles.filter((t) => S.fog[t.i] >= 2);
    const box = new THREE.Box3();
    for (const t of known) box.expandByPoint(new THREE.Vector3(t.x, BASE, t.z));
    box.min.z = Math.max(0, box.min.z - 3); // leave room for the lettering above the explored land
    const mid = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
    const dist = Math.min(controls.maxDistance, Math.max(14, (span.x / 2 + 2) / Math.tan(halfH), (span.z / 2 + 3) / Math.tan(halfV)) * 1.08);
    controls.target.set(mid.x, BASE, mid.z + 0.6);
    camera.position.set(mid.x + dist * 0.05, BASE + dist * 0.68, mid.z + 0.6 + dist * 0.73);
  }
  frameKnown();

  let replay: { curve: THREE.CatmullRomCurve3; t0: number; dur: number } | null = null;
  const clock = new THREE.Clock();
  const lastTarget = new THREE.Vector3();
  const replayOffset = new THREE.Vector3(3.5, 6.5, 7.5);
  let frame = 0;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    if (animating.size) {
      for (const i of [...animating]) {
        const target = riseTarget[i];
        rise[i] += Math.sign(target - rise[i]) * dt * 1.6;
        if ((target === 1 && rise[i] >= 1) || (target === 0 && rise[i] <= 0)) {
          rise[i] = target;
          animating.delete(i);
        }
        placeTile(tiles[i]);
      }
      flushTiles();
    }
    partyPos.lerp(partyGoal, 1 - Math.pow(0.0005, dt));
    party.position.copy(partyPos);
    party.position.y += Math.abs(Math.sin(time * 9)) * (partyPos.distanceTo(partyGoal) > 0.05 ? 0.06 : 0);
    eye.position.y = 0.85 + Math.sin(time * 2) * 0.05;
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
      waterTime.value = time;
      for (const [i, f] of pennants.entries()) f.rotation.y = Math.sin(time * 3 + i) * 0.35;
      flame.scale.set(1 + Math.sin(time * 11) * 0.06, 1 + Math.sin(time * 13) * 0.14 + Math.sin(time * 7.3) * 0.08, 1);
      bigTop.rotation.y = Math.sin(time * 0.3) * 0.02;
    }
    beamPivot.rotation.y = time * 0.6;
    beamMat.uniforms.opacity.value = Math.max(0, night - 0.25) * 0.5;
    for (const n of nightLights) n.light.intensity = (n.base ?? 0) + night * n.max;
    controls.update();
    composer.render();
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
      const points = S.trail.map((i) => tiles[i]).map((t) => new THREE.Vector3(t.x, surfaceY(t), t.z));
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
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.replaceChildren();
    },
  };

  applyTime();
  refresh(true);
  emit();
  loop();
  return controller;
}

/* ---------------- Parchment drawing ---------------- */

/** Paper grain, stains, a double border and a compass rose, drawn once. */
function drawPaperBase(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ecdcb4";
  ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // broad stains and foxing
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h, r = 60 + rnd() * 260;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.5;
    g.addColorStop(0, dark ? "rgba(150,108,58,0.10)" : "rgba(255,248,226,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // grain
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? "90,62,30" : "255,250,235"},${0.03 + rnd() * 0.07})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 1.5);
  }
  // fibres
  ctx.strokeStyle = "rgba(110,80,40,0.06)";
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w, y = rnd() * h, a = rnd() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (6 + rnd() * 18), y + Math.sin(a) * (6 + rnd() * 18));
    ctx.stroke();
  }
  // darkened edges
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(110,70,30,0.32)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  // double border
  ctx.strokeStyle = "rgba(58,40,24,0.75)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  // compass rose, bottom left
  const cx = 150, cy = h - 150, R = 92;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(58,40,24,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.68, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const len = k % 2 ? R * 0.55 : R;
    ctx.save();
    ctx.rotate((k / 8) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(len * 0.12, 0);
    ctx.lineTo(0, len * 0.04);
    ctx.closePath();
    ctx.fillStyle = "rgba(58,40,24,0.85)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(-len * 0.12, 0);
    ctx.lineTo(0, len * 0.04);
    ctx.closePath();
    ctx.fillStyle = "rgba(236,220,180,0.95)";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(58,40,24,0.9)";
  ctx.font = "italic 34px Alegreya, Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -R - 12);
  ctx.restore();
  // cartouche, bottom right
  ctx.font = "italic 40px Alegreya, Georgia, serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(58,40,24,0.85)";
  ctx.fillText("The Roads of Eldspire", w - 70, h - 70);
  ctx.font = "italic 24px Alegreya, Georgia, serif";
  ctx.fillText("as walked by Tulk, Tharn, Thaniel & Roro", w - 70, h - 38);
  return c;
}

/** Ink sketches for rumoured hexes: peaks, trees, waves, a tower. */
function drawGlyph(ctx: CanvasRenderingContext2D, t: Tile, cx: number, cy: number, unit: number) {
  const s = unit * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(58,40,24,0.75)";
  ctx.fillStyle = "rgba(58,40,24,0.75)";
  ctx.lineWidth = 2;
  const peak = (x: number, y: number, k: number) => {
    ctx.beginPath();
    ctx.moveTo(x - k, y + k * 0.6);
    ctx.lineTo(x, y - k * 0.7);
    ctx.lineTo(x + k, y + k * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - k * 0.7);
    ctx.lineTo(x + k * 0.35, y + k * 0.6);
    ctx.stroke();
  };
  if (t.place) {
    ctx.strokeRect(-s * 0.3, -s * 0.2, s * 0.6, s * 0.6);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.2);
    ctx.lineTo(0, -s * 0.65);
    ctx.lineTo(s * 0.4, -s * 0.2);
    ctx.stroke();
  } else if (t.type === "mountain") {
    peak(-s * 0.35, s * 0.1, s * 0.5);
    peak(s * 0.35, -s * 0.05, s * 0.62);
  } else if (t.type === "hills") {
    for (const [x, y] of [[-s * 0.3, 0], [s * 0.3, s * 0.15]]) {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, Math.PI, 0);
      ctx.stroke();
    }
  } else if (t.type === "forest") {
    for (const [x, y] of [[-s * 0.35, s * 0.1], [s * 0.3, s * 0.05], [0, -s * 0.3]]) {
      ctx.beginPath();
      ctx.arc(x, y - s * 0.15, s * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.03);
      ctx.lineTo(x, y + s * 0.25);
      ctx.stroke();
    }
  } else if (t.type === "deep" || t.type === "water" || t.type === "marsh") {
    for (const y of [-s * 0.2, s * 0.15]) {
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const x = -s * 0.5 + (k / 12) * s;
        const yy = y + Math.sin((k / 12) * Math.PI * 3) * s * 0.08;
        if (k) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  } else {
    for (let k = 0; k < 5; k++) ctx.fillRect(((k * 37) % 7 - 3) * s * 0.12, ((k * 53) % 5 - 2) * s * 0.14, 2.5, 2.5);
  }
  ctx.restore();
}
