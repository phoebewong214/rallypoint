"""
Transactional email.

Preferred path is the Resend HTTP API (https://api.resend.com/emails) over
port 443 — PaaS hosts like Render often block outbound SMTP ports, so SMTP
connections time out. The HTTP API avoids that entirely and is Resend's
recommended integration.

Resolution order in send_email():
  1. A Resend API key (RESEND_API_KEY, or SMTP_PASSWORD when it's a `re_...`
     key) → send via the HTTP API.
  2. Otherwise SMTP_HOST set → legacy SMTP send.
  3. Otherwise (dev) → log the message (and links) to the console.

Sending is best-effort: callers must never let a mail failure break the
request (e.g. signup must still succeed if the welcome email bounces).
"""
from __future__ import annotations
import json
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage

from flask import current_app


def _build_url(path: str, token: str) -> str:
    base = current_app.config["APP_BASE_URL"].rstrip("/")
    return f"{base}{path}?token={token}"


def _resend_api_key() -> str:
    cfg = current_app.config
    key = cfg.get("RESEND_API_KEY") or cfg.get("SMTP_PASSWORD") or ""
    return key if key.startswith("re_") else ""


def _send_via_resend_api(to: str, subject: str, body: str) -> bool:
    cfg = current_app.config
    payload = json.dumps(
        {"from": cfg["SMTP_FROM"], "to": [to], "subject": subject, "text": body}
    ).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {_resend_api_key()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            # Cloudflare (fronting api.resend.com) blocks the default
            # "Python-urllib/x.y" UA with error 1010 — send a real one.
            "User-Agent": "RallyPoint/1.0 (+https://tryrallypoint.com)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:  # Resend rejected the request
        detail = e.read().decode("utf-8", "replace")[:500]
        current_app.logger.error("Resend API %s for %s: %s", e.code, to, detail)
        return False
    except Exception:  # noqa: BLE001 — mail must never crash the request
        current_app.logger.exception("Failed to send email via Resend API to %s", to)
        return False


def _send_via_smtp(to: str, subject: str, body: str) -> bool:
    cfg = current_app.config
    msg = EmailMessage()
    msg["From"] = cfg["SMTP_FROM"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(cfg["SMTP_HOST"], cfg["SMTP_PORT"], timeout=10) as server:
            if cfg.get("SMTP_USE_TLS"):
                server.starttls()
            if cfg.get("SMTP_USER"):
                server.login(cfg["SMTP_USER"], cfg["SMTP_PASSWORD"])
            server.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 — mail must never crash the request
        current_app.logger.exception("Failed to send email via SMTP to %s", to)
        return False


def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True if sent/logged, False on error."""
    if _resend_api_key():
        return _send_via_resend_api(to, subject, body)

    if current_app.config.get("SMTP_HOST"):
        return _send_via_smtp(to, subject, body)

    # Dev fallback — surface the email (and any links) in the console.
    current_app.logger.info(
        "[email:dev] no email transport configured — would send to %s\n"
        "  Subject: %s\n%s",
        to, subject, "\n".join("  " + line for line in body.splitlines()),
    )
    return True


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
