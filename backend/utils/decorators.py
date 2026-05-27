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
from flask import request, jsonify, g

from models import User
from services.auth import decode_token, extract_bearer, TokenError


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = extract_bearer(request.headers.get("Authorization"))
        if not token:
            return jsonify({"error": "missing Authorization: Bearer header"}), 401
        try:
            user_id = decode_token(token)
        except TokenError as e:
            return jsonify({"error": str(e)}), 401
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "user no longer exists"}), 401
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def current_user():
    """Convenience accessor for use inside @require_auth-protected handlers."""
    return g.current_user
