"""
Customer-support endpoints — for signed-in users.

POST /api/support/chat       ask the AI support assistant (falls back to a
                             "leave a message" prompt when no OPENAI_API_KEY)
POST /api/support/escalate   "talk to a human" → emails the support inbox
                             (SUPPORT_ADMIN_EMAIL) with the user + their message
"""
import json

from flask import Blueprint, jsonify, current_app

from extensions import db
from models import SupportTicket
from schemas import SupportChatSchema, SupportEscalateSchema
from services.support import answer_support
from services.email import send_email
from utils.decorators import require_auth, current_user
from utils.validate import parse_json

support_bp = Blueprint("support", __name__)

# Shown when the AI assistant isn't configured (or errored) — steers the user to
# the human-escalation path so they're never left without a way to get help.
DEGRADE_REPLY = (
    "I can't answer automatically right now, but our team can help. "
    'Tap "Talk to a human" and we\'ll get back to you by email.'
)


@support_bp.post("/chat")
@require_auth
def chat():
    """
    Ask the AI support assistant.
    ---
    tags: [Support]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [message]
          properties:
            message: {type: string, example: "How do I request a game?"}
            history:
              type: array
              items:
                type: object
                properties:
                  role:    {type: string, enum: [user, assistant]}
                  content: {type: string}
    responses:
      200:
        description: Assistant reply
        schema:
          type: object
          properties:
            reply:  {type: string}
            source: {type: string, enum: [ai, unavailable]}
      401: {description: Missing/invalid token}
      422: {description: Validation failed}
    """
    data = parse_json(SupportChatSchema)
    history = [{"role": t.role, "content": t.content} for t in (data.history or [])]
    try:
        reply = answer_support(data.message, history, current_user())
    except Exception as e:  # noqa: BLE001 — any AI/transport error degrades gracefully
        current_app.logger.warning("support chat failed, degrading: %s", e)
        reply = None
    if reply is None:
        return jsonify({"reply": DEGRADE_REPLY, "source": "unavailable"})
    return jsonify({"reply": reply, "source": "ai"})


@support_bp.post("/escalate")
@require_auth
def escalate():
    """
    Send a support request to the human support inbox.
    ---
    tags: [Support]
    security:
      - Bearer: []
    consumes: [application/json]
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [message]
          properties:
            message: {type: string}
            history:
              type: array
              items:
                type: object
                properties:
                  role:    {type: string, enum: [user, assistant]}
                  content: {type: string}
    responses:
      200: {description: Ticket created; `emailed` flags whether the inbox notification went out}
      401: {description: Missing/invalid token}
      422: {description: Validation failed}
    """
    data = parse_json(SupportEscalateSchema)
    user = current_user()

    # Persist the ticket FIRST so the message is never lost, even if the email
    # notification below fails. This is the source of truth for the admin desk.
    history = [{"role": t.role, "content": t.content.strip()} for t in (data.history or [])]
    ticket = SupportTicket(
        user_id=user.id,
        message=data.message.strip(),
        history_json=json.dumps(history) if history else None,
    )
    db.session.add(ticket)
    db.session.commit()

    # Best-effort notification to the human support inbox (on top of the queue).
    to = current_app.config["SUPPORT_ADMIN_EMAIL"]
    lines = [
        f"Support request from {user.name} ({user.handle})",
        f"User email: {user.email}",
        f"User ID: {user.id}",
        f"Ticket #{ticket.id} — review at /admin (Support tab)",
        "",
        "Message:",
        ticket.message,
    ]
    if history:
        lines += ["", "--- Conversation so far ---"]
        for t in history:
            who = "User" if t["role"] == "user" else "Assistant"
            lines.append(f"{who}: {t['content']}")
    subject = f"[RallyPoint Support] {user.name} <{user.email}>"

    emailed = bool(send_email(to, subject, "\n".join(lines)))
    if not emailed:
        current_app.logger.warning("support escalation #%s saved but email notify failed", ticket.id)
    return jsonify({"ok": True, "emailed": emailed, "ticketId": ticket.id})
