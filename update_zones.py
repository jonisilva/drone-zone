"""Download ANAC's UAS geozones (ED-318 export, static zones + NOTAMs) and
convert them to a plain GeoJSON file the web app can load.

Usage:  python update_zones.py
Writes: data/zones.geojson

Standard library only. ANAC's server sends no CORS headers, so the browser
cannot fetch the export directly; run this script to refresh the data
(NOTAMs change daily, so refresh before each flight-planning session).
"""
import json
import math
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = "https://dnt.anac.pt/index.php?action=download-json"
SOURCE_PAGE = "https://dnt.anac.pt/"
OUT = Path(__file__).resolve().parent / "data" / "zones.geojson"
CIRCLE_STEPS = 64
EARTH_M_PER_DEG = 111_320.0


def text(value, lang):
    """ED-318 text is a list of {text, lang}; pick one language, fall back to any."""
    if isinstance(value, str):
        return value
    if not value:
        return ""
    for item in value:
        if item.get("lang", "").upper() == lang:
            return item.get("text", "")
    return value[0].get("text", "")


def both(value):
    return {"pt": text(value, "PT"), "en": text(value, "EN")}


def circle(lon, lat, radius_m):
    ring = []
    for i in range(CIRCLE_STEPS + 1):
        a = 2 * math.pi * i / CIRCLE_STEPS
        dlat = radius_m * math.sin(a) / EARTH_M_PER_DEG
        dlon = radius_m * math.cos(a) / (EARTH_M_PER_DEG * math.cos(math.radians(lat)))
        ring.append([round(lon + dlon, 7), round(lat + dlat, 7)])
    return {"type": "Polygon", "coordinates": [ring]}


def to_metres(value, uom):
    if value is None:
        return None
    return round(value * 0.3048) if str(uom).lower() == "ft" else value


def convert(feature):
    p = feature["properties"]
    g = feature["geometry"]
    layer = g.get("layer") or {}
    uom = layer.get("uom", "m")

    if g["type"] == "Point":
        radius = (g.get("extent") or {}).get("radius")
        if not radius:
            return None
        geometry = circle(*g["coordinates"], radius)
    else:
        geometry = {"type": g["type"], "coordinates": g["coordinates"]}

    authorities = [
        {
            "name": both(a.get("name")),
            "email": a.get("email", ""),
            "phone": a.get("phone", ""),
            "site": a.get("siteURL", ""),
        }
        for a in p.get("zoneAuthority") or []
    ]
    ext = p.get("extendedProperties") or {}
    return {
        "type": "Feature",
        "properties": {
            "id": p.get("identifier"),
            "name": both(p.get("name")),
            "type": p.get("type"),
            "reason": p.get("reason") or [],
            "reasonInfo": both(p.get("otherReasonInfo")),
            "message": both(p.get("message")),
            "lower": to_metres(layer.get("lower"), uom),
            "upper": to_metres(layer.get("upper"), uom),
            "lowerRef": layer.get("lowerReference", ""),
            "upperRef": layer.get("upperReference", ""),
            "windows": [
                [w.get("startDateTime"), w.get("endDateTime")]
                for w in p.get("limitedApplicability") or []
            ],
            "authorities": authorities,
            "notam": ext.get("notam_inf", ""),
        },
        "geometry": geometry,
    }


def main():
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "zonas-drone-updater/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = json.load(resp)

    features = [f for f in (convert(x) for x in raw.get("features", [])) if f]
    if len(features) < 50:
        sys.exit(f"Only {len(features)} zones received; keeping the old file.")

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "source": SOURCE_PAGE,
            "sourceName": raw.get("name", ""),
            "issued": (raw.get("metadata") or {}).get("issued"),
            "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "features": features,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(features)} zones to {OUT}")


if __name__ == "__main__":
    main()
