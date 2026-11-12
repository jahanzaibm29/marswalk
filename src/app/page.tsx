"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Home, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import LayerPanel from "@/components/layers/LayerPanel";
import PoiList from "@/components/poi/PoiList";
import PoiPanel from "@/components/poi/PoiPanel";
import RoutePanel, { type PlanStatus } from "@/components/route/RoutePanel";
import GuidePanel from "@/components/guide/GuidePanel";
import GuideBanner from "@/components/guide/GuideBanner";
import type { Coordinates, GuideMarker, PickMode } from "@/components/map/MarsViewer";
import { buildGuidePlan, guideStateAt } from "@/lib/guide/guide";
import { useGuideSim } from "@/lib/guide/useGuideSim";
import { defaultLayerState } from "@/lib/layers/catalog";
import { loadJson } from "@/lib/data/loadJson";
import { computeRisk, renderHazardImage, RISK, type RiskGrid } from "@/lib/hazards/risk";
import { cellOf, inTerrain, isNoData, loadTerrain, slopeDeg, type LonLat, type Terrain } from "@/lib/terrain/terrain";
import type { LayerState, LayerStateMap } from "@/types/layer";
import type { ScientificPOI } from "@/types/poi";
import type { RoutePoint, RouteResult, WorkerResponse } from "@/types/route";

// Cesium touches `window`, so the globe is client-only.
const MarsViewer = dynamic(() => import("@/components/map/MarsViewer"), { ssr: false });

type Tab = "plan" | "layers" | "places";
type Rect = [number, number, number, number];

const HABITAT_ID = "octavia-e-butler-landing";

export default function Page() {
  const [layers, setLayers] = useState<LayerStateMap>(defaultLayerState);
  const [pois, setPois] = useState<ScientificPOI[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Coordinates | null>(null);
  const [homeSignal, setHomeSignal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("plan");

  // Terrain + hazards
  const [terrain, setTerrain] = useState<{ t: Terrain; risk: RiskGrid } | null>(null);
  const [hazard, setHazard] = useState<{ url: string; rect: Rect } | null>(null);

  // Route planning
  const [start, setStart] = useState<RoutePoint | null>(null);
  const [end, setEnd] = useState<RoutePoint | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlanStatus>({ state: "idle" });
  const [flyTo, setFlyTo] = useState<{ rect: Rect; key: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Guide Mode (simulated walk along the selected route)
  const [guideRouteId, setGuideRouteId] = useState<string | null>(null);
  const [guideFollow, setGuideFollow] = useState(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    loadJson<ScientificPOI[]>("/data/jezero/pois.json").then(setPois).catch(console.error);
    loadTerrain()
      .then((t) => {
        const risk = computeRisk(t);
        setTerrain({ t, risk });
        const { west, south, east, north } = t.bbox;
        setHazard({ url: renderHazardImage(t, risk), rect: [west, south, east, north] });
      })
      .catch(console.error);
    // Start collapsed on phones so the map is visible.
    if (window.matchMedia("(max-width: 640px)").matches) setSidebarOpen(false);
  }, []);

  // Default start: the habitat.
  useEffect(() => {
    const hab = pois.find((p) => p.id === HABITAT_ID);
    if (hab) setStart((s) => s ?? { lonLat: [hab.lon, hab.lat], label: hab.name });
  }, [pois]);

  // Route worker (A* runs off the main thread).
  useEffect(() => {
    const w = new Worker(new URL("../workers/route.worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== requestIdRef.current) return; // stale
      if (msg.type === "error") {
        setStatus({ state: "error", message: msg.message });
        return;
      }
      setRoutes(msg.routes);
      setSelectedRouteId("safest");
      setStatus({ state: "idle" });
      const all = msg.routes.flatMap((r) => r.coords);
      const lons = all.map((c) => c[0]);
      const lats = all.map((c) => c[1]);
      const pad = 0.01;
      setFlyTo({
        rect: [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad],
        key: msg.id,
      });
    };
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  const routablePois = useMemo(
    // Walkable targets only: inside the terrain model, and not the region itself.
    () =>
      terrain
        ? pois.filter((p) => p.category !== "region" && inTerrain(terrain.t, [p.lon, p.lat]))
        : [],
    [pois, terrain],
  );

  const guideRoute = routes.find((r) => r.id === guideRouteId) ?? null;
  const guidePlan = useMemo(
    () => (guideRoute && start && end ? buildGuidePlan(guideRoute, start.label, end.label, pois) : null),
    [guideRoute, start, end, pois],
  );
  const sim = useGuideSim(guidePlan?.totalH ?? null);
  const guideState = useMemo(() => (guidePlan ? guideStateAt(guidePlan, sim.simH) : null), [guidePlan, sim.simH]);
  const guideMarker = useMemo<GuideMarker | null>(
    () =>
      guidePlan && guideState
        ? {
            lonLat: guideState.lonLat,
            headingDeg: guideState.headingDeg,
            trail: guidePlan.route.track.slice(0, guideState.trailIndex + 1).map((p) => [p.lon, p.lat]),
            turnBack: guidePlan.turnBack?.lonLat ?? null,
          }
        : null,
    [guidePlan, guideState],
  );

  const startGuide = () => {
    if (!selectedRouteId) return;
    setGuideRouteId(selectedRouteId);
    setPickMode(null);
    setSelectedPoiId(null);
    setGuideFollow(true);
    sim.reset();
    sim.setPlaying(true);
  };

  const exitGuide = () => {
    setGuideRouteId(null);
    sim.reset();
  };

  const resetRoutes = () => {
    exitGuide();
    setRoutes([]);
    setSelectedRouteId(null);
    setStatus({ state: "idle" });
  };

  const setPoint = (which: "start" | "end", p: RoutePoint) => {
    (which === "start" ? setStart : setEnd)(p);
    resetRoutes();
  };

  const onSetPoiPoint = (which: "start" | "end", poiId: string) => {
    const poi = pois.find((x) => x.id === poiId);
    if (poi) setPoint(which, { lonLat: [poi.lon, poi.lat], label: poi.name });
  };

  const onMapPick = (p: LonLat) => {
    if (!pickMode) return;
    if (terrain && !inTerrain(terrain.t, p)) {
      setStatus({ state: "error", message: "That point is outside the terrain model (the CTX elevation coverage)." });
      return;
    }
    setPoint(pickMode, { lonLat: p, label: "Map point" });
    setPickMode(null);
  };

  const onPlan = () => {
    if (!start || !end || !workerRef.current) return;
    const id = ++requestIdRef.current;
    setStatus({ state: "planning" });
    setRoutes([]);
    workerRef.current.postMessage({ type: "plan", id, start: start.lonLat, end: end.lonLat });
  };

  const updateLayer = useCallback((id: string, next: Partial<LayerState>) => {
    setLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }, []);

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? null;
  const selectedPoiRoutable = selectedPoi && routablePois.some((p) => p.id === selectedPoi.id);

  const cursorTerrain = useMemo(() => {
    if (!cursor || !terrain) return null;
    const i = cellOf(terrain.t, [cursor.lon, cursor.lat]);
    if (i < 0 || isNoData(terrain.t, i)) return null;
    return { elev: terrain.t.elev[i], slope: slopeDeg(terrain.t, i), cls: terrain.risk.cls[i] };
  }, [cursor, terrain]);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MarsViewer
        layers={layers}
        pois={pois}
        selectedPoiId={selectedPoiId}
        onSelectPoi={setSelectedPoiId}
        onCursorMove={setCursor}
        homeSignal={homeSignal}
        hazard={hazard}
        routes={routes}
        selectedRouteId={selectedRouteId}
        routeStart={start?.lonLat ?? null}
        routeEnd={end?.lonLat ?? null}
        pickMode={pickMode}
        onMapPick={onMapPick}
        flyTo={flyTo}
        guide={guideMarker}
        guideFollow={guideFollow}
      />

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="pointer-events-auto rounded-md border border-white/10 bg-panel p-2 text-white/80 backdrop-blur hover:text-white"
          aria-label={sidebarOpen ? "Hide panel" : "Show panel"}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <div className="pointer-events-auto rounded-md border border-white/10 bg-panel px-3 py-1.5 backdrop-blur">
          <h1 className="text-sm font-semibold leading-tight tracking-wide">Marswalk</h1>
          <p className="text-[11px] text-mars-200">Jezero Crater · Marswalk planner</p>
        </div>
        <button
          type="button"
          onClick={() => setHomeSignal((n) => n + 1)}
          className="pointer-events-auto ml-auto rounded-md border border-white/10 bg-panel p-2 text-white/80 backdrop-blur hover:text-white"
          aria-label="Reset view to Jezero Crater"
          title="Reset view"
        >
          <Home size={18} />
        </button>
      </header>

      {/* Left sidebar */}
      {sidebarOpen && (
        <div className="absolute bottom-10 left-3 top-20 flex w-[min(21rem,calc(100vw-1.5rem))] flex-col gap-3 rounded-lg border border-white/10 bg-panel p-3 shadow-2xl backdrop-blur">
          <nav className="flex gap-1 rounded-md bg-black/30 p-1" role="tablist">
            {(
              [
                ["plan", "Plan"],
                ["layers", "Layers"],
                ["places", "Places"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                  tab === id ? "bg-mars-500 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "plan" && guidePlan && guideState && (
            <GuidePanel
              plan={guidePlan}
              state={guideState}
              simH={sim.simH}
              playing={sim.playing}
              speed={sim.speed}
              follow={guideFollow}
              onTogglePlay={sim.togglePlay}
              onSeek={sim.seek}
              onReset={sim.reset}
              onSpeed={sim.setSpeed}
              onFollow={setGuideFollow}
              onExit={exitGuide}
            />
          )}
          {tab === "plan" && !guidePlan && (
            <RoutePanel
              routablePois={routablePois}
              start={start}
              end={end}
              onSetPoint={onSetPoiPoint}
              pickMode={pickMode}
              onPickMode={setPickMode}
              canPlan={!!start && !!end && !!terrain}
              onPlan={onPlan}
              onClear={resetRoutes}
              status={status}
              routes={routes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              onStartGuide={startGuide}
            />
          )}
          {tab === "layers" && <LayerPanel state={layers} onChange={updateLayer} />}
          {tab === "places" && (
            <div className="min-h-0 overflow-y-auto">
              <PoiList pois={pois} selectedId={selectedPoiId} onSelect={setSelectedPoiId} />
            </div>
          )}
        </div>
      )}

      {/* POI details */}
      {selectedPoi && (
        <div className="absolute bottom-10 right-3 top-20 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col justify-start">
          <PoiPanel
            poi={selectedPoi}
            onClose={() => setSelectedPoiId(null)}
            onPlanHere={
              selectedPoiRoutable
                ? () => {
                    onSetPoiPoint("end", selectedPoi.id);
                    setTab("plan");
                    setSidebarOpen(true);
                    setSelectedPoiId(null);
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Guide Mode cue banner */}
      {guideState && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 flex -translate-x-1/2 justify-center">
          <GuideBanner
            cue={guideState.lastCue}
            simH={sim.simH}
            playing={sim.playing}
            onTogglePlay={sim.togglePlay}
          />
        </div>
      )}

      {/* Cursor readout */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-panel px-2.5 py-1 font-mono text-[11px] text-white/70 backdrop-blur">
        <Crosshair size={12} />
        {cursor
          ? `${Math.abs(cursor.lat).toFixed(4)}°${cursor.lat >= 0 ? "N" : "S"}  ${cursor.lon.toFixed(4)}°E`
          : "— move over the map —"}
        {cursorTerrain && (
          <>
            <span className="text-white/30">|</span>
            <span>{cursorTerrain.elev} m</span>
            <span>{cursorTerrain.slope.toFixed(1)}°</span>
            <span style={{ color: RISK.colors[cursorTerrain.cls] }}>{RISK.labels[cursorTerrain.cls]}</span>
          </>
        )}
      </div>
    </main>
  );
}
