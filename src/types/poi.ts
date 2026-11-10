export type PoiCategory =
  | "habitat"
  | "region"
  | "landing"
  | "sedimentary"
  | "geomorphology"
  | "fluvial"
  | "other";

export interface PoiImage {
  url: string;
  credit: string;
}

export interface ScientificPOI {
  id: string;
  name: string;
  /** Planetocentric latitude, degrees. */
  lat: number;
  /** East-positive longitude, degrees. */
  lon: number;
  category: PoiCategory;
  description: string;
  /** Why an astronaut would visit. */
  importance: string;
  images: PoiImage[];
  source: { label: string; url: string };
}
