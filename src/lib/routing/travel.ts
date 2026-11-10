/**
 * HYPOTHETICAL suited-astronaut walking model — not validated human data.
 *
 * Shape: Tobler's hiking function (speed vs. signed grade), rescaled so that
 * flat, smooth ground gives FLAT_KMH. Apollo crews covered roughly 2–3 km/h on
 * foot in pressure suits, so we assume 2.5 km/h. Rough ground slows walking.
 */
export const FLAT_KMH = 2.5;
export const MIN_KMH = 0.3;

const tobler = (grade: number) => 6 * Math.exp(-3.5 * Math.abs(grade + 0.05));
const TOBLER_FLAT = tobler(0);

export function walkingSpeedKmh(grade: number, roughM: number): number {
  const v = (FLAT_KMH * tobler(grade)) / TOBLER_FLAT;
  const roughPenalty = 1 / (1 + 0.6 * Math.max(0, roughM - 0.3));
  return Math.max(MIN_KMH, v * roughPenalty);
}

/** Planning assumptions shown in the mission summary. */
export const EVA = {
  /** Assumed maximum EVA duration (h). ISS spacewalks run ~6.5 h; Artemis plans up to ~8 h. */
  maxHours: 8,
  /** Time budgeted at the destination for science (h). */
  siteHours: 1,
};
