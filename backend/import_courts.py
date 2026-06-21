"""
Import real Chicago-area tennis / pickleball courts from OpenStreetMap.

Two steps:
  build()  — query the Overpass API for every tennis/pickleball pitch + every
             named park polygon in the Chicago bbox, cluster the pitches into
             the park that contains them, and write backend/data/chicago_courts.json.
  load()   — upsert that dataset into the courts table (idempotent by slug;
             never deletes). Safe to run against production.

CLI (via manage.py):
    python manage.py build-courts     # re-fetch from OSM, rewrite the json
    python manage.py import-courts    # load the json into the DB
    DATABASE_URL="<prod url>" python manage.py import-courts   # load into prod

OSM pitches are individual courts and almost never named, so we group them by
the named park/sports-centre polygon that contains them — yielding human-named
facilities ("Welles Park", "Grant Park Tennis Center") with a real court count.
"""
import json
import math
import os
import re
import urllib.request
from collections import defaultdict, Counter

# Chicago + near suburbs bounding box (S, W, N, E).
BBOX = (41.62, -87.95, 42.06, -87.52)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "chicago_courts.json")

_PITCH_Q = f"""[out:json][timeout:180];
( nwr["leisure"="pitch"]["sport"~"tennis|pickleball"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]}); );
out center tags;"""

_PARK_Q = f"""[out:json][timeout:180];
(
  way["leisure"~"^(park|sports_centre|recreation_ground)$"]["name"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  relation["leisure"~"^(park|sports_centre|recreation_ground)$"]["name"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out geom;"""

_SURFACE = {
    "asphalt": "Hard · Asphalt", "paved": "Hard · Paved", "acrylic": "Hard · Acrylic",
    "concrete": "Hard · Concrete", "clay": "Clay", "grass": "Grass", "tartan": "Tartan",
}


def _overpass(query: str) -> list:
    req = urllib.request.Request(
        OVERPASS_URL, data=query.encode("utf-8"),
        headers={"User-Agent": "RallyPoint/1.0 (+https://tryrallypoint.com) court import"},
    )
    with urllib.request.urlopen(req, timeout=200) as r:
        return json.loads(r.read().decode("utf-8"))["elements"]


def _coords(e):
    if e.get("center"):
        return e["center"]["lat"], e["center"]["lon"]
    if e.get("lat") is not None:
        return e["lat"], e["lon"]
    return None


def _in_ring(lat, lon, ring) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        latI, lonI = ring[i]
        latJ, lonJ = ring[j]
        if ((latI > lat) != (latJ > lat)) and (
            lon < (lonJ - lonI) * (lat - latI) / (latJ - latI + 1e-12) + lonI
        ):
            inside = not inside
        j = i
    return inside


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:60] or "court"


def build():
    print("Fetching pitches + parks from Overpass…")
    pitches = _overpass(_PITCH_Q)
    parks_raw = _overpass(_PARK_Q)
    print(f"  {len(pitches)} pitches, {len(parks_raw)} named areas")

    parks = []
    for p in parks_raw:
        t = p.get("tags", {})
        if t.get("leisure") not in ("park", "sports_centre", "recreation_ground"):
            continue
        name = t.get("name")
        if not name:
            continue
        rings = []
        if p["type"] == "way" and p.get("geometry"):
            rings.append([(g["lat"], g["lon"]) for g in p["geometry"]])
        elif p["type"] == "relation":
            for m in p.get("members", []):
                if m.get("role") == "outer" and m.get("geometry"):
                    rings.append([(g["lat"], g["lon"]) for g in m["geometry"]])
        if not rings:
            continue
        pts = [pt for r in rings for pt in r]
        lats = [a for a, _ in pts]
        lons = [b for _, b in pts]
        bbox = (min(lats), min(lons), max(lats), max(lons))
        parks.append({
            "name": name, "rings": rings, "bbox": bbox,
            "area": (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]),
            "key": f"{p['type']}/{p['id']}",
        })
    parks.sort(key=lambda x: x["area"])  # smallest (most specific) wins

    def find_park(lat, lon):
        for pk in parks:
            b = pk["bbox"]
            if b[0] <= lat <= b[2] and b[1] <= lon <= b[3] and any(_in_ring(lat, lon, r) for r in pk["rings"]):
                return pk
        return None

    groups = defaultdict(list)
    park_of = {}
    orphans = 0
    for e in pitches:
        c = _coords(e)
        if not c:
            continue
        lat, lon = c
        t = e.get("tags", {})
        sports = {s.strip().lower() for s in re.split(r"[;,]", t.get("sport", "")) if s.strip().lower() in ("tennis", "pickleball")}
        if not sports:
            continue
        pk = find_park(lat, lon)
        if not pk:
            orphans += 1
            continue
        groups[pk["key"]].append({"lat": lat, "lon": lon, "sports": sports,
                                  "surface": t.get("surface"), "lit": t.get("lit")})
        park_of[pk["key"]] = pk

    courts = []
    for key, members in groups.items():
        pk = park_of[key]
        lat = sum(m["lat"] for m in members) / len(members)
        lon = sum(m["lon"] for m in members) / len(members)
        sport_counts = Counter(s for m in members for s in m["sports"])
        sports = []
        if sport_counts.get("tennis"):
            sports.append("Tennis")
        if sport_counts.get("pickleball"):
            sports.append("Pickleball")
        primary = "tennis" if sport_counts.get("tennis", 0) >= sport_counts.get("pickleball", 0) else "pickleball"
        surfaces = Counter(m["surface"] for m in members if m["surface"])
        surface = None
        if surfaces:
            top = surfaces.most_common(1)[0][0]
            surface = _SURFACE.get(top, top.title())
        lits = {m["lit"] for m in members if m["lit"]}
        lights = True if "yes" in lits else (False if lits else None)
        courts.append({
            "slug": f"{slugify(pk['name'])}-{key.split('/')[-1]}",
            "name": pk["name"],
            "address": None,
            "lat": round(lat, 6),
            "lng": round(lon, 6),
            "primary_sport": primary,
            "sports": ",".join(sports),
            "court_count": len(members),
            "surface": surface,
            "lights": lights,
        })
    courts.sort(key=lambda c: (-c["court_count"], c["name"]))

    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w") as f:
        json.dump(courts, f, indent=1, ensure_ascii=False)
    print(f"  wrote {len(courts)} court facilities to {DATA_PATH} (skipped {orphans} pitches with no park)")


def load():
    """Upsert the built dataset into the courts table. Idempotent; never deletes."""
    from app import create_app
    from extensions import db
    from models import Court

    with open(DATA_PATH) as f:
        data = json.load(f)

    app = create_app()
    with app.app_context():
        added = updated = 0
        for row in data:
            c = Court.query.filter_by(slug=row["slug"]).first()
            if c is None:
                c = Court(slug=row["slug"])
                db.session.add(c)
                added += 1
            else:
                updated += 1
            c.name = row["name"]
            c.address = row["address"]
            c.lat = row["lat"]
            c.lng = row["lng"]
            c.primary_sport = row["primary_sport"]
            c.sports = row["sports"]
            c.court_count = row["court_count"]
            c.surface = row["surface"]
            c.lights = row["lights"]
        db.session.commit()
        print(f"import-courts: added {added}, updated {updated}. Total courts now: {Court.query.count()}.")
