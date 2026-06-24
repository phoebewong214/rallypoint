"""
GET /api/invites — the viewer's two-phase game invites (the new invite flow),
serialized in the same viewer-relative shape as sessions so My Games can render
both in one feed.

This is the READ PATH only. Mutations (create / confirm-opponent / decline /
propose-time / accept-time) land in a later change. Deploying this just creates
the new tables and exposes a dormant read endpoint.
"""
from flask import Blueprint, jsonify
from sqlalchemy import or_

from models import GameInvite
from models.game_invite import PHASE_CONFIRMED
from utils.decorators import require_auth, current_user

invites_bp = Blueprint("invites", __name__)


@invites_bp.get("")
@require_auth
def list_invites():
    viewer = current_user()
    rows = (
        GameInvite.query
        .filter(or_(GameInvite.inviter_id == viewer.id, GameInvite.invitee_id == viewer.id))
        # A confirmed invite is represented by its materialized `sessions` row
        # (shown via /api/sessions) — don't double-list it here.
        .filter(GameInvite.phase != PHASE_CONFIRMED)
        .order_by(GameInvite.updated_at.desc())
        .all()
    )
    return jsonify({"invites": [inv.to_dict(viewer.id) for inv in rows]})
