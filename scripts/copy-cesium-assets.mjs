// Copies Cesium's static runtime assets (workers, widgets, textures) into
// public/cesium so they are served alongside the static Next.js export.
import fs from "node:fs";
import path from "node:path";

const source = path.resolve("node_modules/cesium/Build/Cesium");
const destination = path.resolve("public/cesium");

if (!fs.existsSync(source)) {
  throw new Error("Cesium assets not found. Run `npm install` first.");
}

fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });

for (const dir of ["Assets", "ThirdParty", "Widgets", "Workers"]) {
  fs.cpSync(path.join(source, dir), path.join(destination, dir), { recursive: true });
}

console.log("Cesium assets copied to public/cesium.");
