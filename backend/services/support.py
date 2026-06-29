"""
Customer-support assistant.

`answer_support` is the OPTIONAL OpenAI path: it answers a user's question about
using RallyPoint, grounded in a fixed knowledge prompt. Returns None when no
OPENAI_API_KEY is configured so the route can gracefully degrade to the
"leave a message → email the admin" flow (mirrors the heuristic-fallback pattern
in services.matching).
"""
from __future__ import annotations
import os
from typing import Optional

MODEL = "gpt-4o-mini"
MAX_HISTORY = 12  # cap turns sent to the model to bound cost/latency

SYSTEM_PROMPT = """You are the friendly customer-support assistant for RallyPoint,
a web app that helps people in Chicago find tennis and pickleball partners on
public courts. You help users use the app. Be concise, warm, and practical.

What RallyPoint does, so you can guide users:
- Find Partners: an AI-ranked list of nearby players matched on skill (NTRP/DUPR
  rating), schedule, and court proximity. Filters: sport, skill range, preferred
  times, home court.
- Requesting a game: send a request to a player and pick a court + propose times;
  they accept/counter; once a time is agreed it shows under "My Games".
- Courts: browse Chicago public courts, see details, favorite them, check in.
- Profile: edit name, bio, location/neighborhood, primary sport, rating, home
  court, and a weekly availability grid. Email verification is required to use
  the app.

Rules:
- Only answer from what you know about RallyPoint; never invent features,
  prices, or policies.
- You CANNOT change a user's account, reset passwords, verify emails, delete
  data, or take any action — you can only give guidance. For anything that needs
  an account change or a human, tell the user to tap "Talk to a human" to send
  the support team an email.
- Keep replies short (1-4 sentences). No markdown headers."""


def answer_support(message: str, history: Optional[list[dict]], user=None) -> Optional[str]:
    """Return an assistant reply, or None if AI isn't configured.

    Raises on an OpenAI error so the caller can fall back. `history` is a list of
    {"role": "user"|"assistant", "content": str}."""
    if not os.environ.get("OPENAI_API_KEY"):
        return None

    from openai import OpenAI  # local import — only loaded when used

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if user is not None:
        messages.append({
            "role": "system",
            "content": f"The signed-in user is {user.name} (handle {user.handle}).",
        })
    for turn in (history or [])[-MAX_HISTORY:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:2000]})
    messages.append({"role": "user", "content": message})

    rsp = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=300,
        temperature=0.4,
    )
    return rsp.choices[0].message.content.strip()
