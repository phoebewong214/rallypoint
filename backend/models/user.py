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
    # Bumped to invalidate every outstanding JWT for this user (logout-all,
    # password change, suspected compromise). Tokens embed the value they were
    # issued against; require_auth rejects any token whose `tv` no longer matches.
    token_version = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    email_verified = db.Column(db.Boolean, nullable=False, default=False, server_default="0")
    # Grants access to the /admin dashboard + /api/admin/* endpoints. Set manually
    # in the DB (or via `python manage.py set-admin <email>`); never self-serviceable
    # through the API.
    is_admin = db.Column(db.Boolean, nullable=False, default=False, server_default="0")
    # Trust & safety: a suspended (is_active=False) account is locked out of every
    # authenticated endpoint by require_auth and is hidden from partner matching.
    # Toggled by admins only (support desk / report review); never self-serviceable.
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default="1")
    name = db.Column(db.String(120), nullable=False)
    handle = db.Column(db.String(80), unique=True, nullable=False)
    location = db.Column(db.String(120))
    lat = db.Column(db.Float)   # latitude for distance calculations
    lng = db.Column(db.Float)   # longitude for distance calculations
    bio = db.Column(db.Text)
    # JSON-encoded semantic vector of `bio` (OpenAI embedding); null when no bio
    # or no OPENAI_API_KEY. Drives the "similar playing style" match signal.
    bio_embedding = db.Column(db.Text)
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

    def revoke_tokens(self) -> None:
        """Invalidate every JWT previously issued to this user."""
        self.token_version = (self.token_version or 1) + 1

    def suspend(self) -> None:
        """Lock the account: block every authenticated request and force a logout
        of any live session by revoking outstanding tokens."""
        self.is_active = False
        self.revoke_tokens()

    def reactivate(self) -> None:
        """Lift a suspension. Tokens stay revoked, so the user must sign in again."""
        self.is_active = True

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
            "lat": self.lat,
            "lng": self.lng,
            "bio": self.bio,
            "primarySport": self.primary_sport,
            "avatarColor": self.avatar_color,
            "avatarFg": self.avatar_fg,
            "joined": self.created_at.strftime("%b %Y") if self.created_at else None,
            "sportProfiles": [p.to_dict() for p in self.sport_profiles],
            "availability": [s.to_dict() for s in self.availability],
        }
        if with_email:
            out["email"] = self.email
            out["emailVerified"] = self.email_verified
            out["isAdmin"] = self.is_admin
            out["isActive"] = self.is_active
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
            "homeCourt": self.home_court.slug if self.home_court else None,
            "homeCourtName": self.home_court.name if self.home_court else None,
        }
