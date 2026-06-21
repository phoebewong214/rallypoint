"""
Courts REST endpoints.

GET    /api/courts                 list courts (real distance from the viewer + fav flag)
GET    /api/courts/<slug>          single court
POST   /api/courts/<slug>/favorite favorite a court
DELETE /api/courts/<slug>/favorite un-favorite a court

Query params for list:
    sport   "Tennis" | "Pickleball"  (default: all)
    q       search term, matches name + address (default: none)
"""
from flask import Blueprint, request, jsonify

from extensions import db
from models import Court, CourtFavorite
from services.matching import haversine_miles
from utils.decorators import require_auth, current_user

courts_bp = Blueprint("courts", __name__)


@courts_bp.get("")
@require_auth
def list_courts():
    """List courts with the viewer's real straight-line distance + fav flag,
    nearest first. No fabricated activity/availability — only fields we can
    actually source."""
    viewer = current_user()
    sport = request.args.get("sport")
    q = (request.args.get("q") or "").strip().lower()

    rows = db.session.query(Court).all()
    fav_ids = {f.court_id for f in CourtFavorite.query.filter_by(user_id=viewer.id).all()}

    results = []
    for c in rows:
        sports_list = [s.strip() for s in (c.sports or "").split(",") if s.strip()]
        if sport and sport not in sports_list:
            continue
        if q and q not in c.name.lower() and q not in (c.address or "").lower():
            continue
        dist = haversine_miles(viewer.lat, viewer.lng, c.lat, c.lng)
        results.append({
            "id": c.slug,
            "name": c.name,
            "addr": c.address,
            "lat": c.lat,
            "lng": c.lng,
            "primary": c.primary_sport,
            "sports": sports_list,
            "courtCount": c.court_count,
            "surface": c.surface,
            "lights": c.lights,
            "distance": round(dist, 1) if dist is not None else None,
            "fav": c.id in fav_ids,
        })

    # Nearest first; courts with unknown distance (viewer/court missing coords)
    # sort to the end rather than pretending to be at distance 0.
    results.sort(key=lambda r: (r["distance"] is None, r["distance"] or 0.0))
    return jsonify({"courts": results, "count": len(results)})


@courts_bp.get("/<slug>")
@require_auth
def get_court(slug: str):
    c = Court.query.filter_by(slug=slug).first_or_404()
    return jsonify({"court": c.to_dict()})


@courts_bp.post("/<slug>/favorite")
@require_auth
def favorite_court(slug: str):
    viewer = current_user()
    c = Court.query.filter_by(slug=slug).first_or_404()
    if not CourtFavorite.query.filter_by(user_id=viewer.id, court_id=c.id).first():
        db.session.add(CourtFavorite(user_id=viewer.id, court_id=c.id))
        db.session.commit()
    return jsonify({"id": slug, "fav": True})


@courts_bp.delete("/<slug>/favorite")
@require_auth
def unfavorite_court(slug: str):
    viewer = current_user()
    c = Court.query.filter_by(slug=slug).first_or_404()
    CourtFavorite.query.filter_by(user_id=viewer.id, court_id=c.id).delete()
    db.session.commit()
    return jsonify({"id": slug, "fav": False})
