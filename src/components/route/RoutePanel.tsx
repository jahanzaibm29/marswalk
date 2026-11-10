"use client";

import { AlertTriangle, CheckCircle2, Crosshair, Footprints, Loader2, Route, X } from "lucide-react";
import ElevationProfile from "@/components/route/ElevationProfile";
import type { PickMode } from "@/components/map/MarsViewer";
import { RISK } from "@/lib/hazards/risk";
import { EVA } from "@/lib/routing/travel";
import { fmtDistance, fmtDuration, fmtLatLon } from "@/lib/format";
import type { ScientificPOI } from "@/types/poi";
import type { RoutePoint, RouteResult } from "@/types/route";

export type PlanStatus = { state: "idle" } | { state: "planning" } | { state: "error"; message: string };

interface Props {
  routablePois: ScientificPOI[];
  start: RoutePoint | null;
  end: RoutePoint | null;
  onSetPoint: (which: "start" | "end", poiId: string) => void;
  pickMode: PickMode;
  onPickMode: (m: PickMode) => void;
  canPlan: boolean;
  onPlan: () => void;
  onClear: () => void;
  status: PlanStatus;
  routes: RouteResult[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
}

export default function RoutePanel(p: Props) {
  const selected = p.routes.find((r) => r.id === p.selectedRouteId) ?? null;
  const sameRoute =
    p.routes.length === 2 && Math.abs(p.routes[0].distanceM - p.routes[1].distanceM) < 1;

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mars-200">
        <Footprints size={14} /> Plan a Marswalk
      </h2>

      <PointPicker which="start" label="Start" {...p} />
      <PointPicker which="end" label="Destination" {...p} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={p.onPlan}
          disabled={!p.canPlan || p.status.state === "planning"}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-mars-500 px-3 py-2 text-sm font-semibold text-white hover:bg-mars-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {p.status.state === "planning" ? <Loader2 size={16} className="animate-spin" /> : <Route size={16} />}
          {p.status.state === "planning" ? "Planning…" : "Plan route"}
        </button>
        {p.routes.length > 0 && (
          <button
            type="button"
            onClick={p.onClear}
            className="rounded-md border border-white/15 px-3 text-sm text-white/70 hover:bg-white/10"
          >
            Clear
          </button>
        )}
      </div>

      {p.status.state === "error" && (
        <p className="flex gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {p.status.message}
        </p>
      )}

      {p.routes.length > 0 && (
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {sameRoute && (
            <p className="text-[11px] text-white/50">
              The safest route is also the most direct here, because the ground is gentle.
            </p>
          )}
          {p.routes.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              selected={r.id === p.selectedRouteId}
              recommended={r.id === "safest"}
              onSelect={() => p.onSelectRoute(r.id)}
            />
          ))}
          {selected && <MissionSummary route={selected} />}
        </div>
      )}
    </section>
  );
}

function PointPicker({
  which, label, routablePois, start, end, onSetPoint, pickMode, onPickMode,
}: Props & { which: "start" | "end"; label: string }) {
  const point = which === "start" ? start : end;
  const poiId = routablePois.find((x) => x.name === point?.label)?.id ?? (point ? "custom" : "");
  const picking = pickMode === which;
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</label>
      <div className="flex gap-1.5">
        <select
          value={poiId}
          onChange={(e) => e.target.value && e.target.value !== "custom" && onSetPoint(which, e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
        >
          <option value="" disabled>
            Choose a place…
          </option>
          {routablePois.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
          {poiId === "custom" && <option value="custom">Map point</option>}
        </select>
        <button
          type="button"
          onClick={() => onPickMode(picking ? null : which)}
          className={`flex items-center gap-1 rounded-md border px-2 text-xs ${
            picking ? "border-mars-400 bg-mars-500/30 text-white" : "border-white/15 text-white/70 hover:bg-white/10"
          }`}
          title="Pick a point on the map"
          aria-pressed={picking}
        >
          {picking ? <X size={14} /> : <Crosshair size={14} />}
          {picking ? "Cancel" : "Map"}
        </button>
      </div>
      {picking && <p className="mt-1 text-[11px] text-mars-200">Click on the map to set the {label.toLowerCase()}.</p>}
      {point && poiId === "custom" && (
        <p className="mt-1 font-mono text-[10px] text-white/50">{fmtLatLon(point.lonLat)}</p>
      )}
    </div>
  );
}

function RiskBar({ route }: { route: RouteResult }) {
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-label="Distance by risk level">
      {route.riskDistanceM.map((d, i) =>
        d > 0 ? (
          <span
            key={i}
            style={{ width: `${(d / route.distanceM) * 100}%`, background: RISK.colors[i] }}
            title={`${RISK.labels[i]}: ${fmtDistance(d)}`}
          />
        ) : null,
      )}
    </div>
  );
}

function RouteCard({
  route, selected, recommended, onSelect,
}: { route: RouteResult; selected: boolean; recommended: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border p-2 text-left ${
        selected ? "border-green-400/70 bg-green-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
      }`}
      aria-pressed={selected}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold">{route.label}</span>
        {recommended && (
          <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-300">
            Recommended
          </span>
        )}
      </div>
      <dl className="mb-1.5 grid grid-cols-4 gap-1 text-[11px]">
        <Stat label="Distance" value={fmtDistance(route.distanceM)} />
        <Stat label="Est. time" value={fmtDuration(route.durationH)} />
        <Stat label="Climb" value={`↑${Math.round(route.ascentM)} m`} />
        <Stat label="Max slope" value={`${route.maxSlopeDeg.toFixed(0)}°`} />
      </dl>
      <RiskBar route={route} />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wide text-white/40">{label}</dt>
      <dd className="font-mono text-white/90">{value}</dd>
    </div>
  );
}

function MissionSummary({ route }: { route: RouteResult }) {
  const total = route.durationH + EVA.siteHours + route.returnDurationH;
  const withinBudget = total <= EVA.maxHours;
  const high = route.riskDistanceM[2];
  return (
    <div className="space-y-2 rounded-md border border-white/10 bg-black/30 p-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Mission summary · {route.label}</h3>
      <ElevationProfile profile={route.profile} />
      <table className="w-full text-[11px]">
        <tbody className="[&_td]:py-0.5">
          <tr>
            <td className="text-white/50">Walk out</td>
            <td className="text-right font-mono">{fmtDuration(route.durationH)}</td>
          </tr>
          <tr>
            <td className="text-white/50">Science at site</td>
            <td className="text-right font-mono">{fmtDuration(EVA.siteHours)}</td>
          </tr>
          <tr>
            <td className="text-white/50">Walk back (same path)</td>
            <td className="text-right font-mono">{fmtDuration(route.returnDurationH)}</td>
          </tr>
          <tr className="border-t border-white/10 font-semibold">
            <td>Total EVA</td>
            <td className="text-right font-mono">{fmtDuration(total)}</td>
          </tr>
        </tbody>
      </table>
      <p
        className={`flex gap-1.5 text-[11px] ${withinBudget ? "text-green-300" : "text-red-300"}`}
      >
        {withinBudget ? <CheckCircle2 size={13} className="mt-px shrink-0" /> : <AlertTriangle size={13} className="mt-px shrink-0" />}
        {withinBudget
          ? `Fits within an ${EVA.maxHours} h EVA (${fmtDuration(EVA.maxHours - total)} margin).`
          : `Exceeds the ${EVA.maxHours} h EVA limit by ${fmtDuration(total - EVA.maxHours)}. Choose a closer target or use a rover.`}
      </p>
      {high > 0 && (
        <p className="flex gap-1.5 text-[11px] text-orange-300">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          Crosses {fmtDistance(high)} of high-risk terrain. Inspect those sections in HiRISE before going.
        </p>
      )}
      <p className="text-[10px] leading-snug text-white/35">
        Times are hypothetical suited-astronaut estimates (2.5 km/h on flat ground, slower on slopes and
        rough ground), not validated human-performance data. Terrain from the 20 m CTX elevation model; boulders
        smaller than that are not detected.
      </p>
    </div>
  );
}
