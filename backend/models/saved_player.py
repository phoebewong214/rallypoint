from extensions import db


class SavedPlayer(db.Model):
    """A user's bookmarked player. (user_id, player_id) is unique."""

    __tablename__ = "saved_players"
    __table_args__ = (
        db.UniqueConstraint("user_id", "player_id", name="uq_user_saved_player"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    player_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
