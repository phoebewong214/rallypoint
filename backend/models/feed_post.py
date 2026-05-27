from datetime import datetime
import enum
from extensions import db


class FeedType(str, enum.Enum):
    MATCH_WIN   = "match-win"
    MATCH_LOSS  = "match-loss"
    JOIN        = "join"
    LFG         = "lfg"
    ACHIEVEMENT = "achievement"
    PHOTO       = "photo"


class FeedPost(db.Model):
    __tablename__ = "feed_posts"

    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    type = db.Column(db.String(20), nullable=False)
    text = db.Column(db.Text, nullable=False)

    # Optional linked entities
    match_id = db.Column(db.Integer, db.ForeignKey("sessions.id"))

    likes = db.Column(db.Integer, default=0)
    comments = db.Column(db.Integer, default=0)
    shares = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    author = db.relationship("User")
    match = db.relationship("Session")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "user": {
                "name": self.author.name,
                "handle": self.author.handle,
                "initials": self.author.initials,
            },
            "text": self.text,
            "likes": self.likes,
            "comments": self.comments,
            "shares": self.shares,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
