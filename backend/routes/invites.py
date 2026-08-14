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
  GET  /api/invites/<id>/messages          the game's chat thread (participants only)
  POST /api/invites/<id>/messages          send a chat message (confirmed games only)
  POST /api/invites/<id>/messages/read     advance the viewer's read position
"""
import hashlib
import json
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_limiter.util import get_remote_address
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from extensions import db, limiter
from models import (
    AIMatchLog, GameInvite, Message, MessageRead, Session, SessionStatus, User, Court,
)
from models.game_invite import (
    TimeProposal, PHASE_AWAITING, PHASE_SETTLING, PHASE_CONFIRMED,
    PHASE_DECLINED, PHASE_CANCELLED, OPEN_PHASES,
)
from schemas.invites import (
    CreateInviteSchema, CreateMessageSchema, DeclineInviteSchema, MarkReadSchema,
    ProposeTimeSchema,
)
from services.auth import extract_bearer
from services.email import send_email
from services.matching import score_and_reason
from services.stream import broker
from services.unread import unread_counts
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

invites_bp = Blueprint("invites", __name__)


def _get_or_404(invite_id: int):
    inv = GameInvite.query.get(invite_id)
    if inv is None:
        return None, (jsonify({"error": "Invite not found"}), 404)
    return inv, None


def _games_url() -> str:
    base = current_app.config.get("APP_BASE_URL", "").rstrip("/")
    return f"{base}/sessions"


def _fmt(dt) -> str:
    return dt.strftime("%a %b %-d, %-I:%M %p") if dt else "the proposed time"


def _other_party(inv: GameInvite, viewer_id: int) -> User:
    """The participant who ISN'T the actor — i.e. who to notify."""
    return inv.invitee if viewer_id == inv.inviter_id else inv.inviter


def _upsert_match_log(inviter: User, invitee: User, sport: str) -> "AIMatchLog":
    """Get-or-create the (inviter→invitee, sport) match-log row and refresh its
    score/signal snapshot from the current heuristic. Caller commits."""
    m = score_and_reason(inviter, invitee, sport)
    row = AIMatchLog.query.filter_by(
        viewer_id=inviter.id, candidate_id=invitee.id, sport=sport
    ).first()
    if row is None:
        row = AIMatchLog(viewer_id=inviter.id, candidate_id=invitee.id, sport=sport,
                         score=0, reason="")
        db.session.add(row)
    row.score = m["score"]
    row.reason = m["summary"]
    row.source = "heuristic"
    row.signals = json.dumps(m["signals"])
    row.score_version = m["score_version"]
    return row


def _snapshot_match(inviter: User, invitee: User, sport: str) -> None:
    """Record what the matcher claimed at the moment an invite was sent — the
    training-data write. Runs in its own transaction AFTER the invite commit;
    a snapshot failure must never break the invite."""
    try:
        _upsert_match_log(inviter, invitee, sport)
        db.session.commit()
    except Exception:  # noqa: BLE001 — analytics writes never break the flow
        db.session.rollback()


def _record_outcome(inv: GameInvite, outcome: str) -> None:
    """Label the invite's match-log row ("accepted" / "declined"). If the invite
    predates snapshotting, backfill a snapshot at current state — a late label
    beats no label. Last decision wins (a decline after a confirm overwrites)."""
    try:
        row = AIMatchLog.query.filter_by(
            viewer_id=inv.inviter_id, candidate_id=inv.invitee_id, sport=inv.sport
        ).first()
        if row is None:
            # Invite predates snapshotting — backfill at current state. When a
            # snapshot exists we deliberately do NOT refresh it: the label must
            # attach to the score that was live when the invite went out.
            row = _upsert_match_log(inv.inviter, inv.invitee, inv.sport)
        row.outcome = outcome
        row.outcome_at = datetime.utcnow()
        db.session.commit()
    except Exception:  # noqa: BLE001 — analytics writes never break the flow
        db.session.rollback()


def _publish_invites(inv: GameInvite) -> None:
    """Nudge both parties' open SSE streams (see routes/stream.py) so their My
    Games views refetch. Call only after a successful commit; a push failure
    must never break the write it announces."""
    try:
        for uid in (inv.inviter_id, inv.invitee_id):
            broker.publish(uid, {"type": "invites"})
    except Exception:  # noqa: BLE001 — push is best-effort, like email
        pass


def _publish_chat(inv: GameInvite) -> None:
    """Nudge both parties that this game's chat thread changed. Like the invite
    nudge it carries no message content — clients refetch the thread through the
    authenticated read path — but it does name the thread (inviteId) so an open
    panel only refetches its own conversation."""
    try:
        for uid in (inv.inviter_id, inv.invitee_id):
            broker.publish(uid, {"type": "chat", "inviteId": inv.id})
    except Exception:  # noqa: BLE001 — push is best-effort, like email
        pass


def _notify(user: User, subject: str, body: str) -> None:
    """Best-effort 'your turn' email — a mail failure must never break the
    request, so everything is swallowed (send_email is already non-raising, but
    building the body / reading relationships could still throw)."""
    try:
        if user and user.email:
            send_email(
                user.email, subject,
                f"{body}\n\nOpen it in My Games: {_games_url()}\n\n— RallyPoint",
            )
    except Exception:  # noqa: BLE001 — never let email failure break the request
        pass


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
    invitee = User.query.get(data.inviteeId)
    if not invitee:
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
    _publish_invites(inv)
    # Training-data write: freeze the score/signals the matcher showed for this
    # pair at send time; accept/decline later labels this row.
    _snapshot_match(viewer, invitee, data.sport)
    _notify(
        inv.invitee,
        f"{viewer.name} invited you to play {data.sport}",
        f"{viewer.name} wants to play {data.sport} with you on RallyPoint. "
        "Accept the time, suggest another, or decline.",
    )
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
    _publish_invites(inv)
    _record_outcome(inv, "accepted")  # invitee agreed to play — positive label
    _notify(
        inv.inviter,
        f"{viewer.name} is in — now settle a time",
        f"{viewer.name} confirmed they want to play your {inv.sport} game. "
        "Suggest a time (or accept theirs) to lock it in.",
    )
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
    _publish_invites(inv)
    _notify(
        _other_party(inv, viewer.id),
        f"{viewer.name} proposed a time",
        f"{viewer.name} suggested {_fmt(data.startAt)} for your {inv.sport} game. "
        "Accept it or counter with another time.",
    )
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
    _publish_invites(inv)
    _record_outcome(inv, "accepted")  # game confirmed — strongest positive label
    _notify(
        _other_party(inv, viewer.id),
        f"Game on 🎾 — {viewer.name} accepted {_fmt(proposal.start_at)}",
        f"{viewer.name} accepted your time. Your {inv.sport} game is confirmed "
        f"for {_fmt(proposal.start_at)}. See you on court!",
    )
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
    _publish_invites(inv)
    _record_outcome(inv, "declined")  # negative label for the snapshot
    _notify(
        inv.inviter,
        f"{viewer.name} declined your invite",
        f"{viewer.name} can't make the {inv.sport} game this time."
        + (f' They said: "{data.reason}"' if data.reason else ""),
    )
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
    _publish_invites(inv)
    _notify(
        _other_party(inv, viewer.id),
        f"{viewer.name} called off the game",
        f"{viewer.name} cancelled the {inv.sport} game you were arranging. "
        "No worries — find another partner any time.",
    )
    return jsonify({"invite": inv.to_dict(viewer.id)})


# ---- per-game chat --------------------------------------------------------

# No-`after` reads return at most this many of the LATEST messages (still in
# ascending order) so a long-running thread can't grow the response unboundedly.
CHAT_PAGE_LIMIT = 200


def _get_participant_invite_or_404(invite_id: int, viewer: User):
    """The invite, but ONLY for its two participants. A non-participant gets the
    same 404 as a nonexistent id — the chat endpoints never confirm that an
    invite (or a conversation) exists to anyone outside it."""
    inv = GameInvite.query.get(invite_id)
    if inv is None or viewer.id not in (inv.inviter_id, inv.invitee_id):
        return None, (jsonify({"error": "Invite not found"}), 404)
    return inv, None


def _chat_send_key() -> str:
    """Per-account throttle key for sending messages: the auth credential
    (cookie or Bearer) hashes to a stable per-session bucket, so one chatty
    user can't consume an office/NAT IP's whole allowance. Falls back to IP
    when unauthenticated (those requests all 401 anyway)."""
    token = extract_bearer(request.headers.get("Authorization")) \
        or request.cookies.get(current_app.config["AUTH_COOKIE_NAME"])
    if token:
        return "chat:" + hashlib.sha256(token.encode()).hexdigest()[:32]
    return get_remote_address()


@invites_bp.get("/<int:invite_id>/messages")
@require_auth
def list_messages(invite_id: int):
    viewer = current_user()
    inv, err = _get_participant_invite_or_404(invite_id, viewer)
    if err:
        return err
    # Any phase is readable: a declined/cancelled game keeps its history.
    after = request.args.get("after", type=int)
    q = Message.query.filter(Message.invite_id == inv.id)
    if after is not None:
        rows = q.filter(Message.id > after).order_by(Message.id.asc()).all()
    else:
        # Latest CHAT_PAGE_LIMIT, presented oldest-first like the panel renders.
        rows = q.order_by(Message.id.desc()).limit(CHAT_PAGE_LIMIT).all()
        rows.reverse()
    return jsonify({"messages": [m.to_dict(viewer.id) for m in rows]})


@invites_bp.post("/<int:invite_id>/messages")
@require_auth
@limiter.limit("30 per minute", key_func=_chat_send_key)
def send_message(invite_id: int):
    viewer = current_user()
    inv, err = _get_participant_invite_or_404(invite_id, viewer)
    if err:
        return err
    if inv.phase != PHASE_CONFIRMED:
        return jsonify({"error": "Chat opens once the game is confirmed"}), 409
    data = parse_json(CreateMessageSchema)
    msg = Message(invite_id=inv.id, sender_id=viewer.id, body=data.body)
    db.session.add(msg)
    db.session.commit()
    _publish_chat(inv)
    return jsonify({"message": msg.to_dict(viewer.id)}), 201


@invites_bp.post("/<int:invite_id>/messages/read")
@require_auth
def mark_messages_read(invite_id: int):
    """Advance the viewer's read position in this thread (any phase — history
    of a dead game can be read, so it can be marked read too). Forward-only:
    a stale tab reporting an old id can't resurrect cleared unread badges. The
    reported id is clamped to the thread's real tail so a client can't
    pre-read messages that don't exist yet."""
    viewer = current_user()
    inv, err = _get_participant_invite_or_404(invite_id, viewer)
    if err:
        return err
    data = parse_json(MarkReadSchema)
    tail = db.session.query(func.max(Message.id)).filter(
        Message.invite_id == inv.id).scalar() or 0
    target = min(data.lastReadId, tail)

    row = MessageRead.query.filter_by(invite_id=inv.id, user_id=viewer.id).first()
    if row is None and target > 0:
        try:
            db.session.add(MessageRead(
                invite_id=inv.id, user_id=viewer.id, last_read_message_id=target))
            db.session.commit()
        except IntegrityError:
            # Another request (second device/tab) created the row first — fall
            # through and advance it like any existing row.
            db.session.rollback()
            row = MessageRead.query.filter_by(
                invite_id=inv.id, user_id=viewer.id).first()
    if row is not None and target > row.last_read_message_id:
        row.last_read_message_id = target
        db.session.commit()

    # 0 whenever the client reported the id it just rendered — returned so the
    # caller can reconcile without a second request if it was behind.
    return jsonify({"unread": unread_counts(viewer.id, [inv.id]).get(inv.id, 0)})
