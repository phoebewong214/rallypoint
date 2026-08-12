"""
Per-game chat messages.

A thread is keyed by the GameInvite (NOT the materialized sessions row): the
invite exists for the whole life of a game — including cancelled ones, where
the session may never materialize — and its inviter/invitee pair is stable, so
participant authorization stays trivial. Only `phase=confirmed` invites accept
new messages (routes enforce it); dead phases keep their history readable.

New table, created via its own Alembic migration (no existing table is touched).
"""
from datetime import datetime, timezone

from extensions import db

# Server-side body bounds (enforced again by the Pydantic schema after strip).
BODY_MAX_LEN = 1000


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    invite_id = db.Column(db.Integer, db.ForeignKey("game_invites.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # The read path is always "this thread, in id order (optionally after X)".
    __table_args__ = (db.Index("ix_messages_invite_id_id", "invite_id", "id"),)

    invite = db.relationship("GameInvite", foreign_keys=[invite_id])
    sender = db.relationship("User", foreign_keys=[sender_id])

    def to_dict(self, viewer_id: int) -> dict:
        return {
            "id": self.id,
            "inviteId": self.invite_id,
            "senderId": self.sender_id,
            "senderName": self.sender.name if self.sender else None,
            "mine": self.sender_id == viewer_id,
            "body": self.body,
            # created_at is naive UTC (utcnow); the +00:00 suffix makes browsers
            # parse it as UTC and render in the viewer's local zone.
            "createdAt": self.created_at.replace(tzinfo=timezone.utc).isoformat()
            if self.created_at else None,
        }
