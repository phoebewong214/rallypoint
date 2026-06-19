"""
POST /api/ai/match-reason
  body: {candidateId, sport}
  hdrs: Authorization: Bearer <jwt>

Returns the persisted AI verdict, regenerating with the heuristic (or
OpenAI if OPENAI_API_KEY is set) when no cached value exists.

NOTE: the frontend does NOT currently call this endpoint — the Find Partner
list already gets its score + reason inline from GET /api/players
(services.matching.score_and_reason). This route is kept as the on-demand
LLM-upgrade path (call it per card, async, to swap the heuristic reason for an
OpenAI one). It is rate-limited by the global limiter. If it stays unused,
consider removing it rather than letting it rot.
"""
from flask import Blueprint, jsonify, current_app

from extensions import db
from models import User, AIMatchLog
from schemas import MatchReasonSchema
from services.matching import score_and_reason, llm_reason
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

ai_bp = Blueprint("ai", __name__)


@ai_bp.post("/match-reason")
@require_auth
def match_reason():
    """
    Generate (or fetch cached) AI match reasoning for a specific candidate.
    Falls back to heuristic if OPENAI_API_KEY is not set.
    ---
    tags: [AI]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [candidateId, sport]
          properties:
            candidateId: {type: integer, example: 2}
            sport: {type: string, enum: [Tennis, Pickleball]}
    responses:
      200:
        description: Match verdict
        schema:
          type: object
          properties:
            score:  {type: integer, minimum: 0, maximum: 100}
            reason: {type: string}
            source: {type: string, enum: [heuristic, openai]}
      401: {description: Missing/invalid token}
      422: {description: Validation failed}
    """
    viewer = current_user()
    data = parse_json(MatchReasonSchema)

    cand = User.query.get_or_404(data.candidateId)
    score, heuristic_reason, _dist = score_and_reason(viewer, cand, data.sport)

    source = "heuristic"
    reason = heuristic_reason
    if current_app.config.get("OPENAI_API_KEY"):
        try:
            reason = llm_reason(viewer, cand, data.sport, score)
            source = "openai"
        except Exception as e:  # noqa: BLE001
            current_app.logger.warning("LLM reason failed, falling back: %s", e)

    log = AIMatchLog.query.filter_by(
        viewer_id=viewer.id, candidate_id=cand.id, sport=data.sport
    ).first()
    if log:
        log.score = score
        log.reason = reason
        log.source = source
    else:
        db.session.add(
            AIMatchLog(
                viewer_id=viewer.id,
                candidate_id=cand.id,
                sport=data.sport,
                score=score,
                reason=reason,
                source=source,
            )
        )
    db.session.commit()
    return jsonify({"score": score, "reason": reason, "source": source})
