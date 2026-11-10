// Build the browser routing grid from the Jezero CTX DTM.
//
// Input : data/raw/JEZ_ctx_DTM_20m.tif
//         USGS Astrogeology Mars 2020 TRN product (CTX DTM, 20 m/px,
//         Equirectangular, Mars 2000 sphere R = 3,396,190 m).
//         https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
// Output: public/data/jezero/terrain.bin + terrain.json
//
// Slope and roughness are computed at the native 20 m resolution, then
// aggregated (conservatively, using the block MAXIMUM) to a coarser grid
// that the A* route planner can search quickly in the browser.
//
//   node scripts/build_terrain.mjs [factor=2]

import fs from "node:fs";
import path from "node:path";
import { fromFile } from "geotiff";

const SRC = path.resolve("data/raw/JEZ_ctx_DTM_20m.tif");
const OUT_DIR = path.resolve("public/data/jezero");
const FACTOR = Number(process.argv[2] ?? 2);
const R = 3_396_190; // Mars 2000 sphere radius used by the product
const M_PER_DEG = (R * Math.PI) / 180;

if (!fs.existsSync(SRC)) {
  console.error(`Missing ${SRC}. Download it first (see README → Terrain data).`);
  process.exit(1);
}

const tiff = await fromFile(SRC);
const img = await tiff.getImage();
const W = img.getWidth();
const H = img.getHeight();
const [x0, y0, x1, y1] = img.getBoundingBox(); // metres, equirectangular
const [resX] = img.getResolution();
const nodata = img.getGDALNoData();
const [raster] = await img.readRasters();
const z = Float32Array.from(raster);
const isNo = (v) => !Number.isFinite(v) || v < -1e30 || v === nodata;

const bbox = {
  west: x0 / M_PER_DEG,
  south: y0 / M_PER_DEG,
  east: x1 / M_PER_DEG,
  north: y1 / M_PER_DEG,
};
console.log(`DTM ${W}x${H} @ ${resX} m, bbox`, bbox);

// --- Slope (Horn) and roughness at native resolution -----------------------
const slope = new Float32Array(W * H).fill(NaN);
const rough = new Float32Array(W * H).fill(NaN);
for (let r = 1; r < H - 1; r++) {
  const lat = bbox.north - ((r + 0.5) / H) * (bbox.north - bbox.south);
  // Equirectangular x-spacing overstates ground distance by 1/cos(lat).
  const dx = resX * Math.cos((lat * Math.PI) / 180);
  const dy = resX;
  for (let c = 1; c < W - 1; c++) {
    const i = r * W + c;
    const a = z[i - W - 1], b = z[i - W], cc = z[i - W + 1];
    const d = z[i - 1], e = z[i], f = z[i + 1];
    const g = z[i + W - 1], h = z[i + W], k = z[i + W + 1];
    if ([a, b, cc, d, e, f, g, h, k].some(isNo)) continue;
    const gx = (cc + 2 * f + k - (a + 2 * d + g)) / (8 * dx);
    const gy = (g + 2 * h + k - (a + 2 * b + cc)) / (8 * dy);
    slope[i] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    // Roughness: RMS residual of the 3x3 window from the fitted plane.
    let ss = 0;
    const win = [a, b, cc, d, e, f, g, h, k];
    for (let j = 0; j < 9; j++) {
      const ox = (j % 3) - 1;
      const oy = Math.floor(j / 3) - 1;
      const pred = e + gx * ox * dx + gy * oy * dy;
      ss += (win[j] - pred) ** 2;
    }
    rough[i] = Math.sqrt(ss / 9);
  }
}

// --- Aggregate to routing grid ---------------------------------------------
const GW = Math.floor(W / FACTOR);
const GH = Math.floor(H / FACTOR);
const elev = new Int16Array(GW * GH);
const slopeQ = new Uint8Array(GW * GH); // degrees * 4  (0.25° steps, max 63.75°)
const roughQ = new Uint8Array(GW * GH); // metres * 20 (5 cm steps, max 12.75 m)
const NODATA_ELEV = -32768;
const slopeStats = [];
const roughStats = [];

for (let gr = 0; gr < GH; gr++) {
  for (let gc = 0; gc < GW; gc++) {
    let sum = 0, n = 0, smax = 0, rmax = 0, valid = true;
    for (let rr = 0; rr < FACTOR; rr++) {
      for (let c2 = 0; c2 < FACTOR; c2++) {
        const i = (gr * FACTOR + rr) * W + gc * FACTOR + c2;
        if (isNo(z[i])) { valid = false; continue; }
        sum += z[i]; n++;
        if (slope[i] > smax) smax = slope[i];
        if (rough[i] > rmax) rmax = rough[i];
      }
    }
    const gi = gr * GW + gc;
    if (!valid || n === 0) { elev[gi] = NODATA_ELEV; slopeQ[gi] = 255; roughQ[gi] = 255; continue; }
    elev[gi] = Math.round(sum / n);
    slopeQ[gi] = Math.min(254, Math.round(smax * 4));
    roughQ[gi] = Math.min(254, Math.round(rmax * 20));
    slopeStats.push(smax);
    roughStats.push(rmax);
  }
}

const pct = (arr, p) => {
  const s = Float32Array.from(arr).sort();
  return s[Math.floor((p / 100) * (s.length - 1))].toFixed(2);
};
console.log("slope° p50/p90/p99/max:", [50, 90, 99, 100].map((p) => pct(slopeStats, p)).join(" / "));
console.log("rough m p50/p90/p99/max:", [50, 90, 99, 100].map((p) => pct(roughStats, p)).join(" / "));

// --- Write --------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });
const buf = Buffer.concat([
  Buffer.from(elev.buffer),
  Buffer.from(slopeQ.buffer),
  Buffer.from(roughQ.buffer),
]);
fs.writeFileSync(path.join(OUT_DIR, "terrain.bin"), buf);

const meta = {
  source: "MRO CTX DTM, Jezero (USGS Astrogeology, Mars 2020 TRN), 20 m/px",
  sourceUrl:
    "https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_context_camera_orthorectified_image_mosaic",
  width: GW,
  height: GH,
  cellSizeM: resX * FACTOR,
  bbox: {
    west: bbox.west,
    south: bbox.south,
    east: bbox.west + (GW * FACTOR * resX) / M_PER_DEG,
    north: bbox.north,
  },
  nodataElevation: NODATA_ELEV,
  layout: [
    { name: "elevation", type: "int16", units: "m (Mars 2000 areoid)", offset: 0 },
    { name: "slope", type: "uint8", scale: 0.25, units: "deg (max of 20 m cells)", offset: GW * GH * 2 },
    { name: "roughness", type: "uint8", scale: 0.05, units: "m RMS (max of 20 m cells)", offset: GW * GH * 3 },
  ],
};
// Keep the bbox consistent with the (possibly trimmed) aggregated grid.
meta.bbox.south = bbox.north - (GH * FACTOR * resX) / M_PER_DEG;
fs.writeFileSync(path.join(OUT_DIR, "terrain.json"), JSON.stringify(meta, null, 2));
console.log(`wrote terrain.bin ${(buf.length / 1024 / 1024).toFixed(2)} MB, grid ${GW}x${GH} @ ${meta.cellSizeM} m`);
