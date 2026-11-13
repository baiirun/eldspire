---
date: 2026-02-07
topic: 3d-hex-map
---

# 3D Hex Map — Standalone Desktop App

## What We're Building

A standalone Rust desktop application (separate repository) that renders a 200x200 (40,000 hex) **2.5D hex map** with an illustrated/painterly visual style. The map serves as both a **campaign world map** for the Eldspire TTRPG setting and a **gameplay tool** used during sessions at the table via a shared screen (TV/projector).

The hex grid is geometrically flat — elevation is conveyed entirely through art. Each hex has a 3D base, but terrain details (trees, buildings, mountains) are rendered as **billboards/sprites** that face the fixed isometric camera. This gives the map the look of an animated illustrated world map with depth.

Each hex displays subtle ambient animation (grass sways, water ripples, snow drifts, trees sway) driven by shader-based motion. Hexes can be assigned one of ~9 terrain types, and special hexes support keyed unique content — a town hex renders a town, a ruins hex renders ancient structures, etc. Roads and similar features are an overlay layer on top of base terrain.

The app includes a **built-in DM editor** for painting terrain, placing landmarks, and managing per-hex fog of war. The map is separate from the Eldspire web app (the wiki stays on eldspire.com).

## Why This Approach

### Approaches Considered

1. **Bevy Engine** — Batteries-included Rust ECS game engine. Fastest time-to-first-result, large ecosystem, but pre-1.0 with breaking changes and ECS overhead for a specialized renderer.

2. **wgpu + Custom Engine (Chosen)** — Build directly on wgpu with winit for windowing and egui for editor UI. Total control over the rendering pipeline, optimized specifically for this 2.5D hex grid with instancing and simple culling.

3. **Godot + Rust (GDExtension)** — Mature 3D engine with Rust for perf-critical code. Two-language boundary adds friction; less pure-Rust.

### Why wgpu + Custom

The hex map is a specialized rendering problem: a fixed-zoom 2.5D view of ~50-80 hexes at a time, each with billboard sprites and shader-driven animation. A custom renderer on wgpu can be optimized exactly for this — instanced rendering per terrain type, simple frustum culling on axial coordinates, and full control over the sprite/shader pipeline. No ECS overhead, no framework churn, just the rendering primitives needed.

The fixed zoom level (no LoD needed) and 2.5D approach (billboards, not full 3D meshes) dramatically simplify the rendering problem. The tradeoff is more upfront boilerplate (camera, input, asset loading), but for a specialized tool like this, owning the stack pays off in control and simplicity.

## Key Decisions

- **Standalone desktop app**: Separate from the web wiki. No need to fit 3D rendering into Cloudflare Workers.
- **Rust + wgpu**: Custom rendering pipeline for maximum performance and control. Uses winit for windowing, egui for editor UI.
- **200x200 hex grid**: ~40,000 hexes total, but only ~50-80 visible at a time due to fixed zoom.
- **Illustrated/painterly style**: Hand-drawn aesthetic with stylized textures. Matches the old-world, bookish feel of the Eldspire site. Assets created via AI generation + hand-tuning.
- **Subtle ambient animation**: Shader-driven per-terrain-type (grass sway, water ripple, snow drift, tree sway). Not full scene animation.
- **9 terrain types at launch**: Grasslands, forest, mountains, water, swamp, snow/tundra, towns, ruins, roads.
- **Roads as overlay layer**: Roads (and potentially rivers, borders later) are a separate layer on top of base terrain. A forest hex with a road is still a forest.
- **Axial coordinate system (q, r)**: Standard hex grid coordinates. Convert to cube (x, y, z) when needed for distance/ring calculations.
- **Binary persistence (bincode 2 + serde)**: Fast load/save, compact (~200KB for 40k hexes). Magic number (b"ELDM") + version header for forward compatibility.
- **Fixed isometric camera, fixed zoom**: Fixed tilt angle (45-60°), WASD/drag to pan, **no zoom** (fixed zoom level showing ~50-80 hexes). Eliminates LoD complexity entirely — every visible hex is always rendered at full detail. Only basic frustum culling needed (trivial with axial coords).
- **Per-hex fog of war**: Each hex has a visibility state (hidden / revealed). DM reveals hexes individually or by region.
- **Local shared screen**: DM runs the app on a shared screen (TV/projector). No networking. DM has editor controls; players see the revealed map.
- **Built-in DM editor (MVP)**: Brush mode — select terrain from palette, click/drag to paint hexes. Undo/redo stack (50 ops). Toggle between DM mode (editor visible) and player mode (clean map, no UI) via Tab.
- **2.5D rendering with billboards**: Flat hex geometry, terrain details as camera-facing sprites. Performant, natural for the illustrated aesthetic, and works perfectly with a fixed camera.
- **Flat hex geometry**: No physical height variation. Mountains, trees, and buildings are conveyed through billboard art, not mesh height. Simplifies rendering and hex-to-hex transitions.
- **AI-generated + hand-tuned assets**: Terrain sprites created via AI image generation, then hand-adjusted for consistency and style.
- **Separate repository**: New repo (e.g., `eldspire-hexmap`). Clean separation from the TypeScript web app, independent toolchain and CI.

- **Flat-top hex orientation**: Classic world map style. Affects coordinate-to-pixel conversion and sprite orientation.
- **Brush-mode painting**: Select terrain, click/drag to paint. Left-click paints, Space+left-drag pans. WASD also pans.
- **Road data model**: 6-bit edge bitmask per hex. Renderer selects road sprite (straight, curve, T, cross) based on connected edges.
- **New map defaults**: All grassland terrain, all fog hidden. DM reveals progressively.
- **Undo/redo in V1**: Simple stack (50 operations). Ctrl+Z / Ctrl+Shift+Z.

## Open Questions

- **Sprite format and pipeline**: PNG sheets? Individual PNGs? What resolution per terrain sprite? How many variants per terrain type for visual variety?
- **Web app integration**: Any future plans to link map hexes to wiki pages, even across apps?
- **Keyed hex metadata**: Beyond terrain type, what data does a keyed hex store? Just a name? Notes? Link to wiki? How is this displayed (tooltip, side panel)?

## Next Steps

-> Plan created: `docs/plans/2026-02-07-feat-3d-hex-map-renderer-plan.md`
