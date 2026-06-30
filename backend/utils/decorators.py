"""
@require_auth — validate Bearer JWT, load User from DB, expose via flask.g.
Usage:
    @bp.get("/foo")
    @require_auth
    def foo():
        user = g.current_user  # User instance
        ...
"""
from functools import wraps
from flask import request, jsonify, g, current_app

from models import User
from services.auth import decode_token, extract_bearer, TokenError

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        cfg = current_app.config
        # API/test clients send an explicit Bearer header (not auto-sent by the
        # browser, so immune to CSRF). The browser flow uses the httpOnly cookie.
        token = extract_bearer(request.headers.get("Authorization"))
        via_cookie = False
        if not token:
            token = request.cookies.get(cfg["AUTH_COOKIE_NAME"])
            via_cookie = token is not None
        if not token:
            return jsonify({"error": "authentication required"}), 401

        # CSRF: only cookie-authenticated unsafe requests are at risk (Bearer
        # tokens aren't auto-sent by the browser). Double-submit check.
        if via_cookie and request.method not in SAFE_METHODS:
            header_csrf = request.headers.get("X-CSRF-Token")
            cookie_csrf = request.cookies.get(cfg["CSRF_COOKIE_NAME"])
            if not header_csrf or not cookie_csrf or header_csrf != cookie_csrf:
                return jsonify({"error": "CSRF check failed"}), 403

        try:
            claims = decode_token(token)
        except TokenError as e:
            return jsonify({"error": str(e)}), 401
        user = User.query.get(claims.user_id)
        if not user:
            return jsonify({"error": "user no longer exists"}), 401
        # Reject tokens issued before the user's tokens were last revoked
        # (logout-all / password change / pre-versioning tokens).
        if claims.token_version != user.token_version:
            return jsonify({"error": "session expired, please sign in again"}), 401
        # Suspended accounts are locked out of every authenticated endpoint.
        if not user.is_active:
            return jsonify({"error": "This account has been suspended."}), 403
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def require_admin(fn):
    """Like @require_auth, but additionally requires the user to be an admin.

    Layers on top of require_auth so it inherits the same token/CSRF/version
    checks, then rejects non-admins with 403. Admin status is set out-of-band
    (DB / `manage.py set-admin`) and is never grantable through the API.
    """
    @wraps(fn)
    def inner(*args, **kwargs):
        if not getattr(g.current_user, "is_admin", False):
            return jsonify({"error": "admin access required"}), 403
        return fn(*args, **kwargs)

    return require_auth(inner)


def current_user():
    """Convenience accessor for use inside @require_auth-protected handlers."""
    return g.current_user
