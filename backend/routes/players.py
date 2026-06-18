"""
GET /api/players — list potential partners with AI score + reason.

Query params:
    sport     "Tennis" | "Pickleball"  (default: viewer's primary sport)
    ntrpMin   float                    (default: 2.0)
    ntrpMax   float                    (default: 5.0)
"""
from flask import Blueprint, request, jsonify

from extensions import db
from models import User, SportProfile, AIMatchLog
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

    candidates = (
        db.session.query(User)
        .join(SportProfile, SportProfile.user_id == User.id)
        .filter(User.id != viewer.id)
        .filter(SportProfile.sport == sport)
        .all()
    )

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

        score, reason = score_and_reason(viewer, cand, sport)

        log = AIMatchLog.query.filter_by(
            viewer_id=viewer.id, candidate_id=cand.id, sport=sport
        ).first()
        if log:
            log.score = score
            log.reason = reason
        else:
            db.session.add(
                AIMatchLog(
                    viewer_id=viewer.id,
                    candidate_id=cand.id,
                    sport=sport,
                    score=score,
                    reason=reason,
                    source="heuristic",
                )
            )

        results.append(
            {
                "id": cand.id,
                "name": cand.name,
                "initials": cand.initials,
                "color": cand.avatar_color,
                "fg": cand.avatar_fg,
                "location": cand.location,
                "distance": "1.0",  # TODO: Haversine vs viewer when geocoded
                "online": False,
                "tennis": cand.profile_for("Tennis").to_dict() if cand.profile_for("Tennis") else None,
                "pickleball": cand.profile_for("Pickleball").to_dict() if cand.profile_for("Pickleball") else None,
                "matchScore": score,
                "reason": reason,
                "sport": sport,
                "ntrp": cand_profile.ntrp,
                "availability": cand_profile.availability_summary,
            }
        )
    db.session.commit()

    results.sort(key=lambda r: -r["matchScore"])
    return jsonify({"players": results, "count": len(results)})
