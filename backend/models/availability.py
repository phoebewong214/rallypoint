"""
A user's recurring weekly availability — used both for the Profile heatmap
and for AI matching (overlap between two users' availability) — plus
date-specific overrides layered on top of it.
"""
from extensions import db


class AvailabilitySlot(db.Model):
    __tablename__ = "availability_slots"
    __table_args__ = (
        db.UniqueConstraint("user_id", "day_of_week", "time_band", name="uq_user_dow_band"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    day_of_week = db.Column(db.Integer, nullable=False)   # 0=Mon ... 6=Sun
    time_band = db.Column(db.String(10), nullable=False)  # "MORN" | "AFT" | "EVE"
    status = db.Column(db.Integer, nullable=False, default=0)  # 0=unavail, 1=maybe, 2=available

    user = db.relationship("User", back_populates="availability")

    def to_dict(self) -> dict:
        return {"dayOfWeek": self.day_of_week, "timeBand": self.time_band, "status": self.status}


class AvailabilityOverride(db.Model):
    """A date-specific exception to the weekly grid ("busy THIS Saturday",
    "free on July 30 for once"). Effective availability for a concrete date =
    the override when one exists, else the weekly slot for that weekday.
    Plain Date on purpose — the datetime pipeline is naive-UTC and would shift
    evening slots across date boundaries. Rows expire naturally as dates pass.
    New table, so create_all adds it on deploy without touching existing ones."""

    __tablename__ = "availability_overrides"
    __table_args__ = (
        db.UniqueConstraint("user_id", "date", "time_band", name="uq_user_date_band"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False)
    time_band = db.Column(db.String(10), nullable=False)  # "MORN" | "AFT" | "EVE"
    status = db.Column(db.Integer, nullable=False, default=0)  # 0=unavail, 1=maybe, 2=available

    user = db.relationship("User", back_populates="availability_overrides")

    def to_dict(self) -> dict:
        return {"date": self.date.isoformat(), "timeBand": self.time_band, "status": self.status}
