/// <reference lib="webworker" />
import { computeRisk, type RiskGrid } from "@/lib/hazards/risk";
import { findPath, smoothPath, snapToPassable } from "@/lib/routing/astar";
import { routeStats } from "@/lib/routing/stats";
import { cellOf, loadTerrain, type Terrain } from "@/lib/terrain/terrain";
import type { RouteResult, WorkerRequest, WorkerResponse } from "@/types/route";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Safety penalty λ in cost = distance × (1 + λ·risk). */
const STRATEGIES = [
  { id: "safest", label: "Safest", lambda: 8 },
  { id: "direct", label: "Most direct", lambda: 0.25 },
] as const;

let ready: Promise<{ t: Terrain; risk: RiskGrid }> | null = null;
const init = () => (ready ??= loadTerrain().then((t) => ({ t, risk: computeRisk(t) })));

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type !== "plan") return;
  const reply = (r: WorkerResponse) => ctx.postMessage(r);
  try {
    const { t, risk } = await init();
    const s = snapToPassable(t, risk, cellOf(t, msg.start));
    const g = snapToPassable(t, risk, cellOf(t, msg.end));
    if (s < 0) throw new Error("Start point is outside the terrain model or in no-go terrain.");
    if (g < 0) throw new Error("Destination is outside the terrain model or in no-go terrain.");
    if (s === g) throw new Error("Start and destination are the same place.");

    const routes: RouteResult[] = [];
    for (const st of STRATEGIES) {
      const path = findPath(t, risk, s, g, st.lambda);
      if (!path) throw new Error("No safe route exists between these points (blocked by no-go terrain).");
      const smooth = smoothPath(t, risk, path);
      routes.push(routeStats(t, risk, smooth.cells, smooth.vertices, st.id, st.label));
    }
    reply({ type: "result", id: msg.id, routes });
  } catch (err) {
    reply({ type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
