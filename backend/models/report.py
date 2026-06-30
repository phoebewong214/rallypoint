"""
UserReport — a trust & safety report filed by one user against another.

Filed from the app ("Report" on a player card) and worked through the admin
review queue. A report carries a coarse reason + free-text detail; admins
resolve it (review / dismiss) and may suspend the reported account in one step.
"""
from datetime import datetime

from extensions import db

# Coarse buckets the reporter picks from. Kept deliberately short; the free-text
# `details` field carries the specifics. Mirrored in the frontend report modal.
REPORT_REASONS = ("harassment", "no_show", "fake_profile", "inappropriate", "safety", "other")

# Lifecycle of a report in the admin queue.
REPORT_STATUSES = ("open", "reviewed", "dismissed")


class UserReport(db.Model):
    __tablename__ = "user_reports"

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    reported_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    reason = db.Column(db.String(32), nullable=False)
    details = db.Column(db.Text)
    status = db.Column(db.String(16), nullable=False, default="open", server_default="open", index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Set when an admin resolves the report (review/dismiss).
    resolved_at = db.Column(db.DateTime)
    resolved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    resolution_note = db.Column(db.Text)

    reporter = db.relationship("User", foreign_keys=[reporter_id])
    reported = db.relationship("User", foreign_keys=[reported_id])
    resolved_by = db.relationship("User", foreign_keys=[resolved_by_id])

    def to_dict(self) -> dict:
        """Admin-facing record: the report plus light summaries of both parties so
        the queue is readable without extra lookups."""
        def who(u):
            if not u:
                return None
            return {"id": u.id, "name": u.name, "handle": u.handle, "email": u.email}

        return {
            "id": self.id,
            "reason": self.reason,
            "details": self.details,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolutionNote": self.resolution_note,
            "reporter": who(self.reporter),
            "reported": who(self.reported),
            "reportedIsActive": self.reported.is_active if self.reported else None,
            "resolvedBy": who(self.resolved_by),
        }
