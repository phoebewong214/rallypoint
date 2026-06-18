"""
Heuristic match scoring + reason generator.

Score breakdown (0-100):
  60  base
  +/- up to 25  NTRP closeness (0.0 diff = +25, 1.0 diff = -10)
  +10 same primary sport
  +10 same city/area
  +5  availability overlap (rough — based on availability_summary keyword match)

The LLM path takes the same inputs and produces a fluent one-sentence reason
rooted in those signals so we can A/B test heuristic vs LLM quality.
"""
from __future__ import annotations
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import User  # pragma: no cover


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


def score_and_reason(viewer: "User", cand: "User", sport: str) -> tuple[int, str]:
    vp = viewer.profile_for(sport)
    cp = cand.profile_for(sport)
    if not cp:
        return 0, f"No {sport} profile yet."

    score = 60
    score += _ntrp_score(vp.ntrp if vp else None, cp.ntrp)
    if viewer.primary_sport and viewer.primary_sport == cand.primary_sport:
        score += 10
    if viewer.location and cand.location and viewer.location == cand.location:
        score += 10
    score += _availability_overlap(
        vp.availability_summary if vp else None, cp.availability_summary
    )
    score = max(0, min(100, score))

    bits = []
    if vp and vp.ntrp == cp.ntrp:
        bits.append(f"identical NTRP {cp.ntrp}")
    elif vp:
        bits.append(f"close NTRP ({vp.ntrp} vs {cp.ntrp})")
    if viewer.location and viewer.location == cand.location:
        bits.append(f"both in {cand.location.split(',')[0]}")
    if cp.availability_summary:
        bits.append(f"plays {cp.availability_summary.lower()}")

    if not bits:
        reason = f"{cand.name.split()[0]} plays {sport} at NTRP {cp.ntrp} — give it a try."
    else:
        reason = f"{cand.name.split()[0]} fits because: {', '.join(bits)}."
    return score, reason


def llm_reason(viewer: "User", cand: "User", sport: str, score: int) -> str:
    """Optional OpenAI path. Called only when OPENAI_API_KEY is configured."""
    from openai import OpenAI  # local import — only loaded when used

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    vp = viewer.profile_for(sport)
    cp = cand.profile_for(sport)

    prompt = f"""You are a sports-app matchmaker. In ONE sentence (max 22 words),
explain why {cand.name} is a good {sport} partner for {viewer.name}, grounded only
in the facts below. Be specific and warm but never invented.

Facts:
- Viewer NTRP: {vp.ntrp if vp else 'unknown'}, Candidate NTRP: {cp.ntrp}
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
