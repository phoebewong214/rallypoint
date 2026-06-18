"""
Session = a booked / requested / completed match between two users.
Named session_model.py to avoid shadowing flask.session.
"""
from datetime import datetime
import enum
from extensions import db


class SessionStatus(str, enum.Enum):
    REQUESTED = "requested"   # incoming invite, awaiting response
    PENDING   = "pending"     # outbound invite, awaiting their response
    CONFIRMED = "confirmed"   # both agreed, on the calendar
    COMPLETED = "completed"   # played
    CANCELLED = "cancelled"


class SessionBucket(str, enum.Enum):
    UPCOMING = "upcoming"
    REQUESTS = "requests"
    PAST     = "past"


class Session(db.Model):
    __tablename__ = "sessions"

    id = db.Column(db.Integer, primary_key=True)
    host_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    guest_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    court_id = db.Column(db.Integer, db.ForeignKey("courts.id"))
    sport = db.Column(db.String(20), nullable=False)
    scheduled_at = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), nullable=False, default=SessionStatus.REQUESTED.value)
    note = db.Column(db.Text)

    # Filled in only after status == completed
    result = db.Column(db.String(2))      # "W" or "L" from host perspective
    score = db.Column(db.String(80))      # "11-7, 11-9"

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    host = db.relationship("User", foreign_keys=[host_id])
    guest = db.relationship("User", foreign_keys=[guest_id])
    court = db.relationship("Court")

    # An open invite is stored as PENDING; the host (whoever proposed the
    # current time) is "awaiting", the guest is the one who must respond.
    _OPEN = (SessionStatus.PENDING.value, SessionStatus.REQUESTED.value)

    def bucket(self, viewer_id: int) -> str:
        """Bucket a session for a given viewer (host or guest)."""
        if self.status == SessionStatus.COMPLETED.value:
            return SessionBucket.PAST.value
        if self.status == SessionStatus.CANCELLED.value:
            return SessionBucket.PAST.value
        if self.status == SessionStatus.CONFIRMED.value:
            return SessionBucket.UPCOMING.value
        # open invite: the responder (guest) sees it as an incoming request
        if self.status in self._OPEN and viewer_id == self.guest_id:
            return SessionBucket.REQUESTS.value
        return SessionBucket.UPCOMING.value  # the proposer's outbound invite

    def display_status(self, viewer_id: int) -> str:
        """Viewer-relative status: an open invite reads as 'requested' to the
        responder (guest) and 'pending' to the proposer (host)."""
        if self.status in self._OPEN:
            return "requested" if viewer_id == self.guest_id else "pending"
        return self.status

    def to_dict(self, viewer_id: int) -> dict:
        opp = self.guest if viewer_id == self.host_id else self.host
        return {
            "id": self.id,
            "bucket": self.bucket(viewer_id),
            "status": self.display_status(viewer_id),
            "opp": opp.name if opp else None,
            "oppHandle": opp.handle if opp else None,
            "sentByMe": self.host_id == viewer_id,
            "sport": self.sport,
            "court": self.court.name if self.court else None,
            "courtMiles": None,  # frontend-only enrichment for now
            "scheduledAt": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "month": self.scheduled_at.strftime("%b") if self.scheduled_at else None,
            "day": self.scheduled_at.strftime("%d") if self.scheduled_at else None,
            "weekday": self.scheduled_at.strftime("%a") if self.scheduled_at else None,
            "time": self.scheduled_at.strftime("%-I:%M %p") if self.scheduled_at else None,
            "note": self.note,
            "result": self.result,
            "score": self.score,
        }
