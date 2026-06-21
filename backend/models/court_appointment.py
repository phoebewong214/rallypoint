"""
Open games ("appointments") at a court + their participants/waitlist.

RallyPoint can't reserve a physical public court, so an "appointment" is a
RallyPoint-native open game: a user says "I'll play at this court at this time",
others join. When it's full, further joiners go on the waitlist (the queue); a
freed spot promotes the next person in line.
"""
from datetime import datetime
from extensions import db


class CourtAppointment(db.Model):
    __tablename__ = "court_appointments"

    id = db.Column(db.Integer, primary_key=True)
    court_id = db.Column(db.Integer, db.ForeignKey("courts.id"), nullable=False, index=True)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    sport = db.Column(db.String(20), nullable=False)
    scheduled_at = db.Column(db.DateTime, nullable=False, index=True)
    max_players = db.Column(db.Integer, nullable=False, default=4)
    note = db.Column(db.Text)
    status = db.Column(db.String(20), nullable=False, default="open")  # open | cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    court = db.relationship("Court")
    creator = db.relationship("User", foreign_keys=[creator_id])
    participants = db.relationship(
        "AppointmentParticipant", back_populates="appointment",
        cascade="all, delete-orphan", order_by="AppointmentParticipant.created_at",
    )

    def ordered(self):
        """Participants split into confirmed (in order) and waitlist (in order)."""
        confirmed = [p for p in self.participants if not p.waitlisted]
        waitlist = [p for p in self.participants if p.waitlisted]
        return confirmed, waitlist

    def to_dict(self, viewer_id: int | None = None) -> dict:
        confirmed, waitlist = self.ordered()
        mine = next((p for p in self.participants if p.user_id == viewer_id), None)
        queue_pos = None
        if mine and mine.waitlisted:
            queue_pos = waitlist.index(mine) + 1
        return {
            "id": self.id,
            "courtSlug": self.court.slug if self.court else None,
            "courtName": self.court.name if self.court else None,
            "sport": self.sport,
            "scheduledAt": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "maxPlayers": self.max_players,
            "note": self.note,
            "status": self.status,
            "host": self.creator.name if self.creator else None,
            "isHost": self.creator_id == viewer_id,
            "confirmedCount": len(confirmed),
            "waitlistCount": len(waitlist),
            "spotsLeft": max(0, self.max_players - len(confirmed)),
            "players": [
                {"initials": p.user.initials, "color": p.user.avatar_color, "name": p.user.name}
                for p in confirmed if p.user
            ],
            # viewer-specific
            "joined": bool(mine) and not mine.waitlisted,
            "waitlisted": bool(mine) and mine.waitlisted,
            "queuePosition": queue_pos,
        }


class AppointmentParticipant(db.Model):
    __tablename__ = "appointment_participants"
    __table_args__ = (
        db.UniqueConstraint("appointment_id", "user_id", name="uq_appt_user"),
    )

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey("court_appointments.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    waitlisted = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    appointment = db.relationship("CourtAppointment", back_populates="participants")
    user = db.relationship("User")
