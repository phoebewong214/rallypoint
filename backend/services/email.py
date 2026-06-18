"""
Transactional email over SMTP.

In dev (no SMTP_HOST configured) emails are logged to the app logger instead
of being sent, so the verification / reset flows are fully testable without a
mail provider — look for the link in the backend console.

Sending is best-effort: callers should never let a mail failure break the
request (e.g. signup must still succeed if the welcome email bounces).
"""
from __future__ import annotations
import smtplib
from email.message import EmailMessage

from flask import current_app


def _build_url(path: str, token: str) -> str:
    base = current_app.config["APP_BASE_URL"].rstrip("/")
    return f"{base}{path}?token={token}"


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True if sent/logged, False on error."""
    cfg = current_app.config
    host = cfg.get("SMTP_HOST")

    if not host:
        # Dev fallback — surface the email (and any links) in the console.
        current_app.logger.info(
            "[email:dev] no SMTP_HOST set — would send to %s\n"
            "  Subject: %s\n%s",
            to, subject, "\n".join("  " + line for line in body.splitlines()),
        )
        return True

    msg = EmailMessage()
    msg["From"] = cfg["SMTP_FROM"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, cfg["SMTP_PORT"], timeout=10) as server:
            if cfg.get("SMTP_USE_TLS"):
                server.starttls()
            if cfg.get("SMTP_USER"):
                server.login(cfg["SMTP_USER"], cfg["SMTP_PASSWORD"])
            server.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 — mail must never crash the request
        current_app.logger.exception("Failed to send email to %s", to)
        return False


def send_verification_email(to: str, name: str, token: str) -> bool:
    url = _build_url("/verify-email", token)
    body = (
        f"Hi {name},\n\n"
        "Welcome to RallyPoint! Confirm your email to get matched with partners:\n\n"
        f"{url}\n\n"
        "This link expires in 24 hours. If you didn't sign up, you can ignore this email."
    )
    return send_email(to, "Confirm your RallyPoint email", body)


def send_password_reset_email(to: str, name: str, token: str) -> bool:
    url = _build_url("/reset-password", token)
    body = (
        f"Hi {name},\n\n"
        "We received a request to reset your RallyPoint password. "
        "Set a new one here:\n\n"
        f"{url}\n\n"
        "This link expires in 1 hour. If you didn't request this, your password "
        "is unchanged and you can safely ignore this email."
    )
    return send_email(to, "Reset your RallyPoint password", body)
