import { loadJson } from "@/lib/data/loadJson";

export interface TerrainMeta {
  source: string;
  sourceUrl: string;
  width: number;
  height: number;
  cellSizeM: number;
  bbox: { west: number; south: number; east: number; north: number };
  nodataElevation: number;
}

/** Routing grid built by scripts/build_terrain.mjs (row 0 = north). */
export interface Terrain extends TerrainMeta {
  elev: Int16Array;
  /** degrees * 4 */
  slopeQ: Uint8Array;
  /** metres RMS * 20 */
  roughQ: Uint8Array;
  /** Ground width of a cell in metres (equirectangular x shrinks by cos(lat)). */
  cellWidthM: number;
  cellHeightM: number;
}

export type LonLat = [number, number];

export async function loadTerrain(base = "/data/jezero/"): Promise<Terrain> {
  const meta = await loadJson<TerrainMeta>(`${base}terrain.json`);
  const res = await fetch(`${base}terrain.bin`);
  if (!res.ok) throw new Error(`Failed to load terrain grid (${res.status})`);
  const buf = await res.arrayBuffer();
  const n = meta.width * meta.height;
  if (buf.byteLength !== n * 4) throw new Error("Terrain grid size mismatch");
  const midLat = (meta.bbox.north + meta.bbox.south) / 2;
  return {
    ...meta,
    elev: new Int16Array(buf, 0, n),
    slopeQ: new Uint8Array(buf, n * 2, n),
    roughQ: new Uint8Array(buf, n * 3, n),
    cellWidthM: meta.cellSizeM * Math.cos((midLat * Math.PI) / 180),
    cellHeightM: meta.cellSizeM,
  };
}

export const slopeDeg = (t: Terrain, i: number) => t.slopeQ[i] * 0.25;
export const roughM = (t: Terrain, i: number) => t.roughQ[i] * 0.05;
export const isNoData = (t: Terrain, i: number) => t.elev[i] === t.nodataElevation;

export function inTerrain(t: Terrain, [lon, lat]: LonLat): boolean {
  const { west, east, south, north } = t.bbox;
  return lon >= west && lon < east && lat > south && lat <= north;
}

/** Grid index for a lon/lat, or -1 when outside the grid. */
export function cellOf(t: Terrain, p: LonLat): number {
  if (!inTerrain(t, p)) return -1;
  const { west, east, south, north } = t.bbox;
  const c = Math.min(t.width - 1, Math.floor(((p[0] - west) / (east - west)) * t.width));
  const r = Math.min(t.height - 1, Math.floor(((north - p[1]) / (north - south)) * t.height));
  return r * t.width + c;
}

export function cellCenter(t: Terrain, i: number): LonLat {
  const { west, east, south, north } = t.bbox;
  const r = Math.floor(i / t.width);
  const c = i % t.width;
  return [
    west + ((c + 0.5) / t.width) * (east - west),
    north - ((r + 0.5) / t.height) * (north - south),
  ];
}
