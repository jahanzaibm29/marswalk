// Stub for @spz-loader/core (Cesium's Gaussian-splat .spz decoder).
// The real package inlines a WASM binary as a JS string that Next's SWC
// minifier corrupts ("\0" + digit -> octal escape in a template literal),
// which breaks the whole Cesium chunk in production. Marswalk never loads
// splat tilesets, so we alias the package to this stub in next.config.ts.
export async function loadSpz(): Promise<never> {
  throw new Error("SPZ (Gaussian splat) decoding is not supported in Marswalk.");
}
