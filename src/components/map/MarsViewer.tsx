"use client";

import { useEffect, useRef, useState } from "react";
import type * as CesiumNS from "cesium";
import { LAYERS } from "@/lib/layers/catalog";
import { JEZERO } from "@/lib/mars/region";
import { loadJson } from "@/lib/data/loadJson";
import type { ImageryLayerDef, LayerStateMap, VectorLayerDef } from "@/types/layer";
import type { ScientificPOI } from "@/types/poi";

type Cesium = typeof CesiumNS;

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

export interface Coordinates {
  lat: number;
  lon: number;
}

interface Props {
  layers: LayerStateMap;
  pois: ScientificPOI[];
  selectedPoiId: string | null;
  onSelectPoi: (id: string | null) => void;
  onCursorMove: (c: Coordinates | null) => void;
  /** Increment to fly the camera back to the region view. */
  homeSignal: number;
}

interface GeoJson {
  features: { geometry: { type: string; coordinates: unknown } }[];
}

const POI_COLORS: Record<string, string> = {
  habitat: "#4ade80",
  sedimentary: "#fb923c",
  fluvial: "#38bdf8",
  geomorphology: "#f472b6",
  crater: "#e5e7eb",
  landing: "#facc15",
  other: "#e5e7eb",
};

export default function MarsViewer({
  layers,
  pois,
  selectedPoiId,
  onSelectPoi,
  onCursorMove,
  homeSignal,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cesiumRef = useRef<Cesium | null>(null);
  const viewerRef = useRef<CesiumNS.Viewer | null>(null);
  const imageryRef = useRef(new Map<string, CesiumNS.ImageryLayer>());
  const vectorRef = useRef(new Map<string, CesiumNS.CustomDataSource>());
  const poiSourceRef = useRef<CesiumNS.CustomDataSource | null>(null);
  const callbacksRef = useRef({ onSelectPoi, onCursorMove });
  callbacksRef.current = { onSelectPoi, onCursorMove };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Create the viewer once -------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let handler: CesiumNS.ScreenSpaceEventHandler | undefined;
    const imagery = imageryRef.current;
    const vectors = vectorRef.current;

    (async () => {
      window.CESIUM_BASE_URL = "/cesium/";
      const C: Cesium = await import("cesium");
      if (cancelled || !containerRef.current) return;
      cesiumRef.current = C;

      const mars = C.Ellipsoid.MARS;
      // Everything (fromDegrees, GeoJSON, picking) now defaults to Mars.
      C.Ellipsoid.default = mars;

      const viewer = new C.Viewer(containerRef.current, {
        globe: new C.Globe(mars),
        mapProjection: new C.GeographicProjection(mars),
        terrainProvider: new C.EllipsoidTerrainProvider({ ellipsoid: mars }),
        baseLayer: false,
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        skyBox: false,
        skyAtmosphere: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
      });
      viewerRef.current = viewer;

      const scene = viewer.scene;
      scene.backgroundColor = C.Color.fromCssColorString("#050303");
      scene.globe.baseColor = C.Color.fromCssColorString("#3a1d12");
      scene.globe.showGroundAtmosphere = false;
      scene.globe.enableLighting = false;
      scene.globe.maximumScreenSpaceError = 1.5;
      if (scene.sun) scene.sun.show = false;
      if (scene.moon) scene.moon.show = false;

      // Imagery: optical basemaps at the bottom, analysis overlays (elevation,
      // thermal) above them so their opacity blends over the photos.
      const imageryDefs = LAYERS.filter((l): l is ImageryLayerDef => l.kind === "imagery");
      const ordered = [
        ...imageryDefs.filter((l) => l.category === "optical"),
        ...imageryDefs.filter((l) => l.category !== "optical"),
      ];
      for (const def of ordered) {
        const provider = new C.UrlTemplateImageryProvider({
          url: def.url,
          tilingScheme: new C.GeographicTilingScheme({ ellipsoid: mars }),
          maximumLevel: def.maximumLevel,
          rectangle: def.rectangle ? C.Rectangle.fromDegrees(...def.rectangle) : undefined,
          credit: new C.Credit(`${def.source.mission} ${def.source.instrument} via NASA Mars Trek`),
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        imageryRef.current.set(def.id, layer);
      }

      // Vector overlays.
      for (const def of LAYERS.filter((l): l is VectorLayerDef => l.kind === "vector")) {
        const ds = new C.CustomDataSource(def.id);
        await viewer.dataSources.add(ds);
        vectorRef.current.set(def.id, ds);
        loadJson<GeoJson>(def.dataUrl)
          .then((gj) => addGeoJson(C, ds, gj, def.color))
          .then(() => scene.requestRender())
          .catch((e) => console.error(e));
      }

      // POIs on top.
      const poiDs = new C.CustomDataSource("pois");
      await viewer.dataSources.add(poiDs);
      poiSourceRef.current = poiDs;

      const [w, s, e, n] = JEZERO.view;
      viewer.camera.setView({ destination: C.Rectangle.fromDegrees(w, s, e, n) });

      handler = new C.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((m: CesiumNS.ScreenSpaceEventHandler.MotionEvent) => {
        const cart = viewer.camera.pickEllipsoid(m.endPosition, mars);
        if (!cart) return callbacksRef.current.onCursorMove(null);
        const c = mars.cartesianToCartographic(cart);
        callbacksRef.current.onCursorMove({
          lat: C.Math.toDegrees(c.latitude),
          lon: C.Math.toDegrees(c.longitude),
        });
      }, C.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction((click: CesiumNS.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = scene.pick(click.position);
        const id = picked?.id?.id as string | undefined;
        callbacksRef.current.onSelectPoi(id?.startsWith("poi:") ? id.slice(4) : null);
      }, C.ScreenSpaceEventType.LEFT_CLICK);

      setReady(true);
    })().catch((e: unknown) => {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      handler?.destroy();
      viewerRef.current?.destroy();
      viewerRef.current = null;
      imagery.clear();
      vectors.clear();
      poiSourceRef.current = null;
    };
  }, []);

  // --- Sync layer visibility / opacity ------------------------------------
  useEffect(() => {
    if (!ready) return;
    for (const [id, layer] of imageryRef.current) {
      const st = layers[id];
      if (!st) continue;
      layer.show = st.visible;
      layer.alpha = st.opacity;
    }
    for (const [id, ds] of vectorRef.current) {
      ds.show = layers[id]?.visible ?? false;
    }
    viewerRef.current?.scene.requestRender();
  }, [layers, ready]);

  // --- Sync POI markers ---------------------------------------------------
  useEffect(() => {
    const C = cesiumRef.current;
    const ds = poiSourceRef.current;
    if (!ready || !C || !ds) return;
    ds.entities.removeAll();
    for (const poi of pois) {
      const selected = poi.id === selectedPoiId;
      const color = C.Color.fromCssColorString(POI_COLORS[poi.category] ?? POI_COLORS.other);
      ds.entities.add({
        id: `poi:${poi.id}`,
        position: C.Cartesian3.fromDegrees(poi.lon, poi.lat, 0, C.Ellipsoid.MARS),
        point: {
          pixelSize: selected ? 16 : 11,
          color,
          outlineColor: selected ? C.Color.WHITE : C.Color.BLACK,
          outlineWidth: selected ? 3 : 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: poi.name,
          font: `${selected ? "600 " : ""}13px sans-serif`,
          fillColor: C.Color.WHITE,
          outlineColor: C.Color.BLACK,
          outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, -18),
          verticalOrigin: C.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 400_000),
        },
      });
    }
    viewerRef.current?.scene.requestRender();
  }, [pois, selectedPoiId, ready]);

  // --- Fly to the selected POI --------------------------------------------
  useEffect(() => {
    const C = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !C || !viewer || !selectedPoiId) return;
    const poi = pois.find((p) => p.id === selectedPoiId);
    if (!poi) return;
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(poi.lon, poi.lat, 9_000, C.Ellipsoid.MARS),
      duration: 1.5,
    });
  }, [selectedPoiId, pois, ready]);

  // --- Home button ----------------------------------------------------------
  useEffect(() => {
    const C = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !C || !viewer || homeSignal === 0) return;
    const [w, s, e, n] = JEZERO.view;
    viewer.camera.flyTo({ destination: C.Rectangle.fromDegrees(w, s, e, n), duration: 1.5 });
  }, [homeSignal, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-mars-200">
          Initializing Mars globe…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-red-300">
          Could not start the map: {error}
        </div>
      )}
    </div>
  );
}

function addGeoJson(C: Cesium, ds: CesiumNS.CustomDataSource, gj: GeoJson, css: string) {
  const color = C.Color.fromCssColorString(css);
  const toPositions = (ring: number[][]) =>
    C.Cartesian3.fromDegreesArray(ring.flatMap(([lon, lat]) => [lon, lat]), C.Ellipsoid.MARS);

  const lines: number[][][] = [];
  const polygons: number[][][] = [];
  for (const f of gj.features) {
    const { type, coordinates } = f.geometry;
    if (type === "LineString") lines.push(coordinates as number[][]);
    else if (type === "MultiLineString") lines.push(...(coordinates as number[][][]));
    else if (type === "Polygon") polygons.push((coordinates as number[][][])[0]);
    else if (type === "MultiPolygon")
      polygons.push(...(coordinates as number[][][][]).map((p) => p[0]));
  }

  // Merge contiguous line segments (e.g. rover drives by sol) into one polyline.
  if (lines.length) {
    ds.entities.add({
      polyline: {
        positions: toPositions(lines.flat()),
        width: 3,
        material: new C.PolylineOutlineMaterialProperty({
          color,
          outlineColor: C.Color.BLACK.withAlpha(0.6),
          outlineWidth: 1,
        }),
        clampToGround: true,
      },
    });
  }
  for (const ring of polygons) {
    ds.entities.add({
      polygon: {
        hierarchy: new C.PolygonHierarchy(toPositions(ring)),
        material: color.withAlpha(0.15),
      },
      polyline: {
        positions: toPositions(ring),
        width: 2,
        material: color,
        clampToGround: true,
      },
    });
  }
}
