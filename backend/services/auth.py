"""
JWT issue + verify. Token payload:
    { "sub": user_id, "exp": <unix ts>, "iat": <unix ts> }

Tokens are signed with SECRET_KEY (HS256). We issue 7-day tokens for
the MVP — wire a /api/auth/refresh endpoint when you need shorter expiries.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from flask import current_app

ALGORITHM = "HS256"
DEFAULT_TTL_DAYS = 7


def issue_token(user_id: int, ttl_days: int = DEFAULT_TTL_DAYS) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=ttl_days)).timestamp()),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm=ALGORITHM)


class TokenError(Exception):
    pass


def decode_token(token: str) -> int:
    """Returns user_id on success, raises TokenError on any failure."""
    try:
        payload = jwt.decode(
            token, current_app.config["SECRET_KEY"], algorithms=[ALGORITHM]
        )
    except jwt.ExpiredSignatureError as e:
        raise TokenError("token expired") from e
    except jwt.InvalidTokenError as e:
        raise TokenError("invalid token") from e

    sub = payload.get("sub")
    if not sub:
        raise TokenError("token missing subject")
    try:
        return int(sub)
    except (TypeError, ValueError) as e:
        raise TokenError("subject not an int") from e


def extract_bearer(header_value: Optional[str]) -> Optional[str]:
    """Pull the token out of 'Bearer xxx' — case-insensitive."""
    if not header_value:
        return None
    parts = header_value.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None
