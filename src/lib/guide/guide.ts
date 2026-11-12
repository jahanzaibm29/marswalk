import { fmtDistance, fmtDuration } from "@/lib/format";
import { EVA } from "@/lib/routing/travel";
import type { LonLat } from "@/lib/terrain/terrain";
import type { ScientificPOI } from "@/types/poi";
import type { RouteResult, TrackPoint } from "@/types/route";

/**
 * Guide Mode: replays a planned route as a full simulated EVA —
 * walk out, science at the site, walk back — on a single mission clock (hours).
 */

const MARS_RADIUS_M = 3_389_500;
const DEG = Math.PI / 180;
/** Warn this far before reaching a high-risk section. */
const HAZARD_LOOKAHEAD_M = 150;
/** Landmarks within this distance of the route are called out. */
const LANDMARK_RADIUS_M = 600;

export type Phase = "out" | "site" | "back" | "done";
export type Severity = "info" | "caution" | "warning" | "success";

export interface Cue {
  /** Mission time when the cue fires, hours. */
  atH: number;
  severity: Severity;
  title: string;
  text: string;
}

export interface GuidePlan {
  route: RouteResult;
  startLabel: string;
  endLabel: string;
  outH: number;
  siteH: number;
  backH: number;
  totalH: number;
  cues: Cue[];
  /** Last point on the way out from which the crew can still get home within the EVA limit. */
  turnBack: { lonLat: LonLat; atH: number } | null;
}

export interface GuideState {
  phase: Phase;
  lonLat: LonLat;
  /** Compass heading of travel, degrees clockwise from north. */
  headingDeg: number;
  /** Distance from the start along the route, m. */
  d: number;
  /** Distance walked so far in the whole EVA, m. */
  walkedM: number;
  /** Distance still to walk on the current leg, m. */
  legRemainingM: number;
  /** Time still to go on the current leg / phase, hours. */
  legRemainingH: number;
  z: number;
  slope: number;
  cls: number;
  /** Modelled walking speed here, km/h (0 when stationary). */
  speedKmh: number;
  /** Index into route.track of the last point passed on the way out. */
  trailIndex: number;
  /** Cue most recently fired, and the next one due. */
  lastCue: Cue | null;
  nextCue: Cue | null;
}

// --- geometry ------------------------------------------------------------

/** Local east/north offset of b from a, metres (fine at route scale). */
function enu(a: LonLat, b: LonLat): [number, number] {
  const lat0 = ((a[1] + b[1]) / 2) * DEG;
  return [(b[0] - a[0]) * DEG * MARS_RADIUS_M * Math.cos(lat0), (b[1] - a[1]) * DEG * MARS_RADIUS_M];
}

export function bearingDeg(a: LonLat, b: LonLat): number {
  const [x, y] = enu(a, b);
  return ((Math.atan2(x, y) / DEG) + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

const ll = (p: TrackPoint): LonLat => [p.lon, p.lat];

/** Bearing at track index k, looking a few cells ahead to smooth grid zigzags. */
function headingAt(track: TrackPoint[], k: number, forward: boolean): number {
  const LOOK = 3;
  const a = track[Math.max(0, Math.min(track.length - 1, k))];
  const j = forward ? Math.min(track.length - 1, k + LOOK) : Math.max(0, k - LOOK);
  const b = track[j];
  if (a === b) {
    // At an end of the track: use the direction we arrived from.
    const i = forward ? Math.max(0, k - LOOK) : Math.min(track.length - 1, k + LOOK);
    return bearingDeg(ll(track[i]), ll(a));
  }
  return bearingDeg(ll(a), ll(b));
}

/** Largest index k with key(track[k]) ≤ v, for a key that increases along the track. */
function search(track: TrackPoint[], v: number, key: (p: TrackPoint) => number): number {
  let lo = 0;
  let hi = track.length - 1;
  if (v <= key(track[0])) return 0;
  if (v >= key(track[hi])) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (key(track[mid]) <= v) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Track index at distance d along the route. */
const indexAtD = (track: TrackPoint[], d: number) => search(track, d, (p) => p.d);

// --- plan ----------------------------------------------------------------

export function buildGuidePlan(
  route: RouteResult,
  startLabel: string,
  endLabel: string,
  pois: ScientificPOI[],
): GuidePlan {
  const track = route.track;
  const last = track[track.length - 1];
  const outH = last.t;
  const siteH = EVA.siteHours;
  const backH = last.tb;
  const totalH = outH + siteH + backH;
  const backStart = outH + siteH;
  /** Mission time when the walk back passes distance d. */
  const backTimeAtD = (d: number) => {
    const k = indexAtD(track, d);
    return backStart + (backH - track[k].tb);
  };
  const outTimeAtD = (d: number) => track[indexAtD(track, d)].t;

  const cues: Cue[] = [];
  const firstBearing = compass(headingAt(track, 0, true));
  cues.push({
    atH: 0,
    severity: "info",
    title: "EVA start",
    text: `Leave ${startLabel}. Head ${firstBearing} toward ${endLabel}, ${fmtDistance(route.distanceM)} away (about ${fmtDuration(outH)}).`,
  });

  // High-risk sections, both directions.
  for (const h of route.hazards) {
    const len = fmtDistance(Math.max(h.d1 - h.d0, 40));
    const slope = `${h.maxSlopeDeg.toFixed(0)}°`;
    const warnOut = Math.max(0, h.d0 - HAZARD_LOOKAHEAD_M);
    cues.push({
      atH: outTimeAtD(warnOut),
      severity: "warning",
      title: "High-risk ground ahead",
      text: `${h.d0 - warnOut < 20 ? "Now entering" : `In ${fmtDistance(h.d0 - warnOut)}:`} ${len} of steep or rough ground (slopes up to ${slope}). Slow down and test your footing.`,
    });
    const warnBack = Math.min(route.distanceM, h.d1 + HAZARD_LOOKAHEAD_M);
    cues.push({
      atH: backTimeAtD(warnBack),
      severity: "warning",
      title: "High-risk ground ahead",
      text: `${warnBack - h.d1 < 20 ? "Now entering" : `In ${fmtDistance(warnBack - h.d1)}:`} ${len} of steep or rough ground on the way back (slopes up to ${slope}).`,
    });
  }

  // Landmarks passed on the way out.
  const startLL = ll(track[0]);
  const endLL = ll(last);
  for (const poi of pois) {
    if (poi.category === "region") continue;
    const p: LonLat = [poi.lon, poi.lat];
    // Skip the start and destination themselves.
    if (Math.hypot(...enu(p, startLL)) < 150 || Math.hypot(...enu(p, endLL)) < 150) continue;
    let best = -1;
    let bestDist = Infinity;
    for (let k = 0; k < track.length; k++) {
      const dist = Math.hypot(...enu(ll(track[k]), p));
      if (dist < bestDist) {
        bestDist = dist;
        best = k;
      }
    }
    if (bestDist > LANDMARK_RADIUS_M || best <= 0 || best >= track.length - 1) continue;
    const [hx, hy] = enu(ll(track[best - 1]), ll(track[best + 1]));
    const [px, py] = enu(ll(track[best]), p);
    const side = hx * py - hy * px > 0 ? "left" : "right";
    cues.push({
      atH: track[best].t,
      severity: "info",
      title: "Landmark",
      text: `${poi.name} is ${fmtDistance(Math.max(bestDist, 40))} to your ${side}.`,
    });
  }

  // Halfway on the way out.
  if (route.distanceM > 400) {
    const k = indexAtD(track, route.distanceM / 2);
    cues.push({
      atH: track[k].t,
      severity: "info",
      title: "Halfway",
      text: `${fmtDistance(route.distanceM - track[k].d)} to ${endLabel}, about ${fmtDuration(outH - track[k].t)} to go.`,
    });
  }

  // Turn-back point: if the full EVA doesn't fit, find the last point on the
  // way out from which walking straight home still fits the EVA limit.
  let turnBack: GuidePlan["turnBack"] = null;
  if (totalH > EVA.maxHours) {
    let k = -1;
    for (let i = 0; i < track.length; i++) {
      if (track[i].t + track[i].tb <= EVA.maxHours) k = i;
      else break;
    }
    if (k >= 0) {
      turnBack = { lonLat: ll(track[k]), atH: track[k].t };
      cues.push({
        atH: track[k].t,
        severity: "warning",
        title: "Turn-back point",
        text: `Turn back now. Going further means you cannot get back within the ${EVA.maxHours} h EVA limit.`,
      });
    }
  }

  // Consumables reserve, when the EVA runs long.
  if (totalH > EVA.maxHours - 1) {
    cues.push({
      atH: EVA.maxHours - 1,
      severity: "caution",
      title: "1 hour of consumables left",
      text: "Suit reserve is getting low. Keep moving toward base and skip any optional stops.",
    });
  }
  if (totalH > EVA.maxHours) {
    cues.push({
      atH: EVA.maxHours,
      severity: "warning",
      title: "EVA limit reached",
      text: `You are still ${fmtDuration(totalH - EVA.maxHours)} from base. In a real EVA this would be an emergency, so plan a shorter walk or use a rover.`,
    });
  }

  cues.push({
    atH: outH,
    severity: "success",
    title: "Arrived",
    text: `At ${endLabel}. ${fmtDuration(siteH)} budgeted for science. Watch your suit consumables.`,
  });
  cues.push({
    atH: backStart,
    severity: "caution",
    title: "Start the walk back",
    text: `Science time is over. Walk back along the same path, ${fmtDistance(route.distanceM)} (about ${fmtDuration(backH)}).`,
  });
  const margin = EVA.maxHours - totalH;
  cues.push({
    atH: totalH,
    severity: margin >= 0 ? "success" : "warning",
    title: "Back at base",
    text:
      margin >= 0
        ? `EVA complete in ${fmtDuration(totalH)}, with ${fmtDuration(margin)} to spare.`
        : `EVA complete in ${fmtDuration(totalH)}, ${fmtDuration(-margin)} over the ${EVA.maxHours} h limit.`,
  });

  // Stable order: by time, keeping insertion order for ties.
  cues.sort((a, b) => a.atH - b.atH);
  return { route, startLabel, endLabel, outH, siteH, backH, totalH, cues, turnBack };
}

// --- state at a mission time -------------------------------------------

function lerp(a: number, b: number, f: number) {
  return a + (b - a) * f;
}

export function guideStateAt(plan: GuidePlan, simH: number): GuideState {
  const { route, outH, siteH, backH, totalH } = plan;
  const track = route.track;
  const last = track.length - 1;
  const h = Math.max(0, Math.min(totalH, simH));

  let phase: Phase;
  let k: number;
  let f: number;
  let forward = true;
  let legRemainingH: number;

  if (h < outH) {
    phase = "out";
    k = search(track, h, (p) => p.t);
    const a = track[k];
    const b = track[Math.min(last, k + 1)];
    f = b.t > a.t ? (h - a.t) / (b.t - a.t) : 0;
    legRemainingH = outH - h;
  } else if (h < outH + siteH) {
    phase = "site";
    k = last;
    f = 0;
    legRemainingH = outH + siteH - h;
  } else {
    phase = h >= totalH ? "done" : "back";
    forward = false;
    // Walking back: time-to-home decreases from backH to 0.
    const toHome = Math.max(0, backH - (h - outH - siteH));
    k = search(track, toHome, (p) => p.tb);
    const a = track[k];
    const b = track[Math.min(last, k + 1)];
    f = b.tb > a.tb ? (toHome - a.tb) / (b.tb - a.tb) : 0;
    legRemainingH = toHome;
  }

  const a = track[k];
  const b = track[Math.min(last, k + 1)];
  const lonLat: LonLat = [lerp(a.lon, b.lon, f), lerp(a.lat, b.lat, f)];
  const d = lerp(a.d, b.d, f);
  const cur = f < 0.5 ? a : b;

  let speedKmh = 0;
  if (phase === "out" || phase === "back") {
    const dt = phase === "out" ? b.t - a.t : b.tb - a.tb;
    speedKmh = dt > 0 ? (b.d - a.d) / 1000 / dt : 0;
  }

  const walkedM = phase === "out" ? d : phase === "site" ? route.distanceM : 2 * route.distanceM - d;
  const legRemainingM = phase === "out" ? route.distanceM - d : phase === "back" ? d : 0;

  let lastCue: Cue | null = null;
  let nextCue: Cue | null = null;
  for (const c of plan.cues) {
    if (c.atH <= h) lastCue = c;
    else {
      nextCue = c;
      break;
    }
  }

  return {
    phase,
    lonLat,
    headingDeg: headingAt(track, k, forward),
    d,
    walkedM,
    legRemainingM,
    legRemainingH,
    z: lerp(a.z, b.z, f),
    slope: cur.slope,
    cls: cur.cls,
    speedKmh,
    trailIndex: phase === "out" ? k : last,
    lastCue,
    nextCue,
  };
}

export function fmtClock(hours: number): string {
  const s = Math.max(0, Math.round(hours * 3600));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
