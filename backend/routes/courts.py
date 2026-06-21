"""
Courts REST endpoints.

GET    /api/courts                 list courts (real distance + regulars + upcoming + fav)
GET    /api/courts/<slug>          single court
POST   /api/courts/<slug>/favorite favorite a court
DELETE /api/courts/<slug>/favorite un-favorite a court

Query params for list:
    sport   "Tennis" | "Pickleball"  (default: all)
    q       search term, matches name + address (default: none)
"""
from datetime import datetime

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from extensions import db
from models import Court, CourtFavorite, SportProfile, Session, SessionStatus, User
from services.matching import haversine_miles
from utils.decorators import require_auth, current_user

courts_bp = Blueprint("courts", __name__)

# A court counts a session as "happening here" while it's still open or
# confirmed and in the future.
_LIVE_STATUSES = (
    SessionStatus.PENDING.value,
    SessionStatus.REQUESTED.value,
    SessionStatus.CONFIRMED.value,
)


def _regulars_by_court(sport: str | None) -> dict[int, list[User]]:
    """court_id -> distinct list of users who call it their home court (for the
    given sport, or any sport when sport is None). One aggregate query, no N+1."""
    q = (
        db.session.query(SportProfile.home_court_id, User)
        .join(User, User.id == SportProfile.user_id)
        .filter(SportProfile.home_court_id.isnot(None))
    )
    if sport:
        q = q.filter(SportProfile.sport == sport)
    out: dict[int, dict[int, User]] = {}
    for court_id, user in q.all():
        out.setdefault(court_id, {})[user.id] = user
    return {cid: list(users.values()) for cid, users in out.items()}


def _upcoming_by_court() -> dict[int, int]:
    """court_id -> count of live, future sessions booked there."""
    rows = (
        db.session.query(Session.court_id, func.count(Session.id))
        .filter(
            Session.court_id.isnot(None),
            Session.status.in_(_LIVE_STATUSES),
            Session.scheduled_at > datetime.utcnow(),
        )
        .group_by(Session.court_id)
        .all()
    )
    return dict(rows)


@courts_bp.get("")
@require_auth
def list_courts():
    """List courts with the viewer's real distance, fav flag, and — derived from
    real data — how many players call each court home plus how many games are
    booked there. No fabricated activity/availability."""
    viewer = current_user()
    sport = request.args.get("sport")
    q = (request.args.get("q") or "").strip().lower()

    rows = db.session.query(Court).all()
    fav_ids = {f.court_id for f in CourtFavorite.query.filter_by(user_id=viewer.id).all()}
    regulars = _regulars_by_court(sport)
    upcoming = _upcoming_by_court()

    results = []
    for c in rows:
        sports_list = [s.strip() for s in (c.sports or "").split(",") if s.strip()]
        if sport and sport not in sports_list:
            continue
        if q and q not in c.name.lower() and q not in (c.address or "").lower():
            continue
        dist = haversine_miles(viewer.lat, viewer.lng, c.lat, c.lng)
        regs = regulars.get(c.id, [])
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
            "regularsCount": len(regs),
            "regulars": [{"initials": u.initials, "color": u.avatar_color} for u in regs[:3]],
            "upcomingCount": upcoming.get(c.id, 0),
        })

    # Nearest first; courts with unknown distance sort to the end.
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
