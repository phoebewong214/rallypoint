"""
Match scoring + reason chips for Find Partner.

A transparent, explainable heuristic — NOT a black box. Each signal contributes
points AND a human-readable "reason chip", so the score spreads across the range
and the UI can show *why* two players match (skill, distance, schedule, court).

Score (0-100), summed from real data:
  skill closeness   0-45  continuous in |rating diff| (the dominant signal)
  proximity         0-25  continuous in great-circle miles (0 mi → 25, 8 mi → 0)
  schedule overlap  0-20  shared available cells in the weekly preferred-times grid
  shared home court 0-15  same home court for this sport
  same primary sport  +5
Tier: great >= 70, good >= 45, else worth-a-try.

`llm_reason` is an OPTIONAL upgrade (OpenAI) for the *reason text only*, used by
/api/ai/match-reason when OPENAI_API_KEY is set — it never affects the score.
"""
from __future__ import annotations
import math
import os
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from models import User  # pragma: no cover


# Earth's mean radius in miles. Used by Haversine.
EARTH_RADIUS_MI = 3958.7613


def haversine_miles(
    lat1: Optional[float], lng1: Optional[float],
    lat2: Optional[float], lng2: Optional[float],
) -> Optional[float]:
    """Great-circle distance between two lat/lng points in miles.

    Returns None if any coordinate is missing — callers should treat that as
    "distance unknown" rather than 0.
    """
    if None in (lat1, lng1, lat2, lng2):
        return None
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_MI * c


def rating_label(sport: str | None) -> str:
    """Tennis uses NTRP; pickleball uses DUPR."""
    return "NTRP" if (sport or "").lower().startswith("tennis") else "DUPR"


# ---- individual signals: each returns (points, reason_chip_or_None) ----------

def _skill_points(a: str | None, b: str | None, label: str) -> tuple[int, Optional[str]]:
    try:
        diff = abs(float(a) - float(b))
    except (TypeError, ValueError):
        return 0, None
    # Linear decay: 0.0 diff → 45, 1.5+ diff → 0. Skill is the dominant signal.
    pts = round(45 * max(0.0, 1 - diff / 1.5))
    if diff == 0:
        return pts, f"Same level ({label} {b})"
    if diff <= 0.5:
        return pts, "Within half a level"
    if diff <= 1.0:
        return pts, "Close on skill"
    return pts, None  # >1 level apart: no positive chip


def _proximity_points(dist: Optional[float], viewer: "User", cand: "User") -> tuple[int, Optional[str]]:
    if dist is not None:
        pts = round(25 * max(0.0, 1 - dist / 8.0))  # 0 mi → 25, 8 mi → 0
        return pts, (f"{dist:.1f} mi away" if dist <= 5 else None)
    # No coordinates → fall back to same neighborhood/location string.
    if viewer.location and cand.location and viewer.location == cand.location:
        return 12, f"Both in {cand.location.split(',')[0]}"
    return 0, None


def _schedule_points(viewer: "User", cand: "User") -> tuple[int, Optional[str]]:
    """Overlap of the weekly preferred-times grid (status >= 1 = maybe/available).
    Uses the real AvailabilitySlot grid, not free-text keyword matching."""
    v = {(s.day_of_week, s.time_band) for s in viewer.availability if s.status >= 1}
    c = {(s.day_of_week, s.time_band) for s in cand.availability if s.status >= 1}
    n = len(v & c)
    if n == 0:
        return 0, None
    return min(20, n * 4), f"{n} shared time slot{'s' if n != 1 else ''}"


def _court_points(vp, cp) -> tuple[int, Optional[str]]:
    if vp and cp and vp.home_court_id and vp.home_court_id == cp.home_court_id:
        name = vp.home_court.name if vp.home_court else None
        return 15, f"Shares your home court{f' ({name})' if name else ''}"
    return 0, None


def score_and_reason(viewer: "User", cand: "User", sport: str) -> dict:
    """Return {score, tier, reasons, summary, distance} for a viewer ↔ candidate
    match. `reasons` are the chips the UI shows; `summary` is a one-line fallback;
    `distance` (miles, or None) lets callers avoid recomputing Haversine."""
    vp = viewer.profile_for(sport)
    cp = cand.profile_for(sport)
    if not cp:
        return {"score": 0, "tier": "fair", "reasons": [],
                "summary": f"No {sport} profile yet.", "distance": None}

    label = rating_label(sport)
    distance = haversine_miles(viewer.lat, viewer.lng, cand.lat, cand.lng)

    signals = [
        _skill_points(vp.ntrp if vp else None, cp.ntrp, label),
        _proximity_points(distance, viewer, cand),
        _schedule_points(viewer, cand),
        _court_points(vp, cp),
    ]
    score = sum(pts for pts, _ in signals)
    if viewer.primary_sport and viewer.primary_sport == cand.primary_sport:
        score += 5
    score = max(0, min(100, score))

    reasons = [chip for _, chip in signals if chip]
    tier = "great" if score >= 70 else "good" if score >= 45 else "fair"

    if reasons:
        summary = "; ".join(reasons)
    else:
        first = (cand.name or "").split()[0] if cand.name else "This player"
        summary = f"{first} plays {sport} at {label} {cp.ntrp} — give it a try."

    return {"score": score, "tier": tier, "reasons": reasons, "summary": summary, "distance": distance}


def llm_reason(viewer: "User", cand: "User", sport: str, score: int) -> str:
    """Optional OpenAI path — reason TEXT only, never the score. Called only when
    OPENAI_API_KEY is configured (via /api/ai/match-reason)."""
    from openai import OpenAI  # local import — only loaded when used

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    vp = viewer.profile_for(sport)
    cp = cand.profile_for(sport)

    label = rating_label(sport)
    prompt = f"""You are a sports-app matchmaker. In ONE sentence (max 22 words),
explain why {cand.name} is a good {sport} partner for {viewer.name}, grounded only
in the facts below. Be specific and warm but never invented.

Facts:
- Viewer {label}: {vp.ntrp if vp else 'unknown'}, Candidate {label}: {cp.ntrp}
- Viewer location: {viewer.location or 'unknown'}, Candidate location: {cand.location or 'unknown'}
- Candidate availability: {cp.availability_summary or 'unknown'}
- Heuristic compatibility score: {score}/100"""

    rsp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=80,
        temperature=0.7,
    )
    return rsp.choices[0].message.content.strip()
