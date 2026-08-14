"""
Unread-message aggregates for per-game chat.

Both queries are single batched statements (no per-thread loop): messages are
outer-joined to the viewer's stored read position (models/message_read.py) and
counted where the message id is past `last_read_message_id` — no row means
nothing read yet (position 0). The viewer's own messages never count toward
their own unread.
"""
from datetime import datetime

from sqlalchemy import and_, func, or_

from extensions import db
from models import GameInvite, Message, MessageRead, Session, SessionStatus
from models.game_invite import PHASE_CONFIRMED
from models.session_model import PAST_GRACE


def _viewer_position(viewer_id: int):
    """Join clause attaching the viewer's read position to each message row."""
    return and_(
        MessageRead.invite_id == Message.invite_id,
        MessageRead.user_id == viewer_id,
    )


def unread_counts(viewer_id: int, invite_ids) -> dict:
    """{invite_id: unread count} for the given threads; ids with nothing unread
    are simply absent. Callers pass only threads the viewer participates in
    (this function does not re-check participation)."""
    ids = [i for i in invite_ids if i is not None]
    if not ids:
        return {}
    rows = (
        db.session.query(Message.invite_id, func.count(Message.id))
        .outerjoin(MessageRead, _viewer_position(viewer_id))
        .filter(
            Message.invite_id.in_(ids),
            Message.sender_id != viewer_id,
            Message.id > func.coalesce(MessageRead.last_read_message_id, 0),
        )
        .group_by(Message.invite_id)
        .all()
    )
    return dict(rows)


def unread_total(viewer_id: int) -> int:
    """The viewer's unread total across LIVE threads only — confirmed games
    whose session is still confirmed and not yet past (same PAST_GRACE the
    session bucket uses). That is exactly the set of cards offering a chat
    entry, so the nav dot this feeds can always be cleared by opening them;
    counting dead threads (cancelled / long-past games, whose cards have no
    chat button) would light a dot with no way to turn it off."""
    cutoff = datetime.utcnow() - PAST_GRACE
    return int(
        db.session.query(func.count(Message.id))
        .join(GameInvite, GameInvite.id == Message.invite_id)
        .join(Session, Session.id == GameInvite.session_id)
        .outerjoin(MessageRead, _viewer_position(viewer_id))
        .filter(
            or_(
                GameInvite.inviter_id == viewer_id,
                GameInvite.invitee_id == viewer_id,
            ),
            GameInvite.phase == PHASE_CONFIRMED,
            Session.status == SessionStatus.CONFIRMED.value,
            Session.scheduled_at >= cutoff,
            Message.sender_id != viewer_id,
            Message.id > func.coalesce(MessageRead.last_read_message_id, 0),
        )
        .scalar()
        or 0
    )
