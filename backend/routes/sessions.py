"""
Sessions REST endpoints.
"""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from sqlalchemy import and_, or_

from extensions import db
from models import Session, SessionStatus, User
from schemas import CreateSessionSchema, RescheduleSessionSchema
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

sessions_bp = Blueprint("sessions", __name__)

OPEN_STATUSES = (SessionStatus.PENDING.value, SessionStatus.REQUESTED.value)
ACTIVE_STATUSES = OPEN_STATUSES + (SessionStatus.CONFIRMED.value,)


def _participant_or_403(s, viewer):
    """Return None if viewer is host or guest, else a 403 response tuple."""
    if viewer.id not in (s.host_id, s.guest_id):
        return jsonify({"error": "not authorized"}), 403
    return None


@sessions_bp.get("")
@require_auth
def list_sessions():
    viewer = current_user()
    # Cancelled / declined games leave a trace: they stay visible (in Past) so
    # the other party can see a request was turned down or a game called off.
    # We keep only recent ones to avoid unbounded clutter; with no cancelled_at
    # column (create_all can't ALTER prod tables) we bound on scheduled_at.
    cancel_cutoff = datetime.utcnow() - timedelta(days=30)
    rows = (
        Session.query.filter(
            or_(Session.host_id == viewer.id, Session.guest_id == viewer.id),
            or_(
                Session.status != SessionStatus.CANCELLED.value,
                and_(
                    Session.scheduled_at.isnot(None),
                    Session.scheduled_at >= cancel_cutoff,
                ),
            ),
        )
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
    # Idempotency guard: don't let the same pair stack duplicate open/active
    # invites for the same sport — return the existing one instead.
    existing = Session.query.filter(
        Session.sport == data.sport,
        Session.status.in_(ACTIVE_STATUSES),
        or_(
            and_(Session.host_id == viewer.id, Session.guest_id == data.guestId),
            and_(Session.host_id == data.guestId, Session.guest_id == viewer.id),
        ),
    ).first()
    if existing:
        return jsonify({
            "error": "You already have a game in the works with this player.",
            "session": existing.to_dict(viewer.id),
        }), 409
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
    """The responder (guest of the current open invite) confirms the time."""
    viewer = current_user()
    s = Session.query.get_or_404(sid)
    if s.guest_id != viewer.id:
        return jsonify({"error": "not authorized"}), 403
    if s.status not in OPEN_STATUSES:
        return jsonify({"error": "this session can no longer be accepted"}), 409
    s.status = SessionStatus.CONFIRMED.value
    db.session.commit()
    return jsonify({"session": s.to_dict(viewer.id)})


@sessions_bp.post("/<int:sid>/decline")
@require_auth
def decline(sid):
    """The responder declines an open invite."""
    viewer = current_user()
    s = Session.query.get_or_404(sid)
    if s.guest_id != viewer.id:
        return jsonify({"error": "not authorized"}), 403
    if s.status not in OPEN_STATUSES:
        return jsonify({"error": "this session can no longer be declined"}), 409
    s.status = SessionStatus.CANCELLED.value
    db.session.commit()
    return jsonify({"session": s.to_dict(viewer.id)})


@sessions_bp.post("/<int:sid>/cancel")
@require_auth
def cancel(sid):
    """Either participant cancels an open or confirmed session."""
    viewer = current_user()
    s = Session.query.get_or_404(sid)
    err = _participant_or_403(s, viewer)
    if err:
        return err
    if s.status not in ACTIVE_STATUSES:
        return jsonify({"error": "this session can no longer be cancelled"}), 409
    s.status = SessionStatus.CANCELLED.value
    db.session.commit()
    return jsonify({"session": s.to_dict(viewer.id)})


@sessions_bp.post("/<int:sid>/reschedule")
@require_auth
def reschedule(sid):
    """Either participant proposes a new time. The proposer becomes the host
    (awaiting), the other party becomes the guest who must re-confirm — so the
    invite re-opens to the OTHER person. No extra column needed."""
    viewer = current_user()
    s = Session.query.get_or_404(sid)
    err = _participant_or_403(s, viewer)
    if err:
        return err
    if s.status not in ACTIVE_STATUSES:
        return jsonify({"error": "this session can no longer be rescheduled"}), 409
    data = parse_json(RescheduleSessionSchema)
    other_id = s.guest_id if viewer.id == s.host_id else s.host_id
    s.host_id = viewer.id            # proposer
    s.guest_id = other_id            # responder
    s.scheduled_at = data.scheduledAt
    if data.note is not None:
        s.note = data.note
    s.status = SessionStatus.PENDING.value
    db.session.commit()
    return jsonify({"session": s.to_dict(viewer.id)})
