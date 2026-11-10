import { RISK } from "@/lib/hazards/risk";
import type { LayerDef, LayerStateMap } from "@/types/layer";

const TREK = "https://trek.nasa.gov/tiles/Mars/EQ";
const trek = (layer: string, ext: "jpg" | "png") =>
  `${TREK}/${layer}/1.0.0/default/default028mm/{z}/{y}/{x}.${ext}`;

/**
 * Scientific layer catalog, drawn bottom-to-top in this order.
 * Raster tiles are streamed from NASA Mars Trek (CORS-enabled, geographic
 * 2x1 tiling scheme, Mars 2000 sphere) so no tile hosting is needed.
 */
export const LAYERS: LayerDef[] = [
  {
    id: "viking",
    kind: "imagery",
    name: "Viking color mosaic",
    category: "base",
    description: "Global color base map. Covers the poles, where the THEMIS base map has no data.",
    resolution: "232 m/px",
    url: trek("Mars_Viking_MDIM21_ClrMosaic_global_232m", "jpg"),
    maximumLevel: 7,
    defaultVisible: true,
    defaultOpacity: 1,
    source: { mission: "Viking Orbiters", instrument: "VIS (MDIM 2.1)", url: "https://trek.nasa.gov/mars/" },
  },
  {
    id: "themis-base",
    kind: "imagery",
    name: "THEMIS grayscale mosaic",
    category: "base",
    description:
      "Sharp, seamless base map of the whole crater. Its gray tones blend with the CTX and HiRISE patch. (Same data as the daytime thermal layer, drawn underneath the photos.)",
    resolution: "100 m/px",
    url: trek("THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018", "png"),
    maximumLevel: 9,
    defaultVisible: true,
    defaultOpacity: 1,
    source: { mission: "Mars Odyssey", instrument: "THEMIS IR (day)", url: "https://themis.asu.edu/" },
  },
  {
    id: "mola-hrsc",
    kind: "imagery",
    name: "Elevation (color hillshade)",
    category: "topography",
    description: "Color-coded terrain height: blue/green is low, yellow/red/white is high, with shading for slopes. Blend it over the photos to read the crater's relief.",
    resolution: "200 m/px",
    url: trek("Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw", "jpg"),
    maximumLevel: 8,
    defaultVisible: false,
    defaultOpacity: 0.7,
    source: { mission: "Mars Global Surveyor + Mars Express", instrument: "MOLA + HRSC DEM blend", url: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m" },
  },
  {
    id: "themis-day",
    kind: "imagery",
    name: "Daytime thermal infrared",
    category: "thermal",
    description: "Surface brightness temperature by day. Highlights slope orientation and albedo differences.",
    resolution: "100 m/px",
    url: trek("THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018", "png"),
    maximumLevel: 9,
    defaultVisible: false,
    defaultOpacity: 0.8,
    source: { mission: "Mars Odyssey", instrument: "THEMIS IR", url: "https://themis.asu.edu/" },
  },
  {
    id: "themis-night",
    kind: "imagery",
    name: "Nighttime thermal infrared",
    category: "thermal",
    description: "Bright at night = rock and bedrock that holds heat (high thermal inertia); dark = loose dust and sand. A proxy for firm footing.",
    resolution: "100 m/px",
    url: trek("THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018", "png"),
    maximumLevel: 9,
    defaultVisible: false,
    defaultOpacity: 0.8,
    source: { mission: "Mars Odyssey", instrument: "THEMIS IR", url: "https://themis.asu.edu/" },
  },
  {
    id: "ctx",
    kind: "imagery",
    name: "CTX mosaic",
    category: "optical",
    description: "Controlled orthomosaic of the whole crater floor and delta.",
    resolution: "6 m/px",
    url: trek("JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0", "png"),
    maximumLevel: 13,
    rectangle: [77.1604655, 18.2110274, 77.6991776, 18.7211945],
    defaultVisible: true,
    defaultOpacity: 1,
    source: { mission: "Mars Reconnaissance Orbiter", instrument: "Context Camera (CTX)", url: "https://www.msss.com/all_projects/mro-ctx.php" },
  },
  {
    id: "hirise",
    kind: "imagery",
    name: "HiRISE mosaic",
    category: "optical",
    description: "Very high-resolution imagery of the landing area and delta front. Zoom in to see boulders and dunes.",
    resolution: "25 cm/px",
    url: trek("JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd", "png"),
    maximumLevel: 17,
    rectangle: [77.2229331, 18.3067994, 77.583964, 18.669315],
    defaultVisible: true,
    defaultOpacity: 1,
    source: { mission: "Mars Reconnaissance Orbiter", instrument: "HiRISE", url: "https://www.uahirise.org/" },
  },
  {
    id: "hazard",
    kind: "hazard",
    name: "Terrain hazard",
    category: "safety",
    description:
      "Walking risk from slope and roughness, computed from the CTX elevation model. Low-risk ground is left clear. Rocks smaller than 20 m are not resolved.",
    resolution: "40 m/px",
    defaultVisible: false,
    defaultOpacity: 0.75,
    legend: RISK.labels.map((label, i) => ({
      label:
        i === 0
          ? `${label} (<${RISK.slopeDeg[0]}°)`
          : i === 3
            ? `${label} (≥${RISK.slopeDeg[2]}°)`
            : `${label} (${RISK.slopeDeg[i - 1]}–${RISK.slopeDeg[i]}°)`,
      color: RISK.colors[i],
    })),
    source: { mission: "Mars Reconnaissance Orbiter", instrument: "CTX DTM 20 m (USGS)", url: "https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_context_camera_orthorectified_image_mosaic" },
  },
  {
    id: "hires-coverage",
    kind: "vector",
    name: "High-res coverage outline",
    category: "optical",
    description:
      "Where the sharp CTX and HiRISE mosaics exist. They cover the delta and landing area (the western half of the crater), not the whole of Jezero.",
    dataUrl: "/data/jezero/hires-coverage.geojson",
    color: "#e5e7eb",
    fillOpacity: 0,
    defaultVisible: true,
    source: { mission: "Mars Reconnaissance Orbiter", instrument: "CTX + HiRISE footprints", url: "https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_context_camera_orthorectified_image_mosaic" },
  },
  {
    id: "crism",
    kind: "vector",
    name: "CRISM spectral observations",
    category: "spectral",
    description: "Footprints of targeted CRISM hyperspectral scenes. Mineral maps (clays, carbonates) can be derived inside these areas.",
    dataUrl: "/data/jezero/crism-footprints.geojson",
    color: "#c084fc",
    defaultVisible: false,
    source: { mission: "Mars Reconnaissance Orbiter", instrument: "CRISM (MTRDR)", url: "https://pds-geosciences.wustl.edu/missions/mro/crism.htm" },
  },
  {
    id: "landing-ellipse",
    kind: "vector",
    name: "Landing ellipse",
    category: "mission",
    description: "Perseverance's targeted landing area.",
    dataUrl: "/data/jezero/landing-ellipse.geojson",
    color: "#facc15",
    defaultVisible: false,
    source: { mission: "Mars 2020", instrument: "EDL planning", url: "https://mars.nasa.gov/mars2020/" },
  },
  {
    id: "perseverance-path",
    kind: "vector",
    name: "Perseverance traverse",
    category: "mission",
    description: "The real path driven by the Perseverance rover, a proven traversable route.",
    dataUrl: "/data/jezero/perseverance-path.geojson",
    color: "#38bdf8",
    defaultVisible: true,
    source: { mission: "Mars 2020", instrument: "Rover localization", url: "https://mars.nasa.gov/mars2020/mission/where-is-the-rover/" },
  },
];

export function defaultLayerState(): LayerStateMap {
  return Object.fromEntries(
    LAYERS.map((l) => [
      l.id,
      { visible: l.defaultVisible, opacity: l.kind === "vector" ? 1 : l.defaultOpacity },
    ]),
  );
}
