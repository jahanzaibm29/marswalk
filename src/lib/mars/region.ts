/** Jezero Crater exploration region (east-positive degrees). */
export const JEZERO = {
  name: "Jezero Crater",
  /** Initial camera view: [west, south, east, north]. */
  // Whole crater (centre ≈ 18.38°N, 77.58°E, ~45–49 km wide) plus the delta.
  view: [77.05, 17.95, 78.1, 18.82] as [number, number, number, number],
};

/** Mars mean radius (m), used for distance calculations. */
export const MARS_RADIUS_M = 3_389_500;
