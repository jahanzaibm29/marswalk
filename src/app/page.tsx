"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Crosshair, Home, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import LayerPanel from "@/components/layers/LayerPanel";
import PoiList from "@/components/poi/PoiList";
import PoiPanel from "@/components/poi/PoiPanel";
import type { Coordinates } from "@/components/map/MarsViewer";
import { defaultLayerState } from "@/lib/layers/catalog";
import { loadJson } from "@/lib/data/loadJson";
import type { LayerState, LayerStateMap } from "@/types/layer";
import type { ScientificPOI } from "@/types/poi";

// Cesium touches `window`, so the globe is client-only.
const MarsViewer = dynamic(() => import("@/components/map/MarsViewer"), { ssr: false });

export default function Page() {
  const [layers, setLayers] = useState<LayerStateMap>(defaultLayerState);
  const [pois, setPois] = useState<ScientificPOI[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Coordinates | null>(null);
  const [homeSignal, setHomeSignal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadJson<ScientificPOI[]>("/data/jezero/pois.json").then(setPois).catch(console.error);
    // Start collapsed on phones so the map is visible.
    if (window.matchMedia("(max-width: 640px)").matches) setSidebarOpen(false);
  }, []);

  const updateLayer = useCallback((id: string, next: Partial<LayerState>) => {
    setLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }, []);

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? null;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MarsViewer
        layers={layers}
        pois={pois}
        selectedPoiId={selectedPoiId}
        onSelectPoi={setSelectedPoiId}
        onCursorMove={setCursor}
        homeSignal={homeSignal}
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
        <div className="absolute bottom-10 left-3 top-20 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-4 rounded-lg border border-white/10 bg-panel p-3 shadow-2xl backdrop-blur">
          <PoiList pois={pois} selectedId={selectedPoiId} onSelect={setSelectedPoiId} />
          <LayerPanel state={layers} onChange={updateLayer} />
        </div>
      )}

      {/* POI details */}
      {selectedPoi && (
        <div className="absolute bottom-10 right-3 top-20 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col justify-start">
          <PoiPanel poi={selectedPoi} onClose={() => setSelectedPoiId(null)} />
        </div>
      )}

      {/* Cursor coordinates */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-white/10 bg-panel px-2.5 py-1 font-mono text-[11px] text-white/70 backdrop-blur">
        <Crosshair size={12} />
        {cursor
          ? `${Math.abs(cursor.lat).toFixed(4)}°${cursor.lat >= 0 ? "N" : "S"}  ${cursor.lon.toFixed(4)}°E`
          : "— move over the map —"}
      </div>
    </main>
  );
}
