from extensions import db


class Court(db.Model):
    __tablename__ = "courts"

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(80), unique=True, nullable=False)
    name = db.Column(db.String(160), nullable=False)
    address = db.Column(db.String(255))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    primary_sport = db.Column(db.String(20))  # "tennis" | "pickleball"
    sports = db.Column(db.String(120))  # comma-separated: "Tennis,Pickleball"
    court_count = db.Column(db.Integer, default=1)
    surface = db.Column(db.String(120))
    lights = db.Column(db.Boolean, default=False)
    # Admin soft-close: an inactive court is hidden from the public list/pickers
    # but its row (and any historical sessions/appointments) is preserved.
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default="1")

    def to_dict(self) -> dict:
        return {
            "id": self.slug,
            "name": self.name,
            "addr": self.address,
            "primary": self.primary_sport,
            "sports": [s.strip() for s in (self.sports or "").split(",") if s.strip()],
            "courtCount": self.court_count,
            "surface": self.surface,
            "lights": self.lights,
            "lat": self.lat,
            "lng": self.lng,
        }

    def admin_dict(self) -> dict:
        """Full record for the admin Courts tab — keyed by numeric id so the slug
        itself is editable, and includes the active flag."""
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "address": self.address,
            "lat": self.lat,
            "lng": self.lng,
            "primarySport": self.primary_sport,
            "sports": [s.strip() for s in (self.sports or "").split(",") if s.strip()],
            "courtCount": self.court_count,
            "surface": self.surface,
            "lights": self.lights,
            "isActive": self.is_active,
        }
