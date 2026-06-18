"""
User + per-sport profile (one user can have multiple SportProfile rows,
one per sport they play).
"""
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    handle = db.Column(db.String(80), unique=True, nullable=False)
    location = db.Column(db.String(120))
    bio = db.Column(db.Text)
    primary_sport = db.Column(db.String(20))  # "Tennis" | "Pickleball"
    avatar_color = db.Column(db.String(120))  # CSS gradient string
    avatar_fg = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sport_profiles = db.relationship(
        "SportProfile", back_populates="user", cascade="all, delete-orphan"
    )
    availability = db.relationship(
        "AvailabilitySlot", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    @property
    def initials(self) -> str:
        parts = [p[0] for p in (self.name or "?").split() if p]
        return ("".join(parts[:2]) or "?").upper()

    def profile_for(self, sport: str):
        return next(
            (p for p in self.sport_profiles if p.sport.lower() == sport.lower()),
            None,
        )

    def to_dict(self, with_email: bool = False) -> dict:
        out = {
            "id": self.id,
            "name": self.name,
            "initials": self.initials,
            "handle": self.handle,
            "location": self.location,
            "bio": self.bio,
            "primarySport": self.primary_sport,
            "avatarColor": self.avatar_color,
            "avatarFg": self.avatar_fg,
            "joined": self.created_at.strftime("%b %Y") if self.created_at else None,
            "sportProfiles": [p.to_dict() for p in self.sport_profiles],
        }
        if with_email:
            out["email"] = self.email
        return out


class SportProfile(db.Model):
    """One user's profile for a specific sport (NTRP, availability summary, etc.)."""

    __tablename__ = "sport_profiles"
    __table_args__ = (db.UniqueConstraint("user_id", "sport", name="uq_user_sport"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    sport = db.Column(db.String(20), nullable=False)  # "Tennis" | "Pickleball"
    ntrp = db.Column(db.String(4), nullable=False)  # "3.5"
    availability_summary = db.Column(db.String(200))  # "Weekends, mornings"
    home_court_id = db.Column(db.Integer, db.ForeignKey("courts.id"))

    user = db.relationship("User", back_populates="sport_profiles")
    home_court = db.relationship("Court")

    def to_dict(self) -> dict:
        return {
            "sport": self.sport,
            "ntrp": self.ntrp,
            "availability": self.availability_summary,
            "homeCourtId": self.home_court_id,
        }
