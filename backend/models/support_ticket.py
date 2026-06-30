"""
SupportTicket — a persisted "talk to a human" escalation.

Previously escalations were fire-and-forget emails: if delivery failed or the
inbox was missed, the message was gone. Now every escalation is stored here
first (never lost) and worked through the admin support desk; the email to the
support inbox is a best-effort notification on top.
"""
import json
from datetime import datetime

from extensions import db

# Lifecycle in the admin support desk.
TICKET_STATUSES = ("open", "closed")


class SupportTicket(db.Model):
    __tablename__ = "support_tickets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    # The AI-chat turns that preceded the escalation, JSON-encoded (or null).
    history_json = db.Column(db.Text)
    status = db.Column(db.String(16), nullable=False, default="open", server_default="open", index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    resolved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    resolution_note = db.Column(db.Text)

    user = db.relationship("User", foreign_keys=[user_id])
    resolved_by = db.relationship("User", foreign_keys=[resolved_by_id])

    def history(self) -> list:
        if not self.history_json:
            return []
        try:
            return json.loads(self.history_json)
        except (ValueError, TypeError):
            return []

    def to_dict(self) -> dict:
        u = self.user
        return {
            "id": self.id,
            "message": self.message,
            "history": self.history(),
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolutionNote": self.resolution_note,
            "user": {"id": u.id, "name": u.name, "handle": u.handle, "email": u.email} if u else None,
            "resolvedBy": (
                {"id": self.resolved_by.id, "name": self.resolved_by.name}
                if self.resolved_by else None
            ),
        }
