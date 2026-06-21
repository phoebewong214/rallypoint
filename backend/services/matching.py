"""
Heuristic match scoring + reason generator.

Score breakdown (0-100):
  60  base
  +/- up to 25  rating closeness (NTRP for tennis, DUPR for pickleball —
                0.0 diff = +25, <=0.5 = +18, <=1.0 = +5, >1.0 = -10)
  +10 same primary sport
  +10 same city/area (string match) OR within 2 mi (Haversine)
  +5  availability overlap (rough — based on availability_summary keyword match)

The LLM path takes the same inputs and produces a fluent one-sentence reason
rooted in those signals so we can A/B test heuristic vs LLM quality.
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
    # Convert to radians
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    # Haversine formula
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_MI * c


def rating_label(sport: str | None) -> str:
    """Tennis uses NTRP; pickleball uses DUPR."""
    return "NTRP" if (sport or "").lower().startswith("tennis") else "DUPR"


def _ntrp_score(a: str | None, b: str | None) -> int:
    try:
        diff = abs(float(a) - float(b))
    except (TypeError, ValueError):
        return 0
    # 0.0 diff => +25, 0.5 => +18, 1.0 => -10, anything beyond => -20
    if diff == 0:
        return 25
    if diff <= 0.5:
        return 18
    if diff <= 1.0:
        return 5
    return -10


def _availability_overlap(a: str | None, b: str | None) -> int:
    if not a or not b:
        return 0
    a_words = {w.strip().lower() for w in a.replace(",", " ").split() if w.strip()}
    b_words = {w.strip().lower() for w in b.replace(",", " ").split() if w.strip()}
    return 5 if a_words & b_words else 0


def score_and_reason(viewer: "User", cand: "User", sport: str) -> tuple[int, str, Optional[float]]:
    """Compute (score, reason, distance_miles) for a viewer ↔ candidate match.

    Returns the Haversine distance (or None if coordinates missing) so
    callers can include it in the API response without re-computing.
    """
    vp = viewer.profile_for(sport)
    cp = cand.profile_for(sport)
    if not cp:
        return 0, f"No {sport} profile yet.", None

    distance = haversine_miles(viewer.lat, viewer.lng, cand.lat, cand.lng)

    score = 60
    score += _ntrp_score(vp.ntrp if vp else None, cp.ntrp)
    if viewer.primary_sport and viewer.primary_sport == cand.primary_sport:
        score += 10
    # Proximity bonus: within 2 mi great-circle is "same neighborhood".
    if distance is not None and distance <= 2.0:
        score += 10
    elif viewer.location and cand.location and viewer.location == cand.location:
        # Fallback when coordinates missing — string equality on location
        score += 10
    score += _availability_overlap(
        vp.availability_summary if vp else None, cp.availability_summary
    )
    score = max(0, min(100, score))

    label = rating_label(sport)
    bits = []
    if vp and vp.ntrp == cp.ntrp:
        bits.append(f"identical {label} {cp.ntrp}")
    elif vp:
        bits.append(f"close {label} ({vp.ntrp} vs {cp.ntrp})")
    if distance is not None and distance <= 2.0:
        bits.append(f"only {distance:.1f} mi away")
    elif viewer.location and viewer.location == cand.location:
        bits.append(f"both in {cand.location.split(',')[0]}")
    if cp.availability_summary:
        bits.append(f"plays {cp.availability_summary.lower()}")

    parts = (cand.name or "").split()
    first_name = parts[0] if parts else "This player"
    if not bits:
        reason = f"{first_name} plays {sport} at {label} {cp.ntrp} — give it a try."
    else:
        reason = f"{first_name} fits because: {', '.join(bits)}."
    return score, reason, distance


def llm_reason(viewer: "User", cand: "User", sport: str, score: int) -> str:
    """Optional OpenAI path. Called only when OPENAI_API_KEY is configured."""
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
