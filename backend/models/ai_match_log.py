"""
Persists every AI match suggestion so we can:
  1. Show stable "AI Match Reason" without recomputing on every page load
  2. Build training data later (was this match accepted? declined?)
  3. Audit / debug the matching algorithm
"""
from datetime import datetime
from extensions import db


class AIMatchLog(db.Model):
    __tablename__ = "ai_match_logs"
    __table_args__ = (
        db.UniqueConstraint("viewer_id", "candidate_id", "sport", name="uq_match_log"),
    )

    id = db.Column(db.Integer, primary_key=True)
    viewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    sport = db.Column(db.String(20), nullable=False)

    score = db.Column(db.Integer, nullable=False)  # 0-100
    reason = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(20), nullable=False, default="heuristic")  # "heuristic" | "openai"

    outcome = db.Column(db.String(20))  # "accepted" | "declined" | "ignored" — filled later
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
