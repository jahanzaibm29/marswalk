import { isNoData, roughM, slopeDeg, type Terrain } from "@/lib/terrain/terrain";

/**
 * Terrain risk model for a suited astronaut on foot.
 *
 * ASSUMPTIONS (not validated human-performance limits): thresholds are
 * informed by Apollo EVA experience, where crews found slopes above ~15–20°
 * hard going and avoided steeper ground. Slope comes from the 20 m CTX DTM;
 * roughness is the RMS height deviation from a fitted plane over 60 m,
 * a proxy for hummocky, blocky or scarp-like ground. Individual rocks
 * (< 20 m) are NOT resolved — always check HiRISE imagery along a route.
 */
export const RISK = {
  labels: ["Low", "Medium", "High", "No-go"] as const,
  colors: ["#22c55e", "#facc15", "#f97316", "#dc2626"] as const,
  /** Lower bounds for Medium, High, No-go. */
  slopeDeg: [10, 18, 25] as const,
  roughM: [0.6, 1.2, 2.0] as const,
};

export type RiskClass = 0 | 1 | 2 | 3;
export const NO_GO: RiskClass = 3;

export interface RiskGrid {
  cls: Uint8Array;
  /** Continuous 0–1 risk used for route costs. */
  score: Float32Array;
}

export function classify(slope: number, rough: number): RiskClass {
  let c = 0;
  for (let k = 0; k < 3; k++) {
    if (slope >= RISK.slopeDeg[k] || rough >= RISK.roughM[k]) c = k + 1;
  }
  return c as RiskClass;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function riskScore(slope: number, rough: number): number {
  return Math.max(clamp01((slope - 4) / (25 - 4)), clamp01((rough - 0.3) / (2.0 - 0.3)));
}

export function computeRisk(t: Terrain): RiskGrid {
  const n = t.width * t.height;
  const cls = new Uint8Array(n);
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (isNoData(t, i)) {
      cls[i] = NO_GO;
      score[i] = 1;
      continue;
    }
    const s = slopeDeg(t, i);
    const r = roughM(t, i);
    cls[i] = classify(s, r);
    score[i] = riskScore(s, r);
  }
  return { cls, score };
}

/** Render the risk grid as a transparent PNG data URL (Low is left clear). */
export function renderHazardImage(t: Terrain, risk: RiskGrid): string {
  const canvas = document.createElement("canvas");
  canvas.width = t.width;
  canvas.height = t.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");
  const img = ctx.createImageData(t.width, t.height);
  const rgba: [number, number, number, number][] = [
    [34, 197, 94, 0],
    [250, 204, 21, 120],
    [249, 115, 22, 170],
    [220, 38, 38, 210],
  ];
  for (let i = 0; i < risk.cls.length; i++) {
    const [r, g, b, a] = rgba[risk.cls[i]];
    const o = i * 4;
    img.data[o] = r;
    img.data[o + 1] = g;
    img.data[o + 2] = b;
    img.data[o + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}
