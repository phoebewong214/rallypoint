"""
Per-user read position in a game chat thread.

One row per (invite, user): `last_read_message_id` is the highest message id the
user has seen in that thread — server-side, so the unread state follows the
account across devices. 0 (or no row) means nothing read yet. The position only
moves FORWARD (routes enforce it): a stale tab reporting an old id can't
resurrect already-cleared unread badges.

New table, created via its own Alembic migration (no existing table is touched).
"""
from datetime import datetime

from extensions import db


class MessageRead(db.Model):
    __tablename__ = "message_reads"

    id = db.Column(db.Integer, primary_key=True)
    invite_id = db.Column(db.Integer, db.ForeignKey("game_invites.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    last_read_message_id = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # One read position per participant per thread; the unread aggregates join
    # on exactly (invite_id, user_id), which this constraint also indexes.
    __table_args__ = (
        db.UniqueConstraint("invite_id", "user_id", name="uq_message_reads_invite_user"),
    )

    invite = db.relationship("GameInvite", foreign_keys=[invite_id])
    user = db.relationship("User", foreign_keys=[user_id])
