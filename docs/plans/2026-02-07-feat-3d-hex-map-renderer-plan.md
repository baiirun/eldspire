---
title: "feat: 3D Hex Map Renderer"
type: feat
date: 2026-02-07
brainstorm: docs/brainstorms/2026-02-07-3d-hex-map-brainstorm.md
---

# feat: 3D Hex Map Renderer — Standalone Desktop App

## Overview

Build a standalone Rust desktop application that renders a 200x200 hex grid as a 2.5D illustrated/painterly campaign map for the Eldspire TTRPG. The app serves as both a world map viewer and a gameplay tool used at the table via a shared screen (TV/projector). It includes a built-in DM editor for painting terrain, placing landmarks, and managing per-hex fog of war.

The renderer is built on **wgpu** (custom pipeline, no game engine), with **winit** for windowing, **egui** for editor UI, and **glam** for math. The hex grid uses flat-top hexes with axial (q, r) coordinates, a fixed isometric camera (no zoom, ~50-80 hexes visible), and 2.5D rendering (flat hex geometry + billboard sprites for terrain details).

## Problem Statement

The Eldspire campaign needs a visual hex map that:
- Renders an illustrated world map with animated terrain at the table
- Lets the DM edit terrain, place landmarks, and control fog of war during sessions
- Runs on a shared screen (TV/projector) with a clean player-facing view
- Persists map state between sessions

No existing tool combines hex-grid editing, animated 2.5D rendering, a painterly aesthetic, and DM-specific fog of war controls in a single lightweight desktop app.

## Proposed Solution

A custom Rust application using wgpu for GPU-accelerated rendering. Key architectural choices:

- **wgpu + custom renderer** — no game engine overhead, optimized for instanced hex grid rendering
- **2.5D flat hex geometry + billboard sprites** — performant, natural for the illustrated aesthetic, works perfectly with a fixed isometric camera
- **Fixed zoom (~50-80 hexes visible)** — eliminates LoD complexity, every visible hex at full detail
- **egui overlay for editor** — immediate mode UI on top of the custom scene, with input routing (egui consumes clicks on panels, map gets the rest)
- **Binary persistence (bincode)** — ~200KB for a full 200x200 map, fast load/save

## Technical Approach

### Architecture

```
main.rs
  └─ EventLoop → App (ApplicationHandler)
       ├─ resumed()      → create Window, init wgpu, init egui
       ├─ window_event()
       │    ├─ egui_winit_state.on_window_event() → if consumed, skip
       │    ├─ handle input (WASD pan, Space+drag pan, click paint, hotkeys)
       │    └─ RedrawRequested → update() + render()
       ├─ about_to_wait() → window.request_redraw()
       └─ render()
            ├─ CPU: frustum cull → build instance buffers (visible hexes only)
            ├─ Pass 1: hex terrain (instanced, textured, animated)
            ├─ Pass 2: road overlays (instanced, alpha-blended)
            ├─ Pass 3: billboard sprites (instanced, alpha-tested, depth-sorted)
            ├─ Pass 4: fog of war overlay (instanced, semi-transparent)
            └─ Pass 5: egui (LoadOp::Load, renders on top)
```

### Project Structure

```
eldspire-hexmap/
├── Cargo.toml
├── src/
│   ├── main.rs                 # Entry point, winit event loop
│   ├── app.rs                  # ApplicationHandler, owns all state
│   │
│   ├── renderer/
│   │   ├── mod.rs              # Renderer struct, init, frame()
│   │   ├── pipeline.rs         # Pipeline creation helpers
│   │   ├── texture.rs          # Texture/atlas loading, sprite atlas management
│   │   ├── camera.rs           # Fixed isometric camera, view/proj matrices, pan logic
│   │   ├── hex_pass.rs         # Hex terrain instanced draw + animation uniforms
│   │   ├── sprite_pass.rs      # Billboard sprite instanced draw
│   │   ├── road_pass.rs        # Road overlay instanced draw
│   │   ├── fog_pass.rs         # Fog of war overlay draw
│   │   └── egui_pass.rs        # egui integration wrapper
│   │
│   ├── hex/
│   │   ├── mod.rs              # Hex coordinate type (q, r), axial math, neighbors, pixel conversion
│   │   ├── map.rs              # HexMap: 200x200 flat array storage, get/set, iterate, bounds check
│   │   └── terrain.rs          # Terrain enum (9 types), terrain properties, road edge bitmask
│   │
│   ├── editor/
│   │   ├── mod.rs              # Editor state: mode (DM/player), active tool, selected terrain
│   │   ├── tools.rs            # Brush tool (paint terrain), fog tool (reveal/hide), road tool
│   │   ├── panels.rs           # egui panel definitions (terrain palette, tool selector, menu bar)
│   │   └── history.rs          # Undo/redo stack (last 50 operations)
│   │
│   ├── persistence/
│   │   ├── mod.rs              # Save/load API: save_map(), load_map(), new_map()
│   │   └── format.rs           # MapFile struct: magic + version + dimensions + tiles + roads + fog + metadata
│   │
│   ├── input/
│   │   ├── mod.rs              # Input state: keys held, mouse position, space-drag state
│   │   └── keybinds.rs         # Keybind definitions, hotkey dispatch
│   │
│   └── shaders/
│       ├── hex_terrain.wgsl    # Vertex (position + animation) + fragment (terrain atlas sample)
│       ├── billboard.wgsl      # Billboard vertex (camera-aligned quad) + fragment (alpha test)
│       ├── road_overlay.wgsl   # Road overlay with alpha blending
│       └── fog.wgsl            # Semi-transparent fog overlay
│
├── assets/
│   ├── terrain_atlas.png       # Terrain texture atlas (9 terrain types)
│   ├── sprite_atlas.png        # Billboard sprite atlas (trees, buildings, mountains, ruins)
│   ├── road_atlas.png          # Road sprite atlas (straight, curve, T, cross variants)
│   └── fog_texture.png         # Fog overlay texture (stylized cloud/parchment)
│
└── tests/
    ├── hex_math_tests.rs       # Coordinate conversion, neighbors, distance, rounding
    ├── map_tests.rs            # Map storage, bounds, get/set, new map defaults
    ├── persistence_tests.rs    # Save/load roundtrip, version migration
    └── history_tests.rs        # Undo/redo stack behavior
```

### Data Model

```rust
// Core hex coordinate
struct Hex { q: i32, r: i32 }

// Per-hex tile data (4 bytes — compact for 40,000 tiles)
struct HexTile {
    terrain: u8,         // 0-8: Grassland, Forest, Mountain, Water, Swamp, Snow, Town, Ruins, (reserved)
    road_edges: u8,      // 6-bit bitmask: which of the 6 hex edges have road connections
    fog: u8,             // 0=hidden, 1=revealed
    sprite_variant: u8,  // which sprite variant (for visual variety within terrain type)
}

// Full map file format
struct MapFile {
    magic: [u8; 4],         // b"ELDM"
    version: u32,           // format version for migration
    width: u32,             // 200
    height: u32,            // 200
    name: String,           // map name (e.g., "Eldspire Overworld")
    tiles: Vec<HexTile>,    // width * height tiles, row-major
    camera_q: i32,          // last camera position (for restore on load)
    camera_r: i32,
}

// Terrain enum
enum Terrain {
    Grassland = 0,
    Forest = 1,
    Mountain = 2,
    Water = 3,
    Swamp = 4,
    Snow = 5,
    Town = 6,
    Ruins = 7,
}

// Undo/redo operation
enum EditOp {
    SetTerrain { hex: Hex, old: u8, new: u8 },
    SetRoad { hex: Hex, old_edges: u8, new_edges: u8 },
    SetFog { hex: Hex, old: u8, new: u8 },
}
```

### Render Pipeline Details

**3 instanced draw calls per frame** (plus egui overlay):

1. **Hex terrain pass**: One hex mesh (7 vertices, 18 indices) instanced ~80 times. Per-instance: world position, terrain index (into texture atlas), animation phase. Vertex shader applies per-terrain ambient animation (grass sway, water ripple, etc.) using `world_pos + time` for spatial variation.

2. **Road overlay pass**: Same hex mesh, instanced for hexes with `road_edges != 0`. Fragment shader samples road atlas based on edge bitmask to select the correct road sprite (straight, curve, T-junction). Alpha-blended on top of terrain.

3. **Billboard sprite pass**: Quad mesh (4 vertices) instanced for each detail sprite (trees on forest hexes, buildings on town hexes, etc.). Per-instance: world position, sprite atlas index, scale. Vertex shader expands quad in camera-aligned directions. Fragment shader alpha-tests (discard < 0.5). Depth buffer handles overlap ordering.

4. **Fog overlay pass**: Same hex mesh, instanced for hidden hexes. Semi-transparent dark overlay in DM mode. In player mode, hidden hexes are simply not rendered (skip in frustum cull).

5. **egui pass**: `LoadOp::Load` (preserves scene underneath). Renders editor panels, terrain palette, menu bar. Only active in DM mode.

### Input Handling

| Input | Action | Mode |
|-------|--------|------|
| WASD | Pan camera | Both |
| Space + Left-drag | Pan camera | Both |
| Left-click | Paint active terrain on hex | DM only |
| Left-drag | Paint active terrain continuously | DM only |
| 1-8 | Select terrain type (hotkey) | DM only |
| Ctrl+Z | Undo | DM only |
| Ctrl+Shift+Z | Redo | DM only |
| Ctrl+S | Save map | DM only |
| Ctrl+O | Open map (file dialog) | DM only |
| Ctrl+N | New map (with confirmation) | DM only |
| Tab | Toggle DM / Player mode | Both |
| F | Toggle fog tool (click hexes to reveal/hide) | DM only |
| R | Toggle road tool (click hexes to add/remove road edges) | DM only |

### Key Technical Decisions

- **Frustum culling**: Convert camera viewport corners to axial coordinates → iterate only visible hex range. ~100 hexes checked per frame out of 40,000.
- **Instance buffer**: Pre-allocated for max visible hex count (~200). Updated via `queue.write_buffer()` each frame with only visible instances.
- **Texture atlas**: All terrain textures packed into a single 2048x2048 atlas. Sprite atlas separate. 1-2px padding between entries to prevent bleeding.
- **Alpha test for sprites**: `discard` fragments with alpha < 0.5 in fragment shader. Depth buffer handles overlap. No sorting needed.
- **egui input routing**: `egui_winit_state.on_window_event()` returns `consumed: bool`. If consumed, skip map input handling. Prevents clicks on editor panels from painting hexes.

### Dependency Stack

```toml
[dependencies]
wgpu = "28"
winit = "0.30"
egui = "0.33"
egui-wgpu = "0.33"
egui-winit = "0.33"
glam = { version = "0.31", features = ["bytemuck", "serde"] }
bytemuck = { version = "1", features = ["derive"] }
bincode = { version = "2.0", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
pollster = "0.4"
image = { version = "0.25", default-features = false, features = ["png"] }
log = "0.4"
env_logger = "0.11"
rfd = "0.15"  # native file dialog for Open/Save
```

Note: egui-wgpu may depend on an older wgpu version internally. This is fine — they share the same GPU device. Verify compatibility in egui release notes.

### Implementation Phases

#### Phase 1: Foundation — Window + Hex Grid + Camera

**Goal**: A window showing a flat hex grid you can pan around with WASD.

**Deliverables:**
- [ ] New repo `eldspire-hexmap` with Cargo.toml and dependency stack
- [ ] `main.rs` + `app.rs`: winit ApplicationHandler, window creation, wgpu init
- [ ] `hex/mod.rs`: Hex struct with axial math (neighbors, distance, to_pixel, from_pixel, axial_round)
- [ ] `hex/map.rs`: HexMap struct (200x200 flat array, get/set, bounds check, new_map with all grassland)
- [ ] `hex/terrain.rs`: Terrain enum (8 types), terrain-to-color mapping (placeholder)
- [ ] `renderer/camera.rs`: Fixed isometric camera, orthographic projection, WASD pan, Space+drag pan
- [ ] `renderer/hex_pass.rs`: Single hex mesh (flat-top, 7 vertices), instanced rendering with per-hex world position + terrain color
- [ ] `renderer/mod.rs`: Renderer init, frustum cull (viewport → axial range), build instance buffer, draw call
- [ ] `shaders/hex_terrain.wgsl`: Basic vertex (position + instance offset) + fragment (solid color per terrain)
- [ ] `input/mod.rs`: Input state tracking (keys held, mouse pos, space state)
- [ ] Unit tests for hex math (coordinate conversion, neighbors, distance, rounding)

**Success criteria**: Window opens, colored hex grid renders, WASD pans smoothly, camera stops at map boundaries, ~60 FPS.

**Estimated effort**: 3-5 sessions

#### Phase 2: Textures + Sprites + Animation

**Goal**: Replace solid colors with terrain textures. Add billboard sprites for terrain details. Add ambient animation.

**Deliverables:**
- [ ] `renderer/texture.rs`: PNG loading via `image` crate, texture atlas upload to wgpu
- [ ] `assets/terrain_atlas.png`: Placeholder terrain textures (9 types, can be simple colored patterns initially)
- [ ] `assets/sprite_atlas.png`: Placeholder billboard sprites (tree, mountain peak, town building, ruins column)
- [ ] Update `shaders/hex_terrain.wgsl`: Sample terrain atlas using terrain_index, add time uniform, add per-terrain animation (grass sway via vertex displacement, water ripple via UV scroll)
- [ ] `renderer/sprite_pass.rs`: Billboard quad mesh (4 vertices), instanced rendering, camera-aligned expansion in vertex shader, alpha-test in fragment shader
- [ ] `shaders/billboard.wgsl`: Billboard vertex shader (camera_right/camera_up expansion), fragment shader (atlas sample + alpha discard)
- [ ] Depth buffer setup for sprite overlap ordering
- [ ] Unit tests for atlas UV coordinate calculation

**Success criteria**: Textured hex grid with billboard sprites. Grass sways, water ripples, trees sway. Sprites correctly overlap (closer sprites in front). Still ~60 FPS.

**Estimated effort**: 3-5 sessions

#### Phase 3: Editor — Terrain Painting + Undo

**Goal**: DM can paint terrain on the map and undo mistakes.

**Deliverables:**
- [ ] `editor/mod.rs`: Editor state (active tool, selected terrain, DM/player mode flag)
- [ ] `editor/tools.rs`: Brush tool — click hex to paint active terrain, drag to paint continuously
- [ ] `editor/panels.rs`: egui side panel with terrain palette (clickable terrain icons), active tool indicator
- [ ] `renderer/egui_pass.rs`: egui integration (egui-wgpu + egui-winit), input routing (egui consumes panel clicks)
- [ ] `editor/history.rs`: Undo/redo stack (Vec<EditOp>, max 50), Ctrl+Z / Ctrl+Shift+Z
- [ ] Mouse-to-hex conversion: screen coords → world coords (inverse camera transform) → axial coords (from_pixel)
- [ ] Hex hover highlight (highlighted hex under cursor rendered with a subtle outline or tint)
- [ ] Hotkeys 1-8 for terrain type selection
- [ ] Instance buffer rebuild on terrain change (only on edit, not every frame)

**Success criteria**: DM can select terrain from palette, click/drag to paint hexes, undo/redo works, egui panels don't interfere with map interaction.

**Estimated effort**: 3-4 sessions

#### Phase 4: Roads + Fog of War

**Goal**: Road overlay system and per-hex fog of war.

**Deliverables:**
- [ ] `renderer/road_pass.rs`: Road overlay instanced draw, road atlas lookup by edge bitmask
- [ ] `assets/road_atlas.png`: Road sprites for all 6-bit edge combinations (or at least the common ones: straight, curve, T, cross, dead-end)
- [ ] `editor/tools.rs`: Road tool — click hex edge to toggle road connection. Visual feedback for which edge is being targeted.
- [ ] `renderer/fog_pass.rs`: Fog overlay (semi-transparent dark layer in DM mode, hidden hexes skipped in player mode)
- [ ] `assets/fog_texture.png`: Stylized fog texture (cloud/parchment aesthetic)
- [ ] `editor/tools.rs`: Fog tool — click hex to toggle revealed/hidden. Shift+click to reveal/hide radius-2 area.
- [ ] Fog visual in DM mode: dark semi-transparent overlay on hidden hexes
- [ ] Fog visual in player mode: hidden hexes not rendered (show nothing / background color)
- [ ] `shaders/road_overlay.wgsl`: Alpha-blended road rendering
- [ ] `shaders/fog.wgsl`: Semi-transparent overlay shader

**Success criteria**: Roads render correctly between hexes with proper connectivity sprites. Fog of war toggles per-hex, visible in DM mode as overlay, hidden hexes invisible in player mode.

**Estimated effort**: 3-4 sessions

#### Phase 5: Persistence + File Management

**Goal**: Save/load maps to binary files. New map creation. File dialogs.

**Deliverables:**
- [ ] `persistence/format.rs`: MapFile struct with magic number (b"ELDM"), version (1), dimensions, tiles, roads, fog, camera position, map name
- [ ] `persistence/mod.rs`: save_map() (serialize to bincode, write to file), load_map() (read file, deserialize, validate magic/version), new_map() (200x200 grassland, all fog hidden)
- [ ] File dialog integration via `rfd` crate: Ctrl+O opens native file dialog, Ctrl+S saves (save-as if no path)
- [ ] Dirty state tracking: flag set on any edit, cleared on save
- [ ] Unsaved changes confirmation: on Ctrl+N, on app close, prompt if dirty
- [ ] Map name + file path shown in window title bar
- [ ] First-launch behavior: auto-create new map (no file dialog, just start with blank grassland)
- [ ] Roundtrip tests: save → load → compare

**Success criteria**: Full save/load cycle works. Unsaved changes prompt on close. New map creation. File path in title bar. Format versioned for future migration.

**Estimated effort**: 2-3 sessions

#### Phase 6: Player Mode + Polish

**Goal**: Clean player-facing view. Session-ready polish.

**Deliverables:**
- [ ] Tab toggles DM/player mode. Player mode: hide egui panels, hide fog overlay (just skip rendering hidden hexes), hide cursor after 3s idle, hide hex hover highlight
- [ ] DM mode: show all hexes (fog as overlay), show editor UI, show hover highlight, show coordinate display
- [ ] Coordinate display: small egui label in corner showing cursor hex (q, r) and terrain type — DM mode only
- [ ] Menu bar (egui): File (New, Open, Save, Save As), Edit (Undo, Redo), View (Toggle Player Mode)
- [ ] Window title: "Eldspire Map — [map name] — [DM/Player Mode]"
- [ ] Fullscreen toggle (F11) for projector use
- [ ] Handle window resize: recalculate viewport, rebuild projection matrix, adjust visible hex count

**Success criteria**: Player mode shows a clean, animated map with no editor UI. DM can toggle instantly. Fullscreen works for projector. Window resize handled gracefully.

**Estimated effort**: 2-3 sessions

## Alternative Approaches Considered

See [brainstorm document](../brainstorms/2026-02-07-3d-hex-map-brainstorm.md) for full analysis. Summary:

| Approach | Why Not |
|----------|---------|
| Bevy Engine | ECS overhead for a specialized renderer, pre-1.0 breaking changes |
| Godot + Rust | Two-language boundary friction, less pure Rust |
| Web-based (Three.js) | Would need to fit into Cloudflare Workers stack, heavier for this use case |
| Full 3D models | Harder to achieve painterly look, more complex asset pipeline, overkill with fixed camera |
| Free zoom + LoD | Massive complexity for marginal benefit; fixed zoom eliminates LoD entirely |

## Acceptance Criteria

### Functional Requirements

- [ ] 200x200 hex grid rendered as 2.5D with flat-top hexes and axial (q, r) coordinates
- [ ] 8 terrain types (Grassland, Forest, Mountain, Water, Swamp, Snow, Town, Ruins) with distinct textures
- [ ] Billboard sprites for terrain details (trees, buildings, mountains, ruins) with alpha-test rendering
- [ ] Shader-driven ambient animation per terrain type (grass sway, water ripple, snow drift, tree sway)
- [ ] Fixed isometric camera with WASD pan and Space+left-drag pan
- [ ] Fixed zoom level showing ~50-80 hexes at full detail
- [ ] Road overlay system with 6-bit edge bitmask connectivity
- [ ] Per-hex fog of war (hidden/revealed) with DM and player mode rendering
- [ ] Brush-mode terrain editor (select terrain, click/drag to paint)
- [ ] Fog tool (click to toggle, Shift+click for radius-2 area)
- [ ] Road tool (click hex edge to toggle road connection)
- [ ] Undo/redo stack (50 operations)
- [ ] DM/Player mode toggle via Tab
- [ ] Binary persistence with magic number + version header
- [ ] Save (Ctrl+S), Open (Ctrl+O), New (Ctrl+N) with native file dialogs
- [ ] Unsaved changes confirmation on close and new map

### Non-Functional Requirements

- [ ] Consistent 60 FPS on a modern desktop GPU with ~80 visible hexes
- [ ] Map file size < 500KB for a full 200x200 grid
- [ ] App startup time < 2 seconds (window visible with hex grid rendered)
- [ ] Memory usage < 200MB for full map + all texture atlases loaded

### Quality Gates

- [ ] Unit tests for hex math (coordinate conversion, neighbors, distance, rounding)
- [ ] Unit tests for map storage (get/set, bounds, new map defaults)
- [ ] Roundtrip tests for persistence (save → load → compare)
- [ ] Undo/redo stack tests (apply, undo, redo, overflow)

## Success Metrics

- DM can create, edit, save, and load a campaign map in a single session
- Map renders at 60 FPS with all animations active
- Player mode provides a clean, immersive view on a shared screen
- Fog of war workflow is fast enough to use mid-session (reveal hexes as party explores)

## Dependencies & Prerequisites

- **Rust toolchain**: stable (2024 edition)
- **GPU**: Any device supporting wgpu backends (Vulkan, Metal, DX12, or OpenGL fallback)
- **Art assets**: Placeholder textures for Phase 1-2, AI-generated + hand-tuned art for release
- **No external services**: Fully offline, no network dependencies

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| egui-wgpu version mismatch with wgpu 28 | Medium | Medium | Pin egui ecosystem to matching versions. Fall back to egui 0.31 with wgpu 24 if needed. |
| Painterly art style is hard to achieve with AI generation | Medium | Medium | Start with simple colored textures. Art is decoupled from renderer — swap assets anytime. |
| winit 0.30 ApplicationHandler learning curve | Low | Low | Well-documented pattern. wgpu examples use this. |
| Road edge-bitmask sprite coverage (64 combinations) | Low | Medium | Only ~15 visually distinct combinations matter. Group mirror/rotation variants. |
| Billboard depth sorting artifacts | Low | Low | Alpha-test + depth buffer handles most cases. Fall back to manual sorting if needed. |

## Future Considerations

These are explicitly **not in V1** but worth designing for:

- **Minimap / overview mode**: Toggle to see the full 200x200 grid as a 2D overview
- **Hex metadata**: Names, notes, wiki links per hex (especially for Town/Ruins)
- **Brush sizes**: Paint with radius 1, 3, 7 hexes
- **Flood fill**: Fill contiguous same-terrain regions
- **River overlay**: Similar to roads but following hex edges
- **Networked multiplayer**: Players connect from own devices with their own fog state
- **Export**: PNG screenshot, PDF export for printable maps
- **Terrain transitions**: Blended edges between terrain types (shorelines, treelines)
- **Multiple overlay layers**: Rivers, borders, territory markers
- **Variable map sizes**: 50x50 dungeon maps, 500x500 continent maps

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-07-3d-hex-map-brainstorm.md`

### External References

- Red Blob Games hex grid guide: https://www.redblobgames.com/grids/hexagons/
- Learn wgpu (Rust): https://sotrh.github.io/learn-wgpu/
- wgpu docs: https://docs.rs/wgpu/latest/wgpu/
- egui docs: https://docs.rs/egui/latest/egui/
- egui-wgpu integration: https://docs.rs/egui-wgpu/latest/egui_wgpu/
- bincode 2 docs: https://docs.rs/bincode/latest/bincode/
- glam docs: https://docs.rs/glam/latest/glam/
