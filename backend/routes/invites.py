"""
Two-phase game invites.

Flow: A invites B (proposing a specific time OR a window). B either declines, or
accepts. For a specific proposed time the responder can accept in one tap →
the game is CONFIRMED and a real `sessions` row is materialized. For a window
(or to counter), the parties confirm the opponent and then propose/counter a
specific time until one side accepts.

  POST /api/invites                      create an invite (+ opening proposal)
  POST /api/invites/<id>/confirm-opponent  invitee agrees to play (awaiting→settling)
  POST /api/invites/<id>/propose-time      either party offers/counters a time
  POST /api/invites/<id>/accept-time       non-proposer accepts the open SPECIFIC time → confirmed
  POST /api/invites/<id>/decline           invitee declines
  POST /api/invites/<id>/cancel            either party calls it off
  GET  /api/invites                        the viewer's open invites (read path)
"""
from flask import Blueprint, jsonify
from sqlalchemy import or_

from extensions import db
from models import GameInvite, Session, SessionStatus, User, Court
from models.game_invite import (
    TimeProposal, PHASE_AWAITING, PHASE_SETTLING, PHASE_CONFIRMED,
    PHASE_DECLINED, PHASE_CANCELLED, OPEN_PHASES,
)
from schemas.invites import CreateInviteSchema, ProposeTimeSchema, DeclineInviteSchema
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

invites_bp = Blueprint("invites", __name__)


def _get_or_404(invite_id: int):
    inv = GameInvite.query.get(invite_id)
    if inv is None:
        return None, (jsonify({"error": "Invite not found"}), 404)
    return inv, None


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


@invites_bp.post("")
@require_auth
def create_invite():
    viewer = current_user()
    data = parse_json(CreateInviteSchema)
    if data.inviteeId == viewer.id:
        return jsonify({"error": "You can't invite yourself"}), 400
    if not User.query.get(data.inviteeId):
        return jsonify({"error": "That player no longer exists"}), 404

    # Idempotency: don't stack duplicate open invites between the same pair for
    # the same sport (either direction). Return the existing one.
    existing = GameInvite.query.filter(
        GameInvite.sport == data.sport,
        GameInvite.phase.in_(OPEN_PHASES),
        or_(
            (GameInvite.inviter_id == viewer.id) & (GameInvite.invitee_id == data.inviteeId),
            (GameInvite.inviter_id == data.inviteeId) & (GameInvite.invitee_id == viewer.id),
        ),
    ).first()
    if existing:
        return jsonify({
            "error": "You already have an invite in the works with this player.",
            "invite": existing.to_dict(viewer.id),
        }), 409

    court_id = None
    if data.court:
        court = Court.query.filter_by(slug=data.court).first()
        court_id = court.id if court else None

    inv = GameInvite(
        inviter_id=viewer.id, invitee_id=data.inviteeId, sport=data.sport,
        court_id=court_id, note=data.note, phase=PHASE_AWAITING,
    )
    db.session.add(inv)
    db.session.flush()
    # Opening proposal carries A's offered time / window.
    db.session.add(TimeProposal(
        invite_id=inv.id, proposed_by_id=viewer.id,
        start_at=data.startAt, end_at=data.endAt,
    ))
    db.session.commit()
    return jsonify({"invite": inv.to_dict(viewer.id)}), 201


@invites_bp.post("/<int:invite_id>/confirm-opponent")
@require_auth
def confirm_opponent(invite_id: int):
    viewer = current_user()
    inv, err = _get_or_404(invite_id)
    if err:
        return err
    if viewer.id != inv.invitee_id:
        return jsonify({"error": "Only the invited player can confirm"}), 403
    if inv.phase != PHASE_AWAITING:
        return jsonify({"error": "This invite isn't awaiting confirmation"}), 409
    inv.phase = PHASE_SETTLING
    db.session.commit()
    return jsonify({"invite": inv.to_dict(viewer.id)})


@invites_bp.post("/<int:invite_id>/propose-time")
@require_auth
def propose_time(invite_id: int):
    viewer = current_user()
    inv, err = _get_or_404(invite_id)
    if err:
        return err
    if viewer.id not in (inv.inviter_id, inv.invitee_id):
        return jsonify({"error": "not authorized"}), 403
    if inv.phase not in (PHASE_AWAITING, PHASE_SETTLING):
        return jsonify({"error": "This invite isn't open for proposals"}), 409
    data = parse_json(ProposeTimeSchema)
    # Proposing a time implies the opponent is agreed — move into settling.
    inv.phase = PHASE_SETTLING
    for p in inv.proposals:
        if p.status == "open":
            p.status = "superseded"
    db.session.add(TimeProposal(
        invite_id=inv.id, proposed_by_id=viewer.id,
        start_at=data.startAt, end_at=data.endAt,
    ))
    db.session.commit()
    return jsonify({"invite": inv.to_dict(viewer.id)})


@invites_bp.post("/<int:invite_id>/accept-time")
@require_auth
def accept_time(invite_id: int):
    viewer = current_user()
    inv, err = _get_or_404(invite_id)
    if err:
        return err
    if viewer.id not in (inv.inviter_id, inv.invitee_id):
        return jsonify({"error": "not authorized"}), 403
    if inv.phase not in (PHASE_AWAITING, PHASE_SETTLING):
        return jsonify({"error": "This invite can't be accepted right now"}), 409
    proposal = inv.latest_open_proposal()
    if proposal is None:
        return jsonify({"error": "There's no time on the table to accept"}), 409
    if proposal.end_at is not None:
        return jsonify({"error": "Pick a specific time within the window first"}), 409
    if proposal.proposed_by_id == viewer.id:
        return jsonify({"error": "You proposed this time — the other player accepts it"}), 409

    # Lock it in: materialize a real confirmed session (the calendar/stats surface
    # is unchanged — it only ever sees real sessions rows).
    s = Session(
        host_id=inv.inviter_id, guest_id=inv.invitee_id, sport=inv.sport,
        scheduled_at=proposal.start_at, status=SessionStatus.CONFIRMED.value,
        court_id=inv.court_id, note=inv.note,
    )
    db.session.add(s)
    db.session.flush()
    proposal.status = "accepted"
    inv.phase = PHASE_CONFIRMED
    inv.session_id = s.id
    db.session.commit()
    return jsonify({"invite": inv.to_dict(viewer.id), "session": s.to_dict(viewer.id)})


@invites_bp.post("/<int:invite_id>/decline")
@require_auth
def decline_invite(invite_id: int):
    viewer = current_user()
    inv, err = _get_or_404(invite_id)
    if err:
        return err
    if viewer.id != inv.invitee_id:
        return jsonify({"error": "Only the invited player can decline"}), 403
    if inv.phase not in OPEN_PHASES:
        return jsonify({"error": "This invite is no longer open"}), 409
    data = parse_json(DeclineInviteSchema)
    inv.phase = PHASE_DECLINED
    inv.decline_reason = data.reason
    db.session.commit()
    return jsonify({"invite": inv.to_dict(viewer.id)})


@invites_bp.post("/<int:invite_id>/cancel")
@require_auth
def cancel_invite(invite_id: int):
    viewer = current_user()
    inv, err = _get_or_404(invite_id)
    if err:
        return err
    if viewer.id not in (inv.inviter_id, inv.invitee_id):
        return jsonify({"error": "not authorized"}), 403
    if inv.phase not in OPEN_PHASES:
        return jsonify({"error": "This invite is no longer open"}), 409
    inv.phase = PHASE_CANCELLED
    db.session.commit()
    return jsonify({"invite": inv.to_dict(viewer.id)})
