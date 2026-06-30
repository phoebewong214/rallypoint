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

from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import or_, func

from extensions import db
from models import (
    User,
    SportProfile,
    Court,
    CourtFavorite,
    CourtCheckIn,
    GameInvite,
    TimeProposal,
    CourtAppointment,
    AppointmentParticipant,
    Session,
    SavedPlayer,
    AIMatchLog,
    UserReport,
    SupportTicket,
)
from services.embeddings import embed_text
from schemas import (
    AdminUpdateUserSchema,
    AdminReviewReportSchema,
    AdminUpdateTicketSchema,
    AdminCourtSchema,
)
from utils.decorators import require_admin, current_user
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


def _delete_user_cascade(user: User) -> None:
    """Permanently remove a user and every row that references them, in FK-safe
    order (Postgres enforces FKs; SQLite dev doesn't, but we stay correct for both).
    sport_profiles + availability cascade via the ORM relationships on delete."""
    uid = user.id

    # Appointments: rows where they joined others' games, then games they created.
    AppointmentParticipant.query.filter_by(user_id=uid).delete(synchronize_session=False)
    appt_ids = [a.id for a in CourtAppointment.query.filter_by(creator_id=uid).all()]
    if appt_ids:
        AppointmentParticipant.query.filter(
            AppointmentParticipant.appointment_id.in_(appt_ids)
        ).delete(synchronize_session=False)
        CourtAppointment.query.filter(CourtAppointment.id.in_(appt_ids)).delete(synchronize_session=False)

    # Lightweight per-user rows.
    SavedPlayer.query.filter(
        or_(SavedPlayer.user_id == uid, SavedPlayer.player_id == uid)
    ).delete(synchronize_session=False)
    CourtFavorite.query.filter_by(user_id=uid).delete(synchronize_session=False)
    CourtCheckIn.query.filter_by(user_id=uid).delete(synchronize_session=False)
    AIMatchLog.query.filter(
        or_(AIMatchLog.viewer_id == uid, AIMatchLog.candidate_id == uid)
    ).delete(synchronize_session=False)

    # Invites (+ their time proposals) and any materialized sessions involving them.
    invite_ids = [
        i.id for i in GameInvite.query.filter(
            or_(GameInvite.inviter_id == uid, GameInvite.invitee_id == uid)
        ).all()
    ]
    if invite_ids:
        TimeProposal.query.filter(TimeProposal.invite_id.in_(invite_ids)).delete(synchronize_session=False)
        GameInvite.query.filter(GameInvite.id.in_(invite_ids)).delete(synchronize_session=False)
    Session.query.filter(
        or_(Session.host_id == uid, Session.guest_id == uid)
    ).delete(synchronize_session=False)

    # Reports & tickets: drop those by/about them; null them out as a resolver.
    UserReport.query.filter(
        or_(UserReport.reporter_id == uid, UserReport.reported_id == uid)
    ).delete(synchronize_session=False)
    UserReport.query.filter_by(resolved_by_id=uid).update({"resolved_by_id": None}, synchronize_session=False)
    SupportTicket.query.filter_by(user_id=uid).delete(synchronize_session=False)
    SupportTicket.query.filter_by(resolved_by_id=uid).update({"resolved_by_id": None}, synchronize_session=False)

    # Finally the user (cascades sport_profiles + availability via relationships).
    db.session.delete(user)
    db.session.commit()


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
    suspended_users = (
        db.session.query(func.count(User.id)).filter(User.is_active.is_(False)).scalar() or 0
    )
    new_7 = db.session.query(func.count(User.id)).filter(User.created_at >= last_7).scalar() or 0
    new_30 = db.session.query(func.count(User.id)).filter(User.created_at >= last_30).scalar() or 0
    open_reports = (
        db.session.query(func.count(UserReport.id)).filter(UserReport.status == "open").scalar() or 0
    )
    open_tickets = (
        db.session.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "open").scalar() or 0
    )

    return jsonify({
        "users": {
            "total": total_users,
            "real": total_users - demo_users,
            "demo": demo_users,
            "verified": verified_users,
            "admins": admin_users,
            "suspended": suspended_users,
            "new7d": new_7,
            "new30d": new_30,
        },
        "openReports": open_reports,
        "openTickets": open_tickets,
        "invites": db.session.query(func.count(GameInvite.id)).scalar() or 0,
        "appointments": db.session.query(func.count(CourtAppointment.id)).scalar() or 0,
        "courts": db.session.query(func.count(Court.id)).scalar() or 0,
    })


@admin_bp.get("/overview")
@require_admin
def overview():
    """
    Activity feed for the dashboard home: recent signups, recent game invites,
    and a 14-day daily new-signups series for a sparkline.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    responses:
      200: {description: Recent activity}
      403: {description: Not an admin}
    """
    now = datetime.utcnow()

    recent_users = (
        User.query.order_by(User.created_at.desc().nullslast(), User.id.desc()).limit(8).all()
    )
    recent_signups = [
        {
            "id": u.id, "name": u.name, "handle": u.handle, "email": u.email,
            "createdAt": u.created_at.isoformat() if u.created_at else None,
        }
        for u in recent_users
    ]

    recent_inv = (
        GameInvite.query.order_by(GameInvite.created_at.desc().nullslast(), GameInvite.id.desc())
        .limit(8).all()
    )
    recent_invites = [
        {
            "id": i.id,
            "inviter": i.inviter.name if i.inviter else None,
            "invitee": i.invitee.name if i.invitee else None,
            "sport": i.sport,
            "phase": i.phase,
            "createdAt": i.created_at.isoformat() if i.created_at else None,
        }
        for i in recent_inv
    ]

    # 14-day daily new-signup counts (oldest → newest), zero-filled.
    start = (now - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)
    counts: dict[str, int] = {}
    for u in User.query.filter(User.created_at >= start).all():
        if u.created_at:
            key = u.created_at.strftime("%Y-%m-%d")
            counts[key] = counts.get(key, 0) + 1
    series = [
        {"date": (start + timedelta(days=d)).strftime("%Y-%m-%d"),
         "count": counts.get((start + timedelta(days=d)).strftime("%Y-%m-%d"), 0)}
        for d in range(14)
    ]

    return jsonify({
        "recentSignups": recent_signups,
        "recentInvites": recent_invites,
        "signupSeries": series,
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
    # Resend-verification wins over an explicit emailVerified=True: a fresh email
    # is unverified until the user clicks the new link.
    if data.resendVerification:
        user.email_verified = False
    if data.isActive is not None and data.isActive != user.is_active:
        # Guard against an admin locking themselves out mid-session.
        if not data.isActive and user.id == current_user().id:
            return jsonify({"error": "You can't suspend your own account"}), 400
        user.suspend() if not data.isActive else user.reactivate()
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

    # Best-effort: re-send the verification email to the (possibly new) address.
    if data.resendVerification:
        try:
            from routes.auth import _send_verification
            _send_verification(user)
        except Exception as e:  # noqa: BLE001 — never fail the edit on email trouble
            current_app.logger.warning("admin resend-verification failed for %s: %s", user.id, e)

    return jsonify({"user": _admin_user_dict(user)})


@admin_bp.delete("/users/<int:user_id>")
@require_admin
def delete_user(user_id: int):
    """
    Permanently delete a user and all of their data (profile, games, invites,
    reports, tickets, favorites…). Irreversible. Use suspend for a reversible lock.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    parameters:
      - {in: path, name: user_id, type: integer, required: true}
    responses:
      200: {description: Deleted}
      400: {description: Can't delete your own account}
      403: {description: Not an admin}
      404: {description: No such user}
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404
    if user.id == current_user().id:
        return jsonify({"error": "You can't delete your own account"}), 400
    _delete_user_cascade(user)
    return jsonify({"ok": True})


@admin_bp.get("/reports")
@require_admin
def list_reports():
    """
    Trust & safety report queue. Defaults to open reports; ?status=all for every
    status, or reviewed/dismissed to filter.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    parameters:
      - {in: query, name: status, type: string, enum: [open, reviewed, dismissed, all], default: open}
    responses:
      200: {description: Reports + counts}
      403: {description: Not an admin}
    """
    status = (request.args.get("status") or "open").lower()
    query = UserReport.query
    if status in ("open", "reviewed", "dismissed"):
        query = query.filter(UserReport.status == status)
    rows = query.order_by(UserReport.created_at.desc(), UserReport.id.desc()).all()
    open_count = (
        db.session.query(func.count(UserReport.id)).filter(UserReport.status == "open").scalar() or 0
    )
    return jsonify({"reports": [r.to_dict() for r in rows], "openCount": open_count})


@admin_bp.patch("/reports/<int:report_id>")
@require_admin
def review_report(report_id: int):
    """
    Resolve a report: mark it reviewed or dismissed, optionally suspending the
    reported account in the same step.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - {in: path, name: report_id, type: integer, required: true}
      - in: body
        name: body
        schema:
          type: object
          required: [status]
          properties:
            status:  {type: string, enum: [reviewed, dismissed]}
            note:    {type: string}
            suspend: {type: boolean, description: "Also suspend the reported user"}
    responses:
      200: {description: Updated report}
      403: {description: Not an admin}
      404: {description: No such report}
      422: {description: Validation failed}
    """
    report = UserReport.query.get(report_id)
    if not report:
        return jsonify({"error": "report not found"}), 404

    data = parse_json(AdminReviewReportSchema)
    report.status = data.status
    report.resolution_note = data.note
    report.resolved_at = datetime.utcnow()
    report.resolved_by_id = current_user().id

    if data.suspend:
        reported = report.reported
        if reported and reported.id == current_user().id:
            return jsonify({"error": "You can't suspend your own account"}), 400
        if reported and reported.is_active:
            reported.suspend()

    db.session.commit()
    return jsonify({"report": report.to_dict()})


@admin_bp.get("/support")
@require_admin
def list_support():
    """
    Support-desk queue (persisted "talk to a human" escalations). Defaults to
    open tickets; ?status=all for every status, or closed.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    parameters:
      - {in: query, name: status, type: string, enum: [open, closed, all], default: open}
    responses:
      200: {description: Tickets + open count}
      403: {description: Not an admin}
    """
    status = (request.args.get("status") or "open").lower()
    query = SupportTicket.query
    if status in ("open", "closed"):
        query = query.filter(SupportTicket.status == status)
    rows = query.order_by(SupportTicket.created_at.desc(), SupportTicket.id.desc()).all()
    open_count = (
        db.session.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "open").scalar() or 0
    )
    return jsonify({"tickets": [t.to_dict() for t in rows], "openCount": open_count})


@admin_bp.patch("/support/<int:ticket_id>")
@require_admin
def update_support(ticket_id: int):
    """
    Resolve or reopen a support ticket.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - {in: path, name: ticket_id, type: integer, required: true}
      - in: body
        name: body
        schema:
          type: object
          required: [status]
          properties:
            status: {type: string, enum: [open, closed]}
            note:   {type: string}
    responses:
      200: {description: Updated ticket}
      403: {description: Not an admin}
      404: {description: No such ticket}
      422: {description: Validation failed}
    """
    ticket = SupportTicket.query.get(ticket_id)
    if not ticket:
        return jsonify({"error": "ticket not found"}), 404

    data = parse_json(AdminUpdateTicketSchema)
    ticket.status = data.status
    if data.note is not None:
        ticket.resolution_note = data.note
    if data.status == "closed":
        ticket.resolved_at = datetime.utcnow()
        ticket.resolved_by_id = current_user().id
    else:  # reopened
        ticket.resolved_at = None
        ticket.resolved_by_id = None

    db.session.commit()
    return jsonify({"ticket": ticket.to_dict()})


# ----- court management -----

def _unique_court_slug(base: str, exclude_id: int | None = None) -> str:
    """Slugify `base` into a courts.slug that's unique (optionally ignoring the
    row being updated)."""
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", (base or "").lower()).strip("-") or "court"
    candidate, n = slug, 2
    while True:
        clash = Court.query.filter(Court.slug == candidate)
        if exclude_id is not None:
            clash = clash.filter(Court.id != exclude_id)
        if not clash.first():
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


def _apply_court_fields(court: Court, data: AdminCourtSchema) -> None:
    """Copy the provided (non-None) fields from the schema onto the Court."""
    if data.name is not None:
        court.name = data.name
    if data.address is not None:
        court.address = data.address
    if data.lat is not None:
        court.lat = data.lat
    if data.lng is not None:
        court.lng = data.lng
    if data.primarySport is not None:
        court.primary_sport = data.primarySport
    if data.sports is not None:
        court.sports = ",".join(data.sports)
    if data.courtCount is not None:
        court.court_count = data.courtCount
    if data.surface is not None:
        court.surface = data.surface
    if data.lights is not None:
        court.lights = data.lights
    if data.isActive is not None:
        court.is_active = data.isActive


@admin_bp.get("/courts")
@require_admin
def list_courts_admin():
    """
    All courts (including inactive) for the admin Courts tab.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    responses:
      200: {description: Courts list}
      403: {description: Not an admin}
    """
    rows = Court.query.order_by(Court.name.asc()).all()
    return jsonify({"courts": [c.admin_dict() for c in rows]})


@admin_bp.post("/courts")
@require_admin
def create_court():
    """
    Add a court.
    ---
    tags: [Admin]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required: [name]
          properties:
            name:         {type: string}
            slug:         {type: string}
            address:      {type: string}
            lat:          {type: number}
            lng:          {type: number}
            primarySport: {type: string, enum: [tennis, pickleball]}
            sports:       {type: array, items: {type: string, enum: [Tennis, Pickleball]}}
            courtCount:   {type: integer}
            surface:      {type: string}
            lights:       {type: boolean}
    responses:
      201: {description: Created court}
      400: {description: Name required}
      403: {description: Not an admin}
      422: {description: Validation failed}
    """
    data = parse_json(AdminCourtSchema)
    if not data.name:
        return jsonify({"error": "A court name is required"}), 400

    court = Court(
        slug=_unique_court_slug(data.slug or data.name),
        name=data.name,
        # Default the primary sport to the first listed sport when omitted.
        primary_sport=data.primarySport or (data.sports[0].lower() if data.sports else None),
        court_count=data.courtCount or 1,
        lights=bool(data.lights),
        is_active=data.isActive if data.isActive is not None else True,
    )
    _apply_court_fields(court, data)
    db.session.add(court)
    db.session.commit()
    return jsonify({"court": court.admin_dict()}), 201


@admin_bp.patch("/courts/<int:court_id>")
@require_admin
def update_court(court_id: int):
    """
    Edit a court (including activating/deactivating it).
    ---
    tags: [Admin]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - {in: path, name: court_id, type: integer, required: true}
      - in: body
        name: body
        schema: {type: object}
    responses:
      200: {description: Updated court}
      403: {description: Not an admin}
      404: {description: No such court}
      409: {description: Slug already in use}
      422: {description: Validation failed}
    """
    court = Court.query.get(court_id)
    if not court:
        return jsonify({"error": "court not found"}), 404

    data = parse_json(AdminCourtSchema)
    if data.slug is not None and data.slug != court.slug:
        if Court.query.filter(Court.slug == data.slug, Court.id != court.id).first():
            return jsonify({"error": "slug already in use"}), 409
        court.slug = data.slug
    _apply_court_fields(court, data)
    db.session.commit()
    return jsonify({"court": court.admin_dict()})


@admin_bp.delete("/courts/<int:court_id>")
@require_admin
def delete_court(court_id: int):
    """
    Delete a court — only when nothing references it (else deactivate instead, so
    historical games/appointments aren't orphaned).
    ---
    tags: [Admin]
    security:
      - Bearer: []
    parameters:
      - {in: path, name: court_id, type: integer, required: true}
    responses:
      200: {description: Deleted}
      403: {description: Not an admin}
      404: {description: No such court}
      409: {description: Court is in use — deactivate instead}
    """
    court = Court.query.get(court_id)
    if not court:
        return jsonify({"error": "court not found"}), 404

    refs = (
        db.session.query(func.count(SportProfile.id)).filter(SportProfile.home_court_id == court.id).scalar()
        + db.session.query(func.count(Session.id)).filter(Session.court_id == court.id).scalar()
        + db.session.query(func.count(CourtAppointment.id)).filter(CourtAppointment.court_id == court.id).scalar()
        + db.session.query(func.count(CourtFavorite.id)).filter(CourtFavorite.court_id == court.id).scalar()
        + db.session.query(func.count(CourtCheckIn.id)).filter(CourtCheckIn.court_id == court.id).scalar()
    )
    if refs:
        return jsonify({
            "error": "This court is referenced by games, favorites or home-court "
                     "settings. Deactivate it instead of deleting.",
        }), 409

    db.session.delete(court)
    db.session.commit()
    return jsonify({"ok": True})
