"""
Auth endpoints — JWT-based.

POST /api/auth/signup  body: {email, password, name, sport?, ntrp?, location?}
POST /api/auth/login   body: {email, password}
GET  /api/auth/me      header: Authorization: Bearer <jwt>
"""
import re
from flask import Blueprint, jsonify, request, current_app
from flask_limiter.util import get_remote_address
from sqlalchemy.exc import IntegrityError

from extensions import db, limiter
from models import User
from schemas import (
    LoginSchema,
    SignupSchema,
    UpdateProfileSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema,
    TokenSchema,
)
from services.auth import (
    issue_token,
    issue_action_token,
    decode_action_token,
    TokenError,
)
from services.email import send_verification_email, send_password_reset_email
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

VERIFY_PURPOSE = "verify_email"
RESET_PURPOSE = "reset_password"


def _send_verification(user: User) -> None:
    """Issue a verification token and email it (best-effort)."""
    token = issue_action_token(
        user.id, VERIFY_PURPOSE, current_app.config["VERIFY_TOKEN_TTL_MIN"]
    )
    send_verification_email(user.email, user.name, token)

auth_bp = Blueprint("auth", __name__)


def _unique_handle(name: str) -> str:
    """Slugify a name into an @handle, suffixing a number on collision."""
    base = re.sub(r"[^a-z0-9]+", "", name.lower())[:20] or "player"
    candidate = "@" + base
    n = 2
    while User.query.filter_by(handle=candidate).first():
        suffix = str(n)
        candidate = "@" + base[: 20 - len(suffix)] + suffix
        n += 1
    return candidate


def _login_email_key() -> str:
    """Rate-limit key for per-account login throttling (falls back to IP)."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    return f"login:{email}" if email else get_remote_address()


@auth_bp.post("/signup")
@limiter.limit("5 per minute")
def signup():
    """
    Create a new account.
    ---
    tags: [Auth]
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email, password, name]
          properties:
            email:    {type: string, format: email,    example: "you@northwestern.edu"}
            password: {type: string, minLength: 8,     example: "rally1234"}
            name:     {type: string, minLength: 1,     example: "Alex Rivera"}
            sport:    {type: string, enum: [Tennis, Pickleball], default: Pickleball}
            ntrp:     {type: string, enum: ["2.0","2.5","3.0","3.5","4.0","4.5","5.0"], default: "3.5"}
            location: {type: string, example: "Berkeley, CA"}
    responses:
      201:
        description: Account created + JWT issued
      409: {description: Email already in use}
      422: {description: Validation failed (returns field-level errors)}
      429: {description: Rate limited (max 5/min)}
    """
    data = parse_json(SignupSchema)

    # Friendly fast-path; the DB unique constraint below is the real guard
    # against the check-then-insert race.
    if User.query.filter_by(email=data.email).first():
        return jsonify({"error": "Account with that email already exists"}), 409

    user = User(
        email=data.email,
        name=data.name,
        handle=_unique_handle(data.name),
        primary_sport=data.sport,
        location=data.location,
        lat=data.lat,
        lng=data.lng,
    )
    user.set_password(data.password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        # Two concurrent signups for the same email both passed the pre-check.
        db.session.rollback()
        return jsonify({"error": "Account with that email already exists"}), 409

    _send_verification(user)
    return (
        jsonify(
            {
                "user": user.to_dict(with_email=True),
                "token": issue_token(user.id, user.token_version),
            }
        ),
        201,
    )


@auth_bp.post("/login")
@limiter.limit("10 per minute")
@limiter.limit("10 per 15 minutes", key_func=_login_email_key)
def login():
    """
    Authenticate with email + password, get a JWT.
    ---
    tags: [Auth]
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email, password]
          properties:
            email:    {type: string, format: email, example: "alex@rally.app"}
            password: {type: string, example: "rally1234"}
    responses:
      200: {description: "{ user, token }"}
      401: {description: Invalid credentials}
      422: {description: Validation failed}
      429: {description: "Rate limited (10/min per IP, 10/15min per account)"}
    """
    data = parse_json(LoginSchema)
    user = User.query.filter_by(email=data.email).first()
    if not user or not user.check_password(data.password):
        return jsonify({"error": "Invalid email or password"}), 401
    return jsonify(
        {
            "user": user.to_dict(with_email=True),
            "token": issue_token(user.id, user.token_version),
        }
    )


@auth_bp.get("/me")
@require_auth
def me():
    """
    Return the currently authenticated user. Used by the SPA to validate
    cached tokens on app mount.
    ---
    tags: [Auth]
    security:
      - Bearer: []
    responses:
      200: {description: Current user}
      401: {description: Missing/invalid/expired token}
    """
    return jsonify({"user": current_user().to_dict(with_email=True)})


@auth_bp.patch("/me")
@require_auth
def update_me():
    """
    Partial update of the current user's profile.
    ---
    tags: [Auth]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:         {type: string, maxLength: 120}
            bio:          {type: string, maxLength: 1000}
            location:     {type: string, maxLength: 120}
            primarySport: {type: string, enum: [Tennis, Pickleball]}
    responses:
      200: {description: Updated user}
      401: {description: Missing/invalid token}
      422: {description: Validation failed}
    """
    data = parse_json(UpdateProfileSchema)
    user = current_user()
    if data.name is not None:
        user.name = data.name
    if data.bio is not None:
        user.bio = data.bio
    if data.location is not None:
        user.location = data.location
    if data.primarySport is not None:
        user.primary_sport = data.primarySport
    db.session.commit()
    return jsonify({"user": user.to_dict(with_email=True)})


@auth_bp.post("/logout-all")
@require_auth
def logout_all():
    """
    Revoke every outstanding token for the current user (this one included)
    by bumping their token_version. Use after a suspected compromise or to
    "sign out of all devices".
    ---
    tags: [Auth]
    security:
      - Bearer: []
    responses:
      200: {description: All sessions revoked}
      401: {description: Missing/invalid token}
    """
    user = current_user()
    user.revoke_tokens()
    db.session.commit()
    return jsonify({"ok": True})


@auth_bp.post("/verify-email")
def verify_email():
    """
    Confirm an email address from the link in the verification email.
    ---
    tags: [Auth]
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [token]
          properties:
            token: {type: string}
    responses:
      200: {description: Email verified (idempotent)}
      400: {description: Invalid or expired token}
    """
    data = parse_json(TokenSchema)
    try:
        claims = decode_action_token(data.token, VERIFY_PURPOSE)
    except TokenError as e:
        return jsonify({"error": str(e)}), 400
    user = User.query.get(claims.user_id)
    if not user:
        return jsonify({"error": "invalid link"}), 400
    if not user.email_verified:
        user.email_verified = True
        db.session.commit()
    return jsonify({"ok": True, "user": user.to_dict(with_email=True)})


@auth_bp.post("/resend-verification")
@require_auth
@limiter.limit("3 per 10 minutes")
def resend_verification():
    """
    Re-send the verification email to the logged-in user.
    ---
    tags: [Auth]
    security:
      - Bearer: []
    responses:
      200: {description: Sent (or already verified)}
      401: {description: Missing/invalid token}
      429: {description: Rate limited}
    """
    user = current_user()
    if not user.email_verified:
        _send_verification(user)
    return jsonify({"ok": True, "alreadyVerified": user.email_verified})


@auth_bp.post("/forgot-password")
@limiter.limit("5 per 15 minutes", key_func=_login_email_key)
def forgot_password():
    """
    Request a password-reset email. Always returns 200 so the response never
    reveals whether an account exists (no enumeration).
    ---
    tags: [Auth]
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email]
          properties:
            email: {type: string, format: email}
    responses:
      200: {description: "Always — if the account exists, an email was sent"}
      422: {description: Validation failed}
    """
    data = parse_json(ForgotPasswordSchema)
    user = User.query.filter_by(email=data.email).first()
    if user:
        # Embed the current token_version so the link is single-use: resetting
        # bumps the version, which invalidates this (and any older) link.
        token = issue_action_token(
            user.id,
            RESET_PURPOSE,
            current_app.config["RESET_TOKEN_TTL_MIN"],
            token_version=user.token_version,
        )
        send_password_reset_email(user.email, user.name, token)
    return jsonify({"ok": True})


@auth_bp.post("/reset-password")
@limiter.limit("10 per 15 minutes")
def reset_password():
    """
    Set a new password using the token from the reset email. Revokes all of the
    user's existing sessions on success.
    ---
    tags: [Auth]
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [token, password]
          properties:
            token:    {type: string}
            password: {type: string, minLength: 8}
    responses:
      200: {description: Password updated}
      400: {description: Invalid or expired link}
      422: {description: Validation failed (weak password)}
    """
    data = parse_json(ResetPasswordSchema)
    try:
        claims = decode_action_token(data.token, RESET_PURPOSE)
    except TokenError as e:
        return jsonify({"error": str(e)}), 400
    user = User.query.get(claims.user_id)
    # Single-use: reject if the embedded version no longer matches (link already
    # used, or sessions revoked since it was issued).
    if not user or claims.token_version != user.token_version:
        return jsonify({"error": "invalid or expired link"}), 400
    user.set_password(data.password)
    user.revoke_tokens()  # invalidate this link + sign out everywhere
    db.session.commit()
    return jsonify({"ok": True})
