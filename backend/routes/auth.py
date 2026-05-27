"""
Auth endpoints — JWT-based.

POST /api/auth/signup  body: {email, password, name, sport?, ntrp?, location?}
POST /api/auth/login   body: {email, password}
GET  /api/auth/me      header: Authorization: Bearer <jwt>
"""
import re
from flask import Blueprint, jsonify

from extensions import db, limiter
from models import User
from schemas import LoginSchema, SignupSchema, UpdateProfileSchema
from services.auth import issue_token
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

auth_bp = Blueprint("auth", __name__)


def _slugify_handle(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "", name.lower())
    return "@" + (slug or "player")[:20]


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

    if User.query.filter_by(email=data.email).first():
        return jsonify({"error": "Account with that email already exists"}), 409

    user = User(
        email=data.email,
        name=data.name,
        handle=_slugify_handle(data.name),
        primary_sport=data.sport,
        location=data.location,
    )
    user.set_password(data.password)
    db.session.add(user)
    db.session.commit()
    return (
        jsonify({"user": user.to_dict(with_email=True), "token": issue_token(user.id)}),
        201,
    )


@auth_bp.post("/login")
@limiter.limit("10 per minute")
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
      429: {description: Rate limited (max 10/min)}
    """
    data = parse_json(LoginSchema)
    user = User.query.filter_by(email=data.email).first()
    if not user or not user.check_password(data.password):
        return jsonify({"error": "Invalid email or password"}), 401
    return jsonify({"user": user.to_dict(with_email=True), "token": issue_token(user.id)})


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
