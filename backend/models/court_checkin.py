"""
"I'm here now" check-ins — the crowdsourced signal behind a court's busy status.
A check-in is considered active for ACTIVE_WINDOW after it's made.
"""
from datetime import datetime, timedelta
from extensions import db

ACTIVE_WINDOW = timedelta(hours=2)


class CourtCheckIn(db.Model):
    __tablename__ = "court_checkins"
    __table_args__ = (
        db.UniqueConstraint("court_id", "user_id", name="uq_court_user_checkin"),
    )

    id = db.Column(db.Integer, primary_key=True)
    court_id = db.Column(db.Integer, db.ForeignKey("courts.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    @staticmethod
    def active_cutoff() -> datetime:
        return datetime.utcnow() - ACTIVE_WINDOW
