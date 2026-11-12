import type { RiskGrid } from "@/lib/hazards/risk";
import { walkingSpeedKmh } from "@/lib/routing/travel";
import { cellCenter, roughM, slopeDeg, type Terrain } from "@/lib/terrain/terrain";
import type { HazardSection, ProfilePoint, RouteResult, RouteStrategy, TrackPoint } from "@/types/route";

/** Hours to walk from cell a to the adjacent cell b. */
function stepHours(t: Terrain, a: number, b: number): number {
  const horiz = segmentGroundM(t, a, b);
  const dz = t.elev[b] - t.elev[a];
  return Math.hypot(horiz, dz) / 1000 / walkingSpeedKmh(dz / horiz, roughM(t, b));
}

function segmentGroundM(t: Terrain, a: number, b: number): number {
  const dr = Math.floor(b / t.width) - Math.floor(a / t.width);
  const dc = (b % t.width) - (a % t.width);
  return Math.hypot(dr * t.cellHeightM, dc * t.cellWidthM);
}

/** High-risk (class ≥ 2) stretches; gaps shorter than MERGE_M are bridged. */
function hazardSections(track: TrackPoint[]): HazardSection[] {
  const MERGE_M = 80;
  const out: HazardSection[] = [];
  for (let k = 0; k < track.length; k++) {
    const p = track[k];
    if (p.cls < 2) continue;
    const d0 = k > 0 ? track[k - 1].d : 0;
    const last = out[out.length - 1];
    if (last && d0 - last.d1 <= MERGE_M) {
      last.d1 = p.d;
      last.maxSlopeDeg = Math.max(last.maxSlopeDeg, p.slope);
    } else {
      out.push({ d0, d1: p.d, maxSlopeDeg: p.slope });
    }
  }
  return out;
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
  const point = (i: number, d: number, hours: number, back: number): TrackPoint => {
    const [lon, lat] = cellCenter(t, i);
    return { lon, lat, d, t: hours, tb: back, z: t.elev[i], cls: risk.cls[i], slope: slopeDeg(t, i) };
  };
  const track: TrackPoint[] = [point(path[0], 0, 0, 0)];
  let hours = 0;
  let back = 0;

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
    hours += stepHours(t, a, b);
    back += stepHours(t, b, a);
    track.push(point(b, distanceM, hours, back));
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
    durationH: hours,
    returnDurationH: back,
    riskDistanceM,
    profile,
    track,
    hazards: hazardSections(track),
  };
}
