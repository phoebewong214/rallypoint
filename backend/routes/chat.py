"""
Cross-thread chat aggregates.

Thread-scoped chat lives under /api/invites/<id>/messages; this blueprint
carries what spans threads: the viewer's total unread count, which drives the
red dot on the My Games nav tab from any page.

  GET /api/chat/unread-total    {"total": N} across the viewer's live threads
"""
from flask import Blueprint, jsonify

from services.unread import unread_total
from utils.decorators import require_auth, current_user

chat_bp = Blueprint("chat", __name__)


@chat_bp.get("/unread-total")
@require_auth
def get_unread_total():
    return jsonify({"total": unread_total(current_user().id)})
