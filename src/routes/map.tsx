import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  MILES_PER_HEX,
  TERRAIN,
  hexDistance,
  huntersTile,
  isPassable,
  visibleFog,
  type FogState,
  type Tile,
} from "@/lib/hexmap/map-data";
import type { HexMapController, HexMapSnapshot } from "@/lib/hexmap/scene";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Map | Eldspire" }] }),
  component: HexMapPage,
});

const FOG_NAMES = ["Unexplored", "Rumoured", "Seen", "Visited"] as const;

function HexMapPage() {
  let stage!: HTMLDivElement;
  let labelLayer!: HTMLDivElement;
  const [map, setMap] = createSignal<HexMapController>();
  const [snap, setSnap] = createSignal<HexMapSnapshot | undefined>(undefined, { equals: false });
  const [failed, setFailed] = createSignal(false);
  const [pinText, setPinText] = createSignal("");

  onMount(async () => {
    try {
      const { createHexMap } = await import("@/lib/hexmap/scene");
      const controller = createHexMap(stage, labelLayer, setSnap);
      setMap(controller);
      onCleanup(() => controller.dispose());
    } catch (err) {
      console.error(err);
      setFailed(true);
    }
  });

  const gm = () => snap()?.view === "gm";

  return (
    <div class="hexmap-page">
      <section class="page-intro hexmap-intro">
        <p class="eyebrow">Prototype · Bellwether and the lake</p>
        <h1>Roads of Eldspire</h1>
        <p>
          Follow the party across the map. Tap a hex to see what is known about
          it, then travel there. Fog lifts as the party moves, and the trail
          remembers where they have been.
        </p>
      </section>

      <div class="hexmap-layout">
        <div class="hexmap-stage" ref={stage}>
          <div class="hexmap-labels" ref={labelLayer} />
          <Show when={!snap() && !failed()}>
            <p class="hexmap-loading">Unrolling the map…</p>
          </Show>
          <Show when={failed()}>
            <p class="hexmap-loading">This browser couldn't start 3D rendering (WebGL).</p>
          </Show>
          <Show when={snap()?.toast}>
            <p class="hexmap-toast" role="status">{snap()!.toast}</p>
          </Show>
        </div>

        <aside class="hexmap-panel" aria-label="Map controls">
          <Show when={snap()}>
            {(s) => (
              <>
                <div class="hexmap-clock" aria-live="polite">
                  <DayDial fraction={s().dayFraction} />
                  <div>
                    <strong>Day {s().day}</strong> <span>{s().phase}</span>
                  </div>
                </div>

                <div class="hexmap-views" role="group" aria-label="Whose view">
                  <button aria-pressed={s().view === "table"} onClick={() => map()?.setView("table")}>
                    Table
                  </button>
                  <button aria-pressed={s().view === "gm"} onClick={() => map()?.setView("gm")}>
                    GM
                  </button>
                </div>

                <Show
                  when={s().selected}
                  fallback={
                    <section class="hexmap-card">
                      <h2>{s().partyTile.name ?? "On the road"}</h2>
                      <p class="hexmap-meta">Party position · Tulk carries the eye coin</p>
                      <p class="hexmap-hint">
                        Tap any hex to see what is known about it, then travel there.
                      </p>
                    </section>
                  }
                >
                  {(t) => (
                    <TileCard
                      tile={t()}
                      snap={s()}
                      controller={map()!}
                      pinText={pinText()}
                      setPinText={setPinText}
                    />
                  )}
                </Show>

                <div class="hexmap-actions">
                  <button onClick={() => map()?.replay()}>Previously on Eldspire</button>
                  <button onClick={() => map()?.makeCamp()}>Make camp</button>
                  <Show when={gm()}>
                    <button onClick={() => map()?.toggleHunters()}>
                      {s().huntersShown ? "Hide hunters from table" : "Show hunters to table"}
                    </button>
                  </Show>
                  <button onClick={() => map()?.reset()}>Reset</button>
                </div>

                <ul class="hexmap-legend" aria-label="Legend">
                  <li><i class="is-unexplored" />Unexplored</li>
                  <li><i class="is-rumoured" />Rumoured</li>
                  <li><i class="is-seen" />Seen</li>
                  <li><i class="is-visited" />Visited</li>
                </ul>
              </>
            )}
          </Show>
        </aside>
      </div>
    </div>
  );
}

function TileCard(props: {
  tile: Tile;
  snap: HexMapSnapshot;
  controller: HexMapController;
  pinText: string;
  setPinText: (v: string) => void;
}) {
  const state = () => props.controller.state();
  const gm = () => props.snap.view === "gm";
  const fog = () => visibleFog(state(), props.tile);
  const realFog = () => state().fog[props.tile.i];
  const known = () => fog() >= 2;
  const distance = () => hexDistance(props.tile, props.snap.partyTile);
  const title = () => {
    const t = props.tile;
    if (known()) return t.name ?? TERRAIN[t.type].label;
    if (fog() === 1) return t.name ? `${t.name}?` : "Rumoured land";
    return "Unexplored";
  };
  const pins = () =>
    state().pins.filter(
      (p) => p.c === props.tile.c && p.r === props.tile.r && known() && (!p.gm || gm()),
    );
  const coords = () =>
    `${String(props.tile.c).padStart(2, "0")}.${String(props.tile.r).padStart(2, "0")}`;

  return (
    <section class="hexmap-card">
      <h2>{title()}</h2>
      <p class="hexmap-meta">
        Hex {coords()} · {FOG_NAMES[realFog()]}
        {gm() && realFog() < 2 ? " to the table" : ""} ·{" "}
        {distance() ? `${distance() * MILES_PER_HEX} mi away` : "party is here"}
      </p>
      <Show when={known() && props.tile.name}>
        <p class="hexmap-hint">{TERRAIN[props.tile.type].label}</p>
      </Show>
      <Show when={!known()}>
        <p class="hexmap-hint">
          {fog() === 1 ? "Heard of, not yet seen." : "Blank parchment. Nobody at the table has been here."}
        </p>
      </Show>
      <Show when={gm() && huntersTile(props.controller.map, state()) === props.tile}>
        <p class="hexmap-hint">GM: the grey-cloaked hunters wait here. They will not cross still water.</p>
      </Show>
      <Show when={pins().length}>
        <ul class="hexmap-pins">
          <For each={pins()}>
            {(p) => (
              <li classList={{ "is-gm": Boolean(p.gm) }}>
                <small>
                  {p.when}
                  {p.gm ? " · GM only" : ""}
                </small>
                {p.text}
              </li>
            )}
          </For>
        </ul>
      </Show>
      <div class="hexmap-card-actions">
        <Show when={distance() > 0}>
          <button
            class="is-primary"
            disabled={props.snap.moving || !isPassable(props.tile)}
            onClick={() => props.controller.travelTo(props.tile)}
          >
            {props.snap.moving ? "Travelling…" : isPassable(props.tile) ? "Travel here" : "Impassable"}
          </button>
        </Show>
        <Show when={gm()}>
          <For each={[["Hide", 0], ["Rumour", 1], ["Reveal", 2]] as [string, FogState][]}>
            {([label, value]) => (
              <button onClick={() => props.controller.setFog(props.tile, value)}>{label}</button>
            )}
          </For>
        </Show>
        <button onClick={() => props.controller.select(null)}>Close</button>
      </div>
      <Show when={gm() && known()}>
        <form
          class="hexmap-pinform"
          onSubmit={(e) => {
            e.preventDefault();
            const text = props.pinText.trim();
            if (!text) return;
            props.controller.addPin(props.tile, text);
            props.setPinText("");
          }}
        >
          <input
            id="hexmap-pin-text"
            placeholder="Pin a note on this hex"
            aria-label="Pin note"
            maxLength={160}
            value={props.pinText}
            onInput={(e) => props.setPinText(e.currentTarget.value)}
          />
          <button type="submit">Pin</button>
        </form>
      </Show>
    </section>
  );
}

/** A small sun-and-moon dial: the marker travels round once per day, noon at the top. */
function DayDial(props: { fraction: number }) {
  const angle = () => props.fraction * Math.PI * 2 + Math.PI;
  const isNight = () => props.fraction < 0.25 || props.fraction >= 0.8;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-opacity="0.35" />
      <path d="M2 14h24" stroke="currentColor" stroke-opacity="0.35" />
      <circle
        cx={14 + Math.sin(angle()) * 10}
        cy={14 + Math.cos(angle()) * 10}
        r="3.2"
        fill={isNight() ? "#5d6b8f" : "#b8862f"}
      />
    </svg>
  );
}
