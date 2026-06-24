"""
Two-phase game invites + time negotiation.

The flow the owner wants: A invites B (optionally proposing a specific time OR a
time window). B first CONFIRMS THE OPPONENT (agrees to play with A); only THEN do
they settle the exact time by proposing/countering. When a time is finally
locked, a real `sessions` row is materialized (so the calendar / stats / Profile
week-grid keep working unchanged) and the invite points at it via session_id.

These are NEW tables, so create_all creates them on deploy WITHOUT altering the
existing `sessions` table (which can't be migrated in place — no Alembic).
"""
from datetime import datetime
from extensions import db

# Phases of an invite's life.
PHASE_AWAITING = "awaiting_opponent"   # B hasn't agreed to play A yet
PHASE_SETTLING = "settling_time"       # opponent confirmed; negotiating the time
PHASE_CONFIRMED = "confirmed"          # time locked; a sessions row was materialized
PHASE_DECLINED = "declined"            # B declined the opponent
PHASE_CANCELLED = "cancelled"          # either party called it off
OPEN_PHASES = (PHASE_AWAITING, PHASE_SETTLING)
DEAD_PHASES = (PHASE_DECLINED, PHASE_CANCELLED)


class GameInvite(db.Model):
    __tablename__ = "game_invites"

    id = db.Column(db.Integer, primary_key=True)
    # inviter/invitee are STABLE for the life of the invite (unlike the old
    # session reschedule which swapped host/guest), so "whose turn" stays legible.
    inviter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    invitee_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    sport = db.Column(db.String(20), nullable=False)
    court_id = db.Column(db.Integer, db.ForeignKey("courts.id"))
    phase = db.Column(db.String(24), nullable=False, default=PHASE_AWAITING, index=True)
    note = db.Column(db.Text)
    decline_reason = db.Column(db.String(200))
    # set when the invite is confirmed and a real game is materialized
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inviter = db.relationship("User", foreign_keys=[inviter_id])
    invitee = db.relationship("User", foreign_keys=[invitee_id])
    court = db.relationship("Court")
    session = db.relationship("Session", foreign_keys=[session_id])
    proposals = db.relationship(
        "TimeProposal", back_populates="invite",
        cascade="all, delete-orphan", order_by="TimeProposal.created_at",
    )

    def latest_open_proposal(self):
        """The most recent still-open time proposal (what's on the table now)."""
        opens = [p for p in self.proposals if p.status == "open"]
        return max(opens, key=lambda p: p.id) if opens else None

    def whose_turn(self):
        """user_id who must act next (or None). Awaiting → invitee confirms the
        opponent. Settling → whoever did NOT author the latest open proposal."""
        if self.phase == PHASE_AWAITING:
            return self.invitee_id
        if self.phase == PHASE_SETTLING:
            latest = self.latest_open_proposal()
            if latest is None:
                return self.invitee_id  # nothing on the table → responder acts
            return self.inviter_id if latest.proposed_by_id == self.invitee_id else self.invitee_id
        return None

    def _bucket_status(self, your_turn: bool):
        if self.phase in DEAD_PHASES:
            return "past", self.phase
        if self.phase == PHASE_CONFIRMED:
            return "upcoming", "confirmed"
        # open invite: the actor whose turn it is needs to respond
        return ("requests", "requested") if your_turn else ("upcoming", "pending")

    def to_dict(self, viewer_id: int) -> dict:
        """Viewer-relative, session-compatible shape so My Games can render
        invites and legacy sessions in one feed (kind='invite' distinguishes)."""
        opp = self.invitee if viewer_id == self.inviter_id else self.inviter
        opp_profile = opp.profile_for(self.sport) if opp else None
        your_turn = (self.whose_turn() == viewer_id)
        bucket, status = self._bucket_status(your_turn)
        latest = self.latest_open_proposal()
        sched = latest.start_at if latest else None
        return {
            "kind": "invite",
            "id": self.id,
            "bucket": bucket,
            "status": status,
            "phase": self.phase,
            "yourTurn": your_turn,
            "opp": opp.name if opp else None,
            "oppId": opp.id if opp else None,
            "oppHandle": opp.handle if opp else None,
            "oppNtrp": opp_profile.ntrp if opp_profile else None,
            "sentByMe": self.inviter_id == viewer_id,
            "sport": self.sport,
            "court": self.court.name if self.court else None,
            "courtMiles": None,
            # the proposed time on the table (window start when it's a window)
            "scheduledAt": sched.isoformat() if sched else None,
            "proposalEnd": latest.end_at.isoformat() if latest and latest.end_at else None,
            "isWindow": bool(latest and latest.end_at),
            "month": sched.strftime("%b") if sched else None,
            "day": sched.strftime("%d") if sched else None,
            "weekday": sched.strftime("%a") if sched else None,
            "time": sched.strftime("%-I:%M %p") if sched else None,
            "note": self.note,
            "declineReason": self.decline_reason,
        }


class TimeProposal(db.Model):
    __tablename__ = "time_proposals"

    id = db.Column(db.Integer, primary_key=True)
    invite_id = db.Column(db.Integer, db.ForeignKey("game_invites.id"), nullable=False, index=True)
    proposed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    start_at = db.Column(db.DateTime, nullable=False)
    # end_at NULL = a specific time; set = an offered window [start, end]
    end_at = db.Column(db.DateTime)
    status = db.Column(db.String(16), nullable=False, default="open")  # open | accepted | superseded
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    invite = db.relationship("GameInvite", back_populates="proposals")
    proposed_by = db.relationship("User", foreign_keys=[proposed_by_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "proposedById": self.proposed_by_id,
            "startAt": self.start_at.isoformat() if self.start_at else None,
            "endAt": self.end_at.isoformat() if self.end_at else None,
            "isWindow": self.end_at is not None,
            "status": self.status,
        }
