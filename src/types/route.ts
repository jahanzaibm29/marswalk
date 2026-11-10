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
}

export interface RoutePoint {
  lonLat: LonLat;
  label: string;
}

export type WorkerRequest = { type: "plan"; id: number; start: LonLat; end: LonLat };

export type WorkerResponse =
  | { type: "result"; id: number; routes: RouteResult[] }
  | { type: "error"; id: number; message: string };
