import { NO_GO, type RiskGrid } from "@/lib/hazards/risk";
import { isNoData, type Terrain } from "@/lib/terrain/terrain";

/** Min-heap of grid indices keyed by f-score. */
class Heap {
  private idx: Int32Array;
  private key: Float64Array;
  size = 0;
  constructor(cap: number) {
    this.idx = new Int32Array(cap);
    this.key = new Float64Array(cap);
  }
  private grow() {
    const i = new Int32Array(this.idx.length * 2);
    i.set(this.idx);
    this.idx = i;
    const k = new Float64Array(this.key.length * 2);
    k.set(this.key);
    this.key = k;
  }
  push(i: number, f: number) {
    if (this.size === this.idx.length) this.grow();
    let p = this.size++;
    while (p > 0) {
      const parent = (p - 1) >> 1;
      if (this.key[parent] <= f) break;
      this.idx[p] = this.idx[parent];
      this.key[p] = this.key[parent];
      p = parent;
    }
    this.idx[p] = i;
    this.key[p] = f;
  }
  pop(): number {
    const top = this.idx[0];
    const lastI = this.idx[--this.size];
    const lastK = this.key[this.size];
    let p = 0;
    for (;;) {
      let c = 2 * p + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.key[c + 1] < this.key[c]) c++;
      if (this.key[c] >= lastK) break;
      this.idx[p] = this.idx[c];
      this.key[p] = this.key[c];
      p = c;
    }
    this.idx[p] = lastI;
    this.key[p] = lastK;
    return top;
  }
}

export const passable = (t: Terrain, risk: RiskGrid, i: number) =>
  !isNoData(t, i) && risk.cls[i] !== NO_GO;

/** Nearest passable cell to i within maxRadius cells (or -1). */
export function snapToPassable(t: Terrain, risk: RiskGrid, i: number, maxRadius = 25): number {
  if (i < 0) return -1;
  if (passable(t, risk, i)) return i;
  const r0 = Math.floor(i / t.width);
  const c0 = i % t.width;
  for (let rad = 1; rad <= maxRadius; rad++) {
    let best = -1;
    let bestD = Infinity;
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= t.height || c >= t.width) continue;
        const j = r * t.width + c;
        const d = dr * dr + dc * dc;
        if (d < bestD && passable(t, risk, j)) {
          best = j;
          bestD = d;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/**
 * A* over the 8-connected terrain grid.
 *   step cost = 3D distance × (1 + λ·R)      (R = 0–1 risk of the cell entered)
 * No-go cells are blocked. The heuristic (straight-line ground distance) is
 * admissible because every step costs at least its ground distance.
 */
export function findPath(
  t: Terrain,
  risk: RiskGrid,
  start: number,
  goal: number,
  lambda: number,
): number[] | null {
  const { width: W, height: H } = t;
  const n = W * H;
  const dxM = t.cellWidthM;
  const dyM = t.cellHeightM;
  const g = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new Heap(1 << 16);

  const gr = Math.floor(goal / W);
  const gc = goal % W;
  const h = (i: number) => Math.hypot(((i % W) - gc) * dxM, (Math.floor(i / W) - gr) * dyM);

  const DR = [-1, -1, -1, 0, 0, 1, 1, 1];
  const DC = [-1, 0, 1, -1, 1, -1, 0, 1];
  const horiz = DR.map((dr, k) => Math.hypot(dr * dyM, DC[k] * dxM));

  g[start] = 0;
  heap.push(start, h(start));
  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const r = Math.floor(cur / W);
    const c = cur % W;
    for (let k = 0; k < 8; k++) {
      const nr = r + DR[k];
      const nc = c + DC[k];
      if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
      const nb = nr * W + nc;
      if (closed[nb] || !passable(t, risk, nb)) continue;
      const dz = t.elev[nb] - t.elev[cur];
      const step = Math.hypot(horiz[k], dz) * (1 + lambda * risk.score[nb]);
      const cand = g[cur] + step;
      if (cand < g[nb]) {
        g[nb] = cand;
        from[nb] = cur;
        heap.push(nb, cand + h(nb));
      }
    }
  }

  if (!Number.isFinite(g[goal])) return null;
  const path: number[] = [];
  for (let i = goal; i !== -1; i = from[i]) path.push(i);
  return path.reverse();
}

/** Grid cells crossed by the straight line a→b (Bresenham), inclusive. */
function lineCells(W: number, a: number, b: number): number[] {
  let x0 = a % W;
  let y0 = Math.floor(a / W);
  const x1 = b % W;
  const y1 = Math.floor(b / W);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: number[] = [];
  for (;;) {
    out.push(y0 * W + x0);
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/**
 * Remove grid "staircase" zig-zags: replace a stretch of the path with a
 * straight line when that line never enters riskier ground than the stretch
 * it replaces (same or lower max risk class and max risk score).
 */
export function smoothPath(
  t: Terrain,
  risk: RiskGrid,
  path: number[],
  maxLook = 80,
): { cells: number[]; vertices: number[] } {
  if (path.length < 3) return { cells: path, vertices: path };
  const out: number[] = [path[0]];
  const vertices: number[] = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let next = i + 1;
    let nextLine = [path[i], path[i + 1]];
    // Running maxima over path[i..j] so each candidate is O(line length).
    let maxCls = risk.cls[path[i]];
    let maxScore = risk.score[path[i]];
    const limit = Math.min(path.length - 1, i + maxLook);
    for (let j = i + 1; j <= limit; j++) {
      maxCls = Math.max(maxCls, risk.cls[path[j]]);
      maxScore = Math.max(maxScore, risk.score[path[j]]);
      if (j <= i + 1) continue;
      const line = lineCells(t.width, path[i], path[j]);
      const ok = line.every(
        (c) => passable(t, risk, c) && risk.cls[c] <= maxCls && risk.score[c] <= maxScore + 0.02,
      );
      if (ok) {
        next = j;
        nextLine = line;
      }
    }
    for (let k = 1; k < nextLine.length; k++) out.push(nextLine[k]);
    vertices.push(path[next]);
    i = next;
  }
  return { cells: out, vertices };
}
