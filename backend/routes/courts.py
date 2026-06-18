"""
GET /api/courts — list Chicago courts.

Query params:
    sport      "Tennis" | "Pickleball"  (default: all)
    q          search term, matches name + address (default: none)
"""
from flask import Blueprint, request, jsonify
from extensions import db
from models import Court
from utils.decorators import require_auth

courts_bp = Blueprint("courts", __name__)


@courts_bp.get("")
@require_auth
def list_courts():
    """
    List courts visible to the authenticated user.
    ---
    tags: [Courts]
    security:
      - Bearer: []
    parameters:
      - {in: query, name: sport, type: string, enum: [Tennis, Pickleball]}
      - {in: query, name: q,     type: string, description: search by name or address}
    responses:
      200:
        description: Courts list
        schema:
          type: object
          properties:
            courts: {type: array, items: {type: object}}
            count:  {type: integer}
      401: {description: Missing/invalid token}
    """
    sport = request.args.get("sport")
    q = (request.args.get("q") or "").strip().lower()

    query = db.session.query(Court)
    rows = query.all()

    results = []
    for c in rows:
        sports_list = [s.strip() for s in (c.sports or "").split(",") if s.strip()]
        if sport and sport not in sports_list:
            continue
        if q and q not in c.name.lower() and q not in (c.address or "").lower():
            continue
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
        })

    return jsonify({"courts": results, "count": len(results)})


@courts_bp.get("/<slug>")
@require_auth
def get_court(slug: str):
    """
    Get a single court by slug.
    ---
    tags: [Courts]
    security:
      - Bearer: []
    parameters:
      - {in: path, name: slug, type: string, required: true}
    responses:
      200: {description: Court detail}
      401: {description: Missing/invalid token}
      404: {description: Court not found}
    """
    c = Court.query.filter_by(slug=slug).first_or_404()
    return jsonify({"court": c.to_dict()})
