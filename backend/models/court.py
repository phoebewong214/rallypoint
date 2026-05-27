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
