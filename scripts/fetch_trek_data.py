"""
Fetch Jezero Crater vector data + POI content from NASA Mars Trek and write
browser-ready static files into public/data/jezero/.

Standard library only (no GDAL needed). Run from the project root:

    python scripts/fetch_trek_data.py

Sources (all public NASA data, served by NASA Mars Trek / JPL):
  - Perseverance traverse path            (Mars 2020 mission)
  - Perseverance waypoints + descriptions (Mars Trek bookmarks)
  - Perseverance landing ellipse
  - CRISM MTRDR targeted observation footprints (MRO CRISM, PDS)
"""

from __future__ import annotations

import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "jezero"
IMG_OUT = ROOT / "public" / "images" / "poi"

TREK = "https://trek.nasa.gov"
ARCGIS = f"{TREK}/mars/trekarcgis/rest/services"
# Jezero region bounding box (lon_min, lat_min, lon_max, lat_max), east-positive.
BBOX = (76.9, 18.0, 78.0, 18.95)

UA = {"User-Agent": "marswalk-data-script/0.1"}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def query_geojson(service: str) -> dict:
    params = {
        "where": "1=1",
        "geometry": ",".join(map(str, BBOX)),
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "*",
        "f": "geojson",
    }
    url = f"{ARCGIS}/{service}/MapServer/0/query?{urllib.parse.urlencode(params)}"
    return json.loads(get(url).decode("utf-8"))


def r6(v: float) -> float:
    return round(v, 6)


def simplify_path(fc: dict, min_step_deg: float = 0.00005) -> dict:
    """Merge traverse segments (ordered by sol) and drop near-duplicate vertices."""
    feats = sorted(fc["features"], key=lambda f: (f["properties"].get("sol") or 0))
    out_feats = []
    for f in feats:
        g = f["geometry"]
        coords = g["coordinates"]
        if g["type"] == "MultiLineString":
            coords = [c for part in coords for c in part]
        kept = []
        for c in coords:
            p = [r6(c[0]), r6(c[1])]
            if not kept or abs(p[0] - kept[-1][0]) + abs(p[1] - kept[-1][1]) >= min_step_deg:
                kept.append(p)
        last = [r6(coords[-1][0]), r6(coords[-1][1])]
        if kept[-1] != last:
            kept.append(last)
        if len(kept) < 2:
            continue
        props = f["properties"]
        out_feats.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": kept},
                "properties": {"sol": props.get("sol"), "length_m": props.get("length")},
            }
        )
    return {"type": "FeatureCollection", "features": out_feats}


def strip_geom(fc: dict, keep: list[str]) -> dict:
    def round_coords(c):
        if isinstance(c[0], (int, float)):
            return [r6(c[0]), r6(c[1])]
        return [round_coords(x) for x in c]

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": f["geometry"]["type"],
                    "coordinates": round_coords(f["geometry"]["coordinates"]),
                },
                "properties": {k: f["properties"].get(k) for k in keep},
            }
            for f in fc["features"]
        ],
    }


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# Category + short "why go there" for the astronaut planner. The long
# description comes from NASA Mars Trek's bookmark page for each waypoint.
POI_META = {
    "Jezero Crater": ("crater", "Context: an impact crater that once held a lake fed by river channels."),
    "Perseverance Landing Ellipse": ("landing", "Mission reference: the planned landing area for Mars 2020."),
    "Western Delta Deposit": ("sedimentary", "Top astrobiology target: layered, clay-rich lake delta sediments that could preserve biosignatures."),
    "Northern Delta Deposit": ("sedimentary", "Second delta fan, useful for comparing sediment sources entering the lake."),
    "Western Breach": ("geomorphology", "Gap in the crater rim cut by inflowing water; exposes rim stratigraphy."),
    "Western Inflow Channel": ("fluvial", "River valley that carried water and sediment into the lake (Neretva Vallis)."),
    "Northern Inflow Channel": ("fluvial", "Northern river valley (Sava Vallis) feeding the lake; samples catchment rocks."),
}


# Shown as its own map layer instead, and it overlaps the habitat marker.
SKIP_WAYPOINTS = {"Perseverance Landing Ellipse"}

# Mars Trek's "Northern Inflow Channel" bookmark links to the Western Inflow
# Channel page (upstream data error), so we supply our own text for it.
DESC_OVERRIDE = {
    "Northern Inflow Channel": (
        "Sava Vallis, the smaller of Jezero's two inflow valleys, entered the crater from the north "
        "and built the northern delta fan. Comparing its sediments with the western delta helps "
        "scientists understand how much of the lake's mud and sand came from each watershed."
    ),
}


def page_text_and_images(template_url: str) -> tuple[str, list[str]]:
    raw = get(template_url).decode("utf-8", "replace")
    imgs = re.findall(r'src="([^"]+\.(?:jpg|jpeg|png))"', raw, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(re.sub(r"\s+", " ", text)).strip()
    # Drop "In the view below..." captions that refer to images we show separately.
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s for s in sentences if not re.match(r"(In the|The) (view|image)s? below", s)]
    return " ".join(sentences), [urllib.parse.urljoin(TREK, i) for i in imgs]


def build_pois(waypoints: dict, path: dict) -> list[dict]:
    pois = []
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    for f in waypoints["features"]:
        p = f["properties"]
        name = p["name"]
        if name in SKIP_WAYPOINTS:
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        if name in DESC_OVERRIDE:
            desc, img_urls = DESC_OVERRIDE[name], []
        else:
            desc, img_urls = page_text_and_images(p["template"])
        images = []
        for u in img_urls[:3]:
            fname = f"{slug(name)}-{Path(urllib.parse.urlparse(u).path).name}"
            target = IMG_OUT / fname
            if not target.exists():
                try:
                    target.write_bytes(get(u))
                except Exception as e:  # noqa: BLE001
                    print(f"  ! image failed {u}: {e}", file=sys.stderr)
                    continue
            images.append({"url": f"/images/poi/{fname}", "credit": "NASA/JPL-Caltech/University of Arizona (via NASA Mars Trek)"})
        category, importance = POI_META.get(name, ("other", ""))
        pois.append(
            {
                "id": slug(name),
                "name": name,
                "lat": r6(lat),
                "lon": r6(lon),
                "category": category,
                "description": desc,
                "importance": importance,
                "images": images,
                "source": {"label": "NASA Mars Trek — Perseverance bookmarks", "url": p["template"]},
            }
        )

    # Landing site = first vertex of the traverse (sol-ordered).
    start = path["features"][0]["geometry"]["coordinates"][0]
    pois.insert(
        0,
        {
            "id": "octavia-e-butler-landing",
            "name": "Octavia E. Butler Landing (Habitat)",
            "lat": start[1],
            "lon": start[0],
            "category": "habitat",
            "description": "Perseverance touched down here on 18 February 2021. In this demo it is the astronaut habitat: the default start point for every Marswalk.",
            "importance": "Mission base: start and end point for excursions.",
            "images": [],
            "source": {"label": "Derived from the Perseverance traverse path (NASA/JPL-Caltech)", "url": f"{ARCGIS}/Perseverance_Traverse_Path/MapServer"},
        },
    )
    return pois


def write(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / name
    target.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"  wrote {target.relative_to(ROOT)} ({target.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    print("Fetching Perseverance traverse path…")
    path = simplify_path(query_geojson("Perseverance_Traverse_Path"))
    write("perseverance-path.geojson", path)

    print("Fetching landing ellipse…")
    write("landing-ellipse.geojson", strip_geom(query_geojson("perseverance_landing_ellipse"), []))

    print("Fetching CRISM observation footprints…")
    write(
        "crism-footprints.geojson",
        strip_geom(query_geojson("mars_mro_crism_mtrdr_c0a_humex_frt_sites"), ["ProductId", "UTCstart", "ProdURL"]),
    )

    print("Fetching waypoints + NASA descriptions…")
    pois = build_pois(query_geojson("mars2020_waypoints"), path)
    write("pois.json", pois)
    print("Done.")


if __name__ == "__main__":
    main()
