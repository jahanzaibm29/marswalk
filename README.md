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
time, elevation profile and an EVA time budget. A Guide Mode then replays the planned
walk step by step with navigation and hazard cues.

## Links

* **Live app:** <https://marswalk.pages.dev/>
* **Source code:** <https://github.com/jahanzaibm29/marswalk>
* **Demo video:** coming soon

## Status

| Milestone | Status |
| --- | --- |
| 1. Infrastructure: Next.js static export, CesiumJS Mars globe | ✅ |
| 2. Real NASA imagery over Jezero (CTX 6 m, HiRISE 25 cm) | ✅ |
| 3. Scientific layers: elevation, thermal (day/night), CRISM footprints | ✅ |
| 4. Layer manager, opacity, legends, coordinates, POIs + detail panel | ✅ |
| 5. Hazard map (slope/roughness) + A\* Marswalk planner, ETA, mission summary | ✅ |
| 6. Guide Mode: simulated EVA (walk out, science at site, walk back) with cues | ✅ |
| 7. Deployed as a static site on Cloudflare Pages ([marswalk.pages.dev](https://marswalk.pages.dev/)) | ✅ |

**Future work:** CRISM mineral maps (not just footprints), an environment dashboard from
REMS/MEDA historical weather, and more landing sites with a DTM.

## NASA data used

| Type | Mission / instrument | Source / service |
| --- | --- | --- |
| Optical (context) | [Viking Orbiters](https://trek.nasa.gov/mars/), MDIM 2.1 color mosaic, 232 m/px | [Mars Trek WMTS](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml) |
| Optical | [MRO CTX](https://www.msss.com/all_projects/mro-ctx.php) controlled Jezero orthomosaic, 6 m/px | [Mars Trek WMTS](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml) |
| Optical | [MRO HiRISE](https://www.uahirise.org/) controlled Jezero orthomosaic, 25 cm/px | [Mars Trek WMTS](https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml) |
| Topography | [MGS MOLA + Mars Express HRSC blended DEM](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m), color hillshade, 200 m/px | [Mars Trek WMTS](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw/1.0.0/WMTSCapabilities.xml) |
| Thermal | [Mars Odyssey THEMIS](https://themis.asu.edu/) day & night IR mosaics, 100 m/px | [Day WMTS](https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/WMTSCapabilities.xml) · [Night WMTS](https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018/1.0.0/WMTSCapabilities.xml) |
| Spectral | [MRO CRISM](https://pds-geosciences.wustl.edu/missions/mro/crism.htm) MTRDR targeted observation footprints | [Mars Trek service](https://trek.nasa.gov/mars/trekarcgis/rest/services/mars_mro_crism_mtrdr_c0a_humex_frt_sites/MapServer) → static GeoJSON (`public/data/jezero`) |
| Mission | [Mars 2020 Perseverance](https://mars.nasa.gov/mars2020/mission/where-is-the-rover/) traverse path, landing ellipse, waypoints | [Traverse](https://trek.nasa.gov/mars/trekarcgis/rest/services/Perseverance_Traverse_Path/MapServer) · [Ellipse](https://trek.nasa.gov/mars/trekarcgis/rest/services/perseverance_landing_ellipse/MapServer) · [Waypoints](https://trek.nasa.gov/mars/trekarcgis/rest/services/mars2020_waypoints/MapServer) → static GeoJSON / JSON |
| Terrain (routing) | [MRO CTX DTM of Jezero](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_context_camera_orthorectified_image_mosaic), 20 m/px (USGS Mars 2020 TRN product) | [GeoTIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif) → `public/data/jezero/terrain.bin`, 40 m grid |

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

## Guide Mode

Replays a planned route as a full simulated EVA on one mission clock: walking out, time at
the science site, and the walk back. It shows phase, position, heading, elapsed and remaining
time, modelled walking speed, warnings ~150 m before high-risk ground, landmarks near the
route, and the last turn-back point that still gets the crew home inside the 8 h EVA limit.

## Deploying to Cloudflare ($0)

The app is a fully static export with no server code, live at <https://marswalk.pages.dev/>.

* **Cloudflare Pages:** build command `npm run build`, output directory `out`,
  environment variable `NODE_VERSION=22`.
* **Workers static assets** (alternative): `wrangler.jsonc` serves `./out` directly, with no
  OpenNext adapter: `npm run build && npx wrangler deploy`.

`next.config.ts` aliases `@spz-loader/core` to a stub (`src/lib/stubs/spz-loader.ts`): its
embedded WASM gets minified into invalid JS and breaks the Cesium chunk in production. The
app doesn't use Gaussian splats, so nothing is lost.

## Project structure

```
src/
  app/                 page layout + global styles
  components/map/      MarsViewer: Cesium globe on the Mars ellipsoid
  components/layers/   science layer manager (toggle + opacity)
  components/poi/      POI list and detail panel
  components/route/    route planner panel + elevation profile
  components/guide/    Guide Mode panel + cue banner
  lib/layers/catalog.ts  layer definitions (sources, URLs, resolution)
  lib/terrain/         terrain grid loader + cell helpers
  lib/hazards/risk.ts  risk classes, scoring, hazard overlay image
  lib/routing/         A* + path smoothing, route stats, walking-speed model
  lib/guide/           Guide Mode simulation (phases, cues, turn-back point)
  lib/stubs/           build-time stub for Cesium's SPZ loader
  lib/mars/region.ts     Jezero region constants
  workers/route.worker.ts  runs A* off the main thread
  types/               LayerDef, ScientificPOI, RouteResult
scripts/
  copy-cesium-assets.mjs  copies Cesium runtime into public/cesium
  fetch_trek_data.py      downloads + simplifies NASA vector data
  build_terrain.mjs       DTM → slope/roughness → terrain.bin
public/data/jezero/    pois.json, terrain.bin/json, perseverance-path, landing-ellipse, crism-footprints
wrangler.jsonc         Cloudflare Workers static-assets config
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

## Use of AI

We used an AI coding assistant (Claude Code by Anthropic) to help write, refactor and debug
parts of the code and documentation. The challenge approach, choice of site and datasets,
safety model and design decisions are our own, and we reviewed and tested all AI-assisted
code. No AI-generated images, video or audio are used; all imagery is NASA data.

## Credits

Imagery and data: NASA/JPL-Caltech, University of Arizona (HiRISE), MSSS (CTX),
ASU (THEMIS), JHU-APL (CRISM), USGS Astrogeology, ESA/DLR/FU Berlin (HRSC),
served by NASA Mars Trek. Partner data: ESA Mars Express HRSC, blended into the
MOLA/HRSC elevation model.

Software: CesiumJS, Next.js, React, TypeScript, Tailwind CSS, lucide-react, geotiff.js,
Cloudflare Workers. Methods: Horn (1981) slope; Tobler's hiking function; A\* search;
Apollo EVA experience for slope thresholds.
