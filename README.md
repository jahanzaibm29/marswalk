# Marswalk

*A Martian Survival Guide for Jezero Crater*

**NASA Space Apps Challenge · Interplanetary Survival Guide: Martian Map**

Marswalk is an interactive Mars surface exploration and mission-planning
application designed to help future astronauts conduct safer and more scientifically
productive Marswalks in **Jezero Crater**.

It integrates multiple NASA datasets into one interactive 3D globe: orbital imagery,
topography, thermal infrared, spectral observation footprints, and the real Perseverance
rover traverse. On top of these it adds geological points of interest, a terrain hazard
map, and an A\* route planner that compares the safest and most direct path, with travel
time, elevation profile and an EVA time budget.

## Status

| Milestone | Status |
| --- | --- |
| 1. Infrastructure: Next.js static export, CesiumJS Mars globe | ✅ Working locally |
| 2. Real NASA imagery over Jezero (CTX 6 m, HiRISE 25 cm) | ✅ |
| 3. Scientific layers: elevation, thermal (day/night), CRISM footprints | ✅ (CRISM mineral map: todo) |
| 4. Layer manager, opacity, coordinates, POIs + detail panel | ✅ |
| 5. Hazard map (slope/roughness) + A\* Marswalk planner, ETA, mission summary | ✅ |
| 5b. Guide Mode: simulated walk along the route | ⏳ Next |
| 6. Environment dashboard (REMS/MEDA historical) | ⏳ |
| 7. Final integration, demo scenario, Cloudflare deploy | ⏳ |

## NASA data used

| Type | Mission / instrument | How it's served |
| --- | --- | --- |
| Optical (context) | Viking Orbiters, MDIM 2.1 color mosaic, 232 m/px | Mars Trek WMTS tiles |
| Optical | MRO CTX controlled Jezero orthomosaic, 6 m/px | Mars Trek WMTS tiles |
| Optical | MRO HiRISE controlled Jezero orthomosaic, 25 cm/px | Mars Trek WMTS tiles |
| Topography | MGS MOLA + Mars Express HRSC blended DEM, color hillshade, 200 m/px | Mars Trek WMTS tiles |
| Thermal | Mars Odyssey THEMIS day & night IR mosaics, 100 m/px | Mars Trek WMTS tiles |
| Spectral | MRO CRISM MTRDR targeted observation footprints | Static GeoJSON (`public/data/jezero`) |
| Mission | Perseverance traverse path, landing ellipse, waypoints | Static GeoJSON / JSON |
| Terrain (routing) | MRO CTX DTM of Jezero, 20 m/px (USGS Mars 2020 TRN product) | `public/data/jezero/terrain.bin`, 40 m grid |

Raster tiles are streamed directly from [NASA Mars Trek](https://trek.nasa.gov/mars/), which
is CORS-enabled and uses a geographic 2×1 tiling scheme. That means **no tile hosting cost**.
Vector data and POI text/images are fetched once by `scripts/fetch_trek_data.py` and
committed as static files.

## Getting started

Requirements: Node 20+ and Python 3.10+ (only for re-fetching data).

```bash
npm install
npm run dev          # copies Cesium assets, then starts http://localhost:3000
```

Other scripts:

```bash
npm run build        # static export to ./out (deploy this folder)
npm run preview      # serve ./out locally
npm run data         # re-download Jezero vector data + POIs from NASA Mars Trek
npm run terrain      # rebuild terrain.bin from data/raw/JEZ_ctx_DTM_20m.tif
```

### Terrain data

The routing grid is already committed. To rebuild it, download the CTX DTM (9.7 MB) into
`data/raw/` (git-ignored) and run `npm run terrain`:

```bash
curl -o data/raw/JEZ_ctx_DTM_20m.tif \
  https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif
```

## Safety and routing model

* **Slope** (Horn method) and **roughness** (RMS deviation from a fitted plane over 60 m)
  are computed at 20 m, then aggregated to a 40 m grid using the block *maximum*.
* **Risk classes:** Low < 10°, Medium 10–18°, High 18–25°, No-go ≥ 25° (roughness bands
  0.6 / 1.2 / 2.0 m). These are assumptions informed by Apollo EVA experience.
* **A\***, 8-connected, cost = 3D distance × (1 + λ·risk). No-go cells are blocked.
  *Safest* uses λ = 8, *Most direct* λ = 0.25. Paths are then straightened wherever a
  straight line doesn't enter riskier ground. Runs in a Web Worker.
* **Travel time:** Tobler's hiking function rescaled to 2.5 km/h on flat ground, slowed on
  rough ground. Mission summary adds 1 h at the site and the return walk, checked against
  an 8 h EVA limit. All times are **hypothetical** estimates.
* Rocks smaller than the 20 m DTM are not detected; use HiRISE to inspect a route.

## Deploying to Cloudflare Pages ($0)

* Build command: `npm run build`
* Output directory: `out`
* Environment variable: `NODE_VERSION=22`

## Project structure

```
src/
  app/                 page layout + global styles
  components/map/      MarsViewer: Cesium globe on the Mars ellipsoid
  components/layers/   science layer manager (toggle + opacity)
  components/poi/      POI list and detail panel
  components/route/    route planner panel + elevation profile
  lib/layers/catalog.ts  layer definitions (sources, URLs, resolution)
  lib/terrain/         terrain grid loader + cell helpers
  lib/hazards/risk.ts  risk classes, scoring, hazard overlay image
  lib/routing/         A* + path smoothing, route stats, walking-speed model
  lib/mars/region.ts     Jezero region constants
  workers/route.worker.ts  runs A* off the main thread
  types/               LayerDef, ScientificPOI, RouteResult
scripts/
  copy-cesium-assets.mjs  copies Cesium runtime into public/cesium
  fetch_trek_data.py      downloads + simplifies NASA vector data
  build_terrain.mjs       DTM → slope/roughness → terrain.bin
public/data/jezero/    pois.json, terrain.bin/json, perseverance-path, landing-ellipse, crism-footprints
```

## Coordinate conventions

* Mars 2000 IAU sphere/ellipsoid (`Cesium.Ellipsoid.MARS`), planetocentric latitude
* Longitude **east-positive**, −180…180
* GeoJSON coordinates are `[lon, lat]`

## Notes

* Tailwind CSS is pinned to **v3**. Tailwind v4's native scanner binary is blocked by Windows
  Smart App Control on one dev machine, and its WASM fallback silently generates no utilities.
* Travel-time estimates are hypothetical suited-astronaut estimates, not validated
  human-performance data.
* Stop `npm run dev` before running `npm run build`: both use the `.next` folder.

## Credits

Imagery and data: NASA/JPL-Caltech, University of Arizona (HiRISE), MSSS (CTX),
ASU (THEMIS), JHU-APL (CRISM), USGS Astrogeology, ESA/DLR/FU Berlin (HRSC),
served by NASA Mars Trek. Globe rendering: CesiumJS.
