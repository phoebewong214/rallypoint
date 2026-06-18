"""
Sessions REST endpoints.
"""
from flask import Blueprint, jsonify
from sqlalchemy import or_

from extensions import db
from models import Session, SessionStatus, User
from schemas import CreateSessionSchema
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.get("")
@require_auth
def list_sessions():
    viewer = current_user()
    rows = (
        Session.query.filter(or_(Session.host_id == viewer.id, Session.guest_id == viewer.id))
        .order_by(Session.scheduled_at.desc())
        .all()
    )
    return jsonify({"sessions": [s.to_dict(viewer.id) for s in rows]})


@sessions_bp.post("")
@require_auth
def create_session():
    viewer = current_user()
    data = parse_json(CreateSessionSchema)
    if data.guestId == viewer.id:
        return jsonify({"error": "You can't start a session with yourself"}), 400
    if not User.query.get(data.guestId):
        return jsonify({"error": "That player no longer exists"}), 404
    s = Session(
        host_id=viewer.id,
        guest_id=data.guestId,
        sport=data.sport,
        scheduled_at=data.scheduledAt,
        status=SessionStatus.PENDING.value,
        note=data.note,
    )
    db.session.add(s)
    db.session.commit()
    return jsonify({"session": s.to_dict(viewer.id)}), 201


@sessions_bp.post("/<int:sid>/accept")
@require_auth
def accept(sid):
    viewer = current_user()
    s = Session.query.get_or_404(sid)
    if s.guest_id != viewer.id:
        return jsonify({"error": "not authorized"}), 403
    s.status = SessionStatus.CONFIRMED.value
    db.session.commit()
    return jsonify({"session": s.to_dict(viewer.id)})


@sessions_bp.post("/<int:sid>/decline")
@require_auth
def decline(sid):
    viewer = current_user()
    s = Session.query.get_or_404(sid)
    if s.guest_id != viewer.id:
        return jsonify({"error": "not authorized"}), 403
    s.status = SessionStatus.CANCELLED.value
    db.session.commit()
    return jsonify({"session": s.to_dict(viewer.id)})
