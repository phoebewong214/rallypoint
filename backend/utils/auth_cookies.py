"""
Set / clear the auth cookies on a Flask response.

Two cookies:
  - AUTH_COOKIE_NAME: the JWT, httpOnly (JS can't read it → XSS-safe storage).
  - CSRF_COOKIE_NAME: a random token, readable by JS. The SPA echoes it back in
    the X-CSRF-Token header on unsafe requests; require_auth verifies the two
    match (double-submit-cookie CSRF defense).
"""
from __future__ import annotations
import secrets

from flask import current_app, Response


def _common_kwargs() -> dict:
    cfg = current_app.config
    return {
        "secure": cfg["COOKIE_SECURE"],
        "samesite": cfg["COOKIE_SAMESITE"],
        "domain": cfg["COOKIE_DOMAIN"],
        "path": "/",
    }


def set_auth_cookies(resp: Response, jwt_token: str) -> Response:
    """Attach the httpOnly JWT cookie + a fresh CSRF cookie to the response."""
    cfg = current_app.config
    max_age = cfg["AUTH_COOKIE_MAX_AGE"]
    common = _common_kwargs()
    resp.set_cookie(cfg["AUTH_COOKIE_NAME"], jwt_token, max_age=max_age, httponly=True, **common)
    resp.set_cookie(
        cfg["CSRF_COOKIE_NAME"], secrets.token_urlsafe(32), max_age=max_age, httponly=False, **common
    )
    return resp


def clear_auth_cookies(resp: Response) -> Response:
    """Expire both auth cookies (server-side logout)."""
    cfg = current_app.config
    common = _common_kwargs()
    resp.delete_cookie(cfg["AUTH_COOKIE_NAME"], **common)
    resp.delete_cookie(cfg["CSRF_COOKIE_NAME"], **common)
    return resp
