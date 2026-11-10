# Marswalk

*A Martian Survival Guide for Jezero Crater*

**NASA Space Apps Challenge · Interplanetary Survival Guide: Martian Map**

Marswalk is an interactive Mars surface exploration and mission-planning
application designed to help future astronauts conduct safer and more scientifically
productive Marswalks in **Jezero Crater**.

It integrates multiple NASA datasets into one interactive 3D globe: orbital imagery,
topography, thermal infrared, spectral observation footprints, and the real Perseverance
rover traverse. On top of these it adds geological points of interest, and (next
milestones) terrain hazard analysis and an A\* route planner that recommends safer paths.

## Status

| Milestone | Status |
| --- | --- |
| 1. Infrastructure: Next.js static export, CesiumJS Mars globe | ✅ Working locally |
| 2. Real NASA imagery over Jezero (CTX 6 m, HiRISE 25 cm) | ✅ |
| 3. Scientific layers: elevation, thermal (day/night), CRISM footprints | ✅ (CRISM mineral map: todo) |
| 4. Layer manager, opacity, coordinates, POIs + detail panel | ✅ |
| 5. Hazard map (slope/roughness) + A\* Marswalk planner | ⏳ Next |
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
```

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
  lib/layers/catalog.ts  layer definitions (sources, URLs, resolution)
  lib/mars/region.ts     Jezero region constants
  types/               LayerDef, ScientificPOI
scripts/
  copy-cesium-assets.mjs  copies Cesium runtime into public/cesium
  fetch_trek_data.py      downloads + simplifies NASA vector data
public/data/jezero/    pois.json, perseverance-path, landing-ellipse, crism-footprints
```

## Coordinate conventions

* Mars 2000 IAU sphere/ellipsoid (`Cesium.Ellipsoid.MARS`), planetocentric latitude
* Longitude **east-positive**, −180…180
* GeoJSON coordinates are `[lon, lat]`

## Notes

* Tailwind CSS is pinned to **v3**. Tailwind v4's native scanner binary is blocked by Windows
  Smart App Control on one dev machine, and its WASM fallback silently generates no utilities.
* Travel-time estimates (upcoming route planner) will be hypothetical suited-astronaut
  estimates, not validated human-performance data.

## Credits

Imagery and data: NASA/JPL-Caltech, University of Arizona (HiRISE), MSSS (CTX),
ASU (THEMIS), JHU-APL (CRISM), USGS Astrogeology, ESA/DLR/FU Berlin (HRSC),
served by NASA Mars Trek. Globe rendering: CesiumJS.
