"""
Persists AI match suggestions at the moment a real decision happens, so we can:
  1. Show stable "AI Match Reason" without recomputing on every page load
  2. Build training data (was this match accepted? declined?) — the invite flow
     snapshots the score + per-signal breakdown when an invite is created and
     fills `outcome` when the invitee accepts/declines
  3. Audit / debug the matching algorithm across scoring versions

The served /api/players GET path deliberately writes nothing here (no write
amplification on the hot read path) — rows come from the invite flow and the
optional /api/ai/match-reason endpoint.
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
    candidate_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    sport = db.Column(db.String(20), nullable=False)

    score = db.Column(db.Integer, nullable=False)  # 0-100
    reason = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(20), nullable=False, default="heuristic")  # "heuristic" | "openai"

    # Per-signal breakdown as JSON, e.g. {"skill": 36, "proximity": 12, ...}.
    # Stored so future weight re-fits can regress outcomes on the raw signals,
    # not just the collapsed total.
    signals = db.Column(db.Text)
    # Which scoring formula produced `score`/`signals` (SCORE_VERSION in
    # services/matching.py). Old rows keep their version — never compare
    # scores across versions without checking this.
    score_version = db.Column(db.Integer, nullable=False, default=1, server_default="1")

    outcome = db.Column(db.String(20))  # "accepted" | "declined" — null = no decision yet
    outcome_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
