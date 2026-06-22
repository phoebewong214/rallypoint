"""
GET /api/players — list potential partners with AI score + reason.

Query params:
    sport     "Tennis" | "Pickleball"  (default: viewer's primary sport)
    ntrpMin   float                    (default: 2.0)
    ntrpMax   float                    (default: 5.0)
    courts    comma-separated court slugs — only players whose home court (for
              this sport) is one of them (default: any)
"""
from flask import Blueprint, request, jsonify
from sqlalchemy.orm import selectinload

from extensions import db
from models import User, SportProfile, Court, SavedPlayer
from services.matching import score_and_reason
from utils.decorators import require_auth, current_user

players_bp = Blueprint("players", __name__)


@players_bp.get("")
@require_auth
def list_players():
    """
    AI-ranked list of potential partners for the authenticated viewer.
    ---
    tags: [Players]
    security:
      - Bearer: []
    parameters:
      - {in: query, name: sport,   type: string, enum: [Tennis, Pickleball]}
      - {in: query, name: ntrpMin, type: number, default: 2.0}
      - {in: query, name: ntrpMax, type: number, default: 5.0}
    responses:
      200:
        description: Players list (already sorted by matchScore desc)
        schema:
          type: object
          properties:
            count:   {type: integer, example: 3}
            players: {type: array, items: {type: object}}
      401: {description: Missing/invalid token}
    """
    viewer = current_user()
    sport = request.args.get("sport", viewer.primary_sport or "Pickleball")
    try:
        ntrp_lo = float(request.args.get("ntrpMin", 2.0))
        ntrp_hi = float(request.args.get("ntrpMax", 5.0))
    except (TypeError, ValueError):
        return jsonify({"error": "ntrpMin/ntrpMax must be numeric"}), 400

    # Optional home-court filter: only players whose sport profile's home court
    # is one of the selected courts.
    court_slugs = [s.strip() for s in (request.args.get("courts") or "").split(",") if s.strip()]

    # selectinload the candidates' sport profiles in one batched query so the
    # per-candidate profile_for() / to_dict() below don't each fire a SELECT
    # (was an N+1 over the whole candidate pool).
    candidates_q = (
        db.session.query(User)
        .options(selectinload(User.sport_profiles))
        .join(SportProfile, SportProfile.user_id == User.id)
        .filter(User.id != viewer.id)
        .filter(SportProfile.sport == sport)
    )
    if court_slugs:
        court_ids = [c.id for c in Court.query.filter(Court.slug.in_(court_slugs)).all()]
        candidates_q = candidates_q.filter(SportProfile.home_court_id.in_(court_ids or [-1]))
    candidates = candidates_q.all()

    saved_ids = {s.player_id for s in SavedPlayer.query.filter_by(user_id=viewer.id).all()}

    results = []
    for cand in candidates:
        cand_profile = cand.profile_for(sport)
        if not cand_profile:
            continue
        try:
            n = float(cand_profile.ntrp)
        except (TypeError, ValueError):
            continue
        if not (ntrp_lo <= n <= ntrp_hi):
            continue

        score, reason, dist_miles = score_and_reason(viewer, cand, sport)
        tennis = cand.profile_for("Tennis")
        pickleball = cand.profile_for("Pickleball")

        results.append(
            {
                "id": cand.id,
                "name": cand.name,
                "initials": cand.initials,
                "color": cand.avatar_color,
                "fg": cand.avatar_fg,
                "location": cand.location,
                "distance": f"{dist_miles:.1f}" if dist_miles is not None else "—",
                "online": False,
                "tennis": tennis.to_dict() if tennis else None,
                "pickleball": pickleball.to_dict() if pickleball else None,
                "matchScore": score,
                "reason": reason,
                "sport": sport,
                "ntrp": cand_profile.ntrp,
                "availability": cand_profile.availability_summary,
                "saved": cand.id in saved_ids,
            }
        )

    # NOTE: this is a read-only GET. We deliberately do NOT persist an
    # AIMatchLog per candidate here — scores/reasons are cheap to recompute and
    # logging every candidate on every filter change was pure write
    # amplification (a GET holding a write transaction). If match analytics are
    # wanted later, do it out-of-band, not on the hot read path.
    results.sort(key=lambda r: -r["matchScore"])
    return jsonify({"players": results, "count": len(results)})


@players_bp.get("/saved")
@require_auth
def saved_players():
    """The viewer's saved players (for the Profile page). No viewer-relative
    match score/reason — just who they bookmarked."""
    viewer = current_user()
    rows = (
        db.session.query(User)
        .options(selectinload(User.sport_profiles))
        .join(SavedPlayer, SavedPlayer.player_id == User.id)
        .filter(SavedPlayer.user_id == viewer.id)
        .all()
    )
    players = [
        {
            "id": u.id,
            "name": u.name,
            "initials": u.initials,
            "color": u.avatar_color,
            "fg": u.avatar_fg,
            "location": u.location,
            "primarySport": u.primary_sport,
            "sports": [p.sport for p in u.sport_profiles],
        }
        for u in rows
    ]
    return jsonify({"players": players, "count": len(players)})


@players_bp.post("/<int:pid>/save")
@require_auth
def save_player(pid: int):
    viewer = current_user()
    if pid == viewer.id:
        return jsonify({"error": "You can't save yourself"}), 400
    if not User.query.get(pid):
        return jsonify({"error": "That player no longer exists"}), 404
    if not SavedPlayer.query.filter_by(user_id=viewer.id, player_id=pid).first():
        db.session.add(SavedPlayer(user_id=viewer.id, player_id=pid))
        db.session.commit()
    return jsonify({"id": pid, "saved": True})


@players_bp.delete("/<int:pid>/save")
@require_auth
def unsave_player(pid: int):
    viewer = current_user()
    SavedPlayer.query.filter_by(user_id=viewer.id, player_id=pid).delete()
    db.session.commit()
    return jsonify({"id": pid, "saved": False})
