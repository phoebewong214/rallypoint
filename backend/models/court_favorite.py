from extensions import db


class CourtFavorite(db.Model):
    """A user's bookmarked court. (user_id, court_id) is unique so favoriting
    twice is a no-op."""

    __tablename__ = "court_favorites"
    __table_args__ = (
        db.UniqueConstraint("user_id", "court_id", name="uq_user_court_fav"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    court_id = db.Column(db.Integer, db.ForeignKey("courts.id"), nullable=False, index=True)
