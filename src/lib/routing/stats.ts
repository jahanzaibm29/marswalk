import type { RiskGrid } from "@/lib/hazards/risk";
import { walkingSpeedKmh } from "@/lib/routing/travel";
import { cellCenter, roughM, slopeDeg, type Terrain } from "@/lib/terrain/terrain";
import type { ProfilePoint, RouteResult, RouteStrategy } from "@/types/route";

function walkHours(t: Terrain, path: number[]): number {
  let hours = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1];
    const b = path[k];
    const horiz = segmentGroundM(t, a, b);
    const dz = t.elev[b] - t.elev[a];
    const d3 = Math.hypot(horiz, dz);
    hours += d3 / 1000 / walkingSpeedKmh(dz / horiz, roughM(t, b));
  }
  return hours;
}

function segmentGroundM(t: Terrain, a: number, b: number): number {
  const dr = Math.floor(b / t.width) - Math.floor(a / t.width);
  const dc = (b % t.width) - (a % t.width);
  return Math.hypot(dr * t.cellHeightM, dc * t.cellWidthM);
}

export function routeStats(
  t: Terrain,
  risk: RiskGrid,
  path: number[],
  /** Corner cells for drawing (straight runs between them). */
  vertices: number[],
  id: RouteStrategy,
  label: string,
): RouteResult {
  let distanceM = 0;
  let ascentM = 0;
  let descentM = 0;
  // Count climb with a small hysteresis so DEM noise doesn't inflate totals.
  const HYST = 3;
  let ref = t.elev[path[0]];
  let maxSlopeDeg = 0;
  const riskDistanceM: [number, number, number, number] = [0, 0, 0, 0];
  const full: ProfilePoint[] = [{ d: 0, z: t.elev[path[0]], cls: risk.cls[path[0]] }];

  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1];
    const b = path[k];
    const dz = t.elev[b] - t.elev[a];
    const d3 = Math.hypot(segmentGroundM(t, a, b), dz);
    distanceM += d3;
    const zb = t.elev[b];
    if (zb - ref >= HYST) {
      ascentM += zb - ref;
      ref = zb;
    } else if (ref - zb >= HYST) {
      descentM += ref - zb;
      ref = zb;
    }
    maxSlopeDeg = Math.max(maxSlopeDeg, slopeDeg(t, b));
    riskDistanceM[risk.cls[b]] += d3;
    full.push({ d: distanceM, z: t.elev[b], cls: risk.cls[b] });
  }

  // Keep the profile light for rendering.
  const step = Math.max(1, Math.ceil(full.length / 300));
  const profile = full.filter((_, i) => i % step === 0 || i === full.length - 1);

  return {
    id,
    label,
    coords: vertices.map((i) => cellCenter(t, i)),
    distanceM,
    ascentM,
    descentM,
    maxSlopeDeg,
    durationH: walkHours(t, path),
    returnDurationH: walkHours(t, [...path].reverse()),
    riskDistanceM,
    profile,
  };
}
