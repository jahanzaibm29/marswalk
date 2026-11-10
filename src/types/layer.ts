export type LayerCategory = "optical" | "topography" | "thermal" | "spectral" | "mission";

export interface LayerSource {
  mission: string;
  instrument: string;
  url: string;
}

interface BaseLayerDef {
  id: string;
  name: string;
  category: LayerCategory;
  description: string;
  source: LayerSource;
  defaultVisible: boolean;
}

/** A raster tile layer streamed from a WMTS-style {z}/{y}/{x} endpoint. */
export interface ImageryLayerDef extends BaseLayerDef {
  kind: "imagery";
  /** Tile URL template using {z}/{y}/{x} (rows counted from the top). */
  url: string;
  resolution: string;
  maximumLevel: number;
  /** [west, south, east, north] in degrees, east-positive longitude. */
  rectangle?: [number, number, number, number];
  defaultOpacity: number;
}

/** A static GeoJSON overlay shipped with the app. */
export interface VectorLayerDef extends BaseLayerDef {
  kind: "vector";
  dataUrl: string;
  /** CSS hex color. */
  color: string;
}

export type LayerDef = ImageryLayerDef | VectorLayerDef;

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export type LayerStateMap = Record<string, LayerState>;
