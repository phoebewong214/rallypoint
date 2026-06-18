"""
JWT issue + verify. Token payload:
    { "sub": user_id, "tv": token_version, "exp": <unix ts>, "iat": <unix ts> }

Tokens are signed with SECRET_KEY (HS256). We issue 7-day tokens for the MVP.
`tv` mirrors User.token_version at issue time; require_auth rejects any token
whose `tv` no longer matches the user's current version, giving us server-side
revocation (logout-all / password change) without a token blocklist. Wire a
/api/auth/refresh endpoint when you want to shorten the access-token TTL.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from flask import current_app

ALGORITHM = "HS256"
DEFAULT_TTL_DAYS = 7


@dataclass(frozen=True)
class TokenClaims:
    user_id: int
    token_version: int


def issue_token(user_id: int, token_version: int, ttl_days: int = DEFAULT_TTL_DAYS) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "tv": int(token_version),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=ttl_days)).timestamp()),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm=ALGORITHM)


class TokenError(Exception):
    pass


def decode_token(token: str) -> TokenClaims:
    """Returns the token's claims on success, raises TokenError on any failure."""
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
        user_id = int(sub)
    except (TypeError, ValueError) as e:
        raise TokenError("subject not an int") from e

    # Tokens minted before token versioning carry no `tv`; treat them as v0 so
    # they fail the version check and force a clean re-login.
    return TokenClaims(user_id=user_id, token_version=int(payload.get("tv", 0)))


@dataclass(frozen=True)
class ActionClaims:
    user_id: int
    # token_version embedded at issue time (single-use enforcement); None if
    # the token didn't carry one.
    token_version: Optional[int]


def issue_action_token(
    user_id: int, purpose: str, ttl_minutes: int, token_version: Optional[int] = None
) -> str:
    """Short-lived, purpose-scoped token for email verification / password reset."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "purpose": purpose,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
    }
    if token_version is not None:
        payload["tv"] = int(token_version)
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm=ALGORITHM)


def decode_action_token(token: str, expected_purpose: str) -> ActionClaims:
    """Validate a purpose-scoped token; raises TokenError on any mismatch."""
    try:
        payload = jwt.decode(
            token, current_app.config["SECRET_KEY"], algorithms=[ALGORITHM]
        )
    except jwt.ExpiredSignatureError as e:
        raise TokenError("link expired") from e
    except jwt.InvalidTokenError as e:
        raise TokenError("invalid link") from e

    if payload.get("purpose") != expected_purpose:
        raise TokenError("wrong token purpose")
    sub = payload.get("sub")
    if not sub:
        raise TokenError("token missing subject")
    try:
        user_id = int(sub)
    except (TypeError, ValueError) as e:
        raise TokenError("subject not an int") from e
    tv = payload.get("tv")
    return ActionClaims(user_id=user_id, token_version=int(tv) if tv is not None else None)


def extract_bearer(header_value: Optional[str]) -> Optional[str]:
    """Pull the token out of 'Bearer xxx' — case-insensitive."""
    if not header_value:
        return None
    parts = header_value.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None
