"""
Admin dashboard endpoints — gated by @require_admin (login + is_admin flag).

GET   /api/admin/stats          aggregate counts for the dashboard
GET   /api/admin/users          paginated user list (?q= search, ?page=, ?perPage=)
GET   /api/admin/users/<id>     one user's full record
PATCH /api/admin/users/<id>     edit a user (support-desk fields users can't self-edit)

Admin status itself is NEVER editable through the API — it's set out-of-band via
the DB or `python manage.py set-admin <email>`.
"""
import json
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import or_, func

from extensions import db
from models import (
    User,
    SportProfile,
    Court,
    GameInvite,
    CourtAppointment,
)
from services.embeddings import embed_text
from schemas import AdminUpdateUserSchema
from utils.decorators import require_admin
from utils.validate import parse_json

admin_bp = Blueprint("admin", __name__)

# Virtual demo accounts (seed-demo) live on this domain; we surface them
# separately so real signups aren't drowned out in the counts.
DEMO_EMAIL_SUFFIX = "@demo.tryrallypoint.com"


def _admin_user_dict(user: User) -> dict:
    """User record for the admin UI: the standard profile + email/verification/
    admin flags + a precise ISO join timestamp for sorting/display."""
    out = user.to_dict(with_email=True)
    out["createdAt"] = user.created_at.isoformat() if user.created_at else None
    return out


@admin_bp.get("/stats")
@require_admin
def stats():
    """
    Aggregate counts for the admin dashboard.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    responses:
      200: {description: Dashboard counts}
      403: {description: Not an admin}
    """
    now = datetime.utcnow()
    last_7 = now - timedelta(days=7)
    last_30 = now - timedelta(days=30)

    is_demo = User.email.like("%" + DEMO_EMAIL_SUFFIX)

    total_users = db.session.query(func.count(User.id)).scalar() or 0
    demo_users = db.session.query(func.count(User.id)).filter(is_demo).scalar() or 0
    verified_users = (
        db.session.query(func.count(User.id)).filter(User.email_verified.is_(True)).scalar() or 0
    )
    admin_users = (
        db.session.query(func.count(User.id)).filter(User.is_admin.is_(True)).scalar() or 0
    )
    new_7 = db.session.query(func.count(User.id)).filter(User.created_at >= last_7).scalar() or 0
    new_30 = db.session.query(func.count(User.id)).filter(User.created_at >= last_30).scalar() or 0

    return jsonify({
        "users": {
            "total": total_users,
            "real": total_users - demo_users,
            "demo": demo_users,
            "verified": verified_users,
            "admins": admin_users,
            "new7d": new_7,
            "new30d": new_30,
        },
        "invites": db.session.query(func.count(GameInvite.id)).scalar() or 0,
        "appointments": db.session.query(func.count(CourtAppointment.id)).scalar() or 0,
        "courts": db.session.query(func.count(Court.id)).scalar() or 0,
    })


@admin_bp.get("/users")
@require_admin
def list_users():
    """
    Paginated, searchable user list.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    parameters:
      - {in: query, name: q,       type: string,  description: "match name/email/handle"}
      - {in: query, name: page,    type: integer, default: 1}
      - {in: query, name: perPage, type: integer, default: 25}
    responses:
      200: {description: User list + pagination}
      403: {description: Not an admin}
    """
    q = (request.args.get("q") or "").strip()
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("perPage", 25))))
    except (TypeError, ValueError):
        return jsonify({"error": "page/perPage must be integers"}), 400

    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            User.name.ilike(like),
            User.email.ilike(like),
            User.handle.ilike(like),
        ))

    total = query.with_entities(func.count(User.id)).scalar() or 0
    rows = (
        query.order_by(User.created_at.desc().nullslast(), User.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify({
        "users": [_admin_user_dict(u) for u in rows],
        "total": total,
        "page": page,
        "perPage": per_page,
        "pages": (total + per_page - 1) // per_page,
    })


@admin_bp.get("/users/<int:user_id>")
@require_admin
def get_user(user_id: int):
    """
    One user's full record.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
    responses:
      200: {description: User record}
      403: {description: Not an admin}
      404: {description: No such user}
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"user": _admin_user_dict(user)})


@admin_bp.patch("/users/<int:user_id>")
@require_admin
def update_user(user_id: int):
    """
    Edit a user's profile on their behalf (support desk). Cannot grant admin.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
      - in: body
        name: body
        schema:
          type: object
          properties:
            name:          {type: string}
            email:         {type: string, format: email}
            handle:        {type: string}
            emailVerified: {type: boolean}
            bio:           {type: string}
            location:      {type: string}
            primarySport:  {type: string, enum: [Tennis, Pickleball]}
    responses:
      200: {description: Updated user}
      403: {description: Not an admin}
      404: {description: No such user}
      409: {description: Email/handle already in use}
      422: {description: Validation failed}
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = parse_json(AdminUpdateUserSchema)

    # Pre-check uniqueness so we return a clean 409 instead of a DB IntegrityError.
    if data.email is not None and data.email.lower() != (user.email or "").lower():
        clash = User.query.filter(
            func.lower(User.email) == data.email.lower(), User.id != user.id
        ).first()
        if clash:
            return jsonify({"error": "email already in use"}), 409
    if data.handle is not None and data.handle != user.handle:
        clash = User.query.filter(User.handle == data.handle, User.id != user.id).first()
        if clash:
            return jsonify({"error": "handle already in use"}), 409

    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        user.email = data.email
    if data.handle is not None:
        user.handle = data.handle
    if data.emailVerified is not None:
        user.email_verified = data.emailVerified
    if data.bio is not None:
        user.bio = data.bio
        # Keep the semantic-match vector in sync (no-op without OPENAI_API_KEY).
        vec = embed_text(data.bio)
        user.bio_embedding = json.dumps(vec) if vec else None
    if data.location is not None:
        user.location = data.location
    if data.lat is not None:
        user.lat = data.lat
    if data.lng is not None:
        user.lng = data.lng
    if data.primarySport is not None:
        user.primary_sport = data.primarySport
    if data.sportProfiles is not None:
        # Same upsert semantics as the self-serve profile update: the sent list
        # is the complete desired set, but the primary sport's profile is kept.
        new_primary = data.primarySport or user.primary_sport
        desired = {sp.sport: sp for sp in data.sportProfiles}
        existing = {p.sport: p for p in list(user.sport_profiles)}
        for sport, sp in desired.items():
            court_id = None
            if sp.homeCourt:
                court = Court.query.filter_by(slug=sp.homeCourt).first()
                court_id = court.id if court else None
            prof = existing.get(sport)
            if prof:
                prof.ntrp = sp.ntrp
                if sp.availabilitySummary is not None:
                    prof.availability_summary = sp.availabilitySummary
                if sp.homeCourt is not None:
                    prof.home_court_id = court_id
            else:
                user.sport_profiles.append(SportProfile(
                    sport=sport, ntrp=sp.ntrp,
                    availability_summary=sp.availabilitySummary, home_court_id=court_id,
                ))
        for sport, prof in existing.items():
            if sport not in desired and sport != new_primary:
                user.sport_profiles.remove(prof)

    db.session.commit()
    return jsonify({"user": _admin_user_dict(user)})
