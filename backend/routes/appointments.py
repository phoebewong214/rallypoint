"""
Court appointments (open games) + check-ins.

  POST   /api/courts/<slug>/appointments   create an open game
  POST   /api/courts/<slug>/checkin        "I'm here now"
  DELETE /api/courts/<slug>/checkin        check out
  POST   /api/appointments/<id>/join       join (or waitlist if full)
  POST   /api/appointments/<id>/leave      leave (promotes next in queue)
  DELETE /api/appointments/<id>            host cancels
"""
from flask import Blueprint, jsonify

from extensions import db
from models import (
    Court, CourtAppointment, AppointmentParticipant, CourtCheckIn, User,
)
from schemas import CreateAppointmentSchema, CheckInSchema
from services.email import send_email
from services.matching import haversine_miles
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

appointments_bp = Blueprint("appointments", __name__)


def _notify_promoted(user: User, appt: CourtAppointment) -> None:
    """Email a user who just moved off the waitlist into a confirmed spot."""
    try:
        when = appt.scheduled_at.strftime("%a %b %-d, %-I:%M %p") if appt.scheduled_at else "the scheduled time"
        court = appt.court.name if appt.court else "the court"
        send_email(
            user.email,
            "You're in — a spot opened up 🎾",
            f"Hi {user.name},\n\nA spot just opened in the {appt.sport} game at {court} "
            f"on {when}. You're confirmed — see you there!\n\n— RallyPoint",
        )
    except Exception:  # noqa: BLE001 — never let email failure break the request
        pass


def _promote(appt: CourtAppointment) -> None:
    """Fill confirmed spots from the front of the waitlist, notifying anyone moved up."""
    confirmed, waitlist = appt.ordered()
    i = 0
    while len(confirmed) < appt.max_players and i < len(waitlist):
        p = waitlist[i]
        p.waitlisted = False
        confirmed.append(p)
        _notify_promoted(p.user, appt)
        i += 1


@appointments_bp.post("/courts/<slug>/appointments")
@require_auth
def create_appointment(slug):
    viewer = current_user()
    court = Court.query.filter_by(slug=slug).first_or_404()
    data = parse_json(CreateAppointmentSchema)
    appt = CourtAppointment(
        court_id=court.id, creator_id=viewer.id, sport=data.sport,
        scheduled_at=data.scheduledAt, max_players=data.maxPlayers, note=data.note,
    )
    db.session.add(appt)
    db.session.flush()
    db.session.add(AppointmentParticipant(appointment_id=appt.id, user_id=viewer.id, waitlisted=False))
    db.session.commit()
    return jsonify({"appointment": appt.to_dict(viewer.id)}), 201


@appointments_bp.post("/appointments/<int:aid>/join")
@require_auth
def join_appointment(aid):
    viewer = current_user()
    appt = CourtAppointment.query.get_or_404(aid)
    if appt.status != "open":
        return jsonify({"error": "this game is no longer open"}), 409
    existing = AppointmentParticipant.query.filter_by(appointment_id=aid, user_id=viewer.id).first()
    if existing:
        return jsonify({"appointment": appt.to_dict(viewer.id)})
    confirmed, _ = appt.ordered()
    waitlisted = len(confirmed) >= appt.max_players
    db.session.add(AppointmentParticipant(appointment_id=aid, user_id=viewer.id, waitlisted=waitlisted))
    db.session.commit()
    return jsonify({"appointment": appt.to_dict(viewer.id)})


@appointments_bp.post("/appointments/<int:aid>/leave")
@require_auth
def leave_appointment(aid):
    viewer = current_user()
    appt = CourtAppointment.query.get_or_404(aid)
    mine = AppointmentParticipant.query.filter_by(appointment_id=aid, user_id=viewer.id).first()
    if not mine:
        return jsonify({"error": "you're not in this game"}), 400
    was_confirmed = not mine.waitlisted
    db.session.delete(mine)
    db.session.flush()
    if was_confirmed:
        _promote(appt)  # a confirmed spot freed up
    db.session.commit()
    return jsonify({"appointment": appt.to_dict(viewer.id)})


@appointments_bp.delete("/appointments/<int:aid>")
@require_auth
def cancel_appointment(aid):
    viewer = current_user()
    appt = CourtAppointment.query.get_or_404(aid)
    if appt.creator_id != viewer.id:
        return jsonify({"error": "only the host can cancel this game"}), 403
    appt.status = "cancelled"
    db.session.commit()
    return jsonify({"appointment": appt.to_dict(viewer.id)})


@appointments_bp.post("/courts/<slug>/checkin")
@require_auth
def check_in(slug):
    viewer = current_user()
    court = Court.query.filter_by(slug=slug).first_or_404()
    data = parse_json(CheckInSchema)
    # Soft distance sanity check (only when we have both coords): within ~3 miles.
    if data.lat is not None and data.lng is not None and court.lat is not None:
        dist = haversine_miles(data.lat, data.lng, court.lat, court.lng)
        if dist is not None and dist > 3.0:
            return jsonify({"error": f"You seem to be {dist:.0f} mi from this court — check in when you're there."}), 400
    row = CourtCheckIn.query.filter_by(court_id=court.id, user_id=viewer.id).first()
    if row:
        from datetime import datetime
        row.created_at = datetime.utcnow()  # refresh the active window
    else:
        db.session.add(CourtCheckIn(court_id=court.id, user_id=viewer.id))
    db.session.commit()
    return jsonify({"ok": True, "checkedIn": True})


@appointments_bp.delete("/courts/<slug>/checkin")
@require_auth
def check_out(slug):
    viewer = current_user()
    court = Court.query.filter_by(slug=slug).first_or_404()
    CourtCheckIn.query.filter_by(court_id=court.id, user_id=viewer.id).delete()
    db.session.commit()
    return jsonify({"ok": True, "checkedIn": False})
