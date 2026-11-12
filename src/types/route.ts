import type { LonLat } from "@/lib/terrain/terrain";

export type RouteStrategy = "safest" | "direct";

export interface ProfilePoint {
  /** Distance along route, m. */
  d: number;
  /** Elevation, m. */
  z: number;
  /** Risk class 0–3. */
  cls: number;
}

/** One step of the route at grid resolution, used by Guide Mode. */
export interface TrackPoint {
  lon: number;
  lat: number;
  /** Distance from start along the route, m. */
  d: number;
  /** Walking time from the start to here, hours. */
  t: number;
  /** Walking time from here back to the start along the same path, hours. */
  tb: number;
  /** Elevation, m. */
  z: number;
  /** Risk class 0–3. */
  cls: number;
  /** Local slope, degrees. */
  slope: number;
}

/** A continuous stretch of high-risk ground along the route. */
export interface HazardSection {
  d0: number;
  d1: number;
  maxSlopeDeg: number;
}

export interface RouteResult {
  id: RouteStrategy;
  label: string;
  coords: LonLat[];
  distanceM: number;
  ascentM: number;
  descentM: number;
  maxSlopeDeg: number;
  /** Outbound walking time, hours (hypothetical model). */
  durationH: number;
  /** Walking time back along the same path, hours. */
  returnDurationH: number;
  /** Distance travelled in each risk class [low, medium, high, no-go]. */
  riskDistanceM: [number, number, number, number];
  profile: ProfilePoint[];
  track: TrackPoint[];
  hazards: HazardSection[];
}

export interface RoutePoint {
  lonLat: LonLat;
  label: string;
}

export type WorkerRequest = { type: "plan"; id: number; start: LonLat; end: LonLat };

export type WorkerResponse =
  | { type: "result"; id: number; routes: RouteResult[] }
  | { type: "error"; id: number; message: string };
