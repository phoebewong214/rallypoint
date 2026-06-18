"""
Centralized config loaded from environment.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _normalize_db_url(url: str) -> str:
    # Managed Postgres (Render/Heroku/etc.) hand out "postgres://", but
    # SQLAlchemy 2.x + psycopg2 require the "postgresql://" scheme.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-not-for-prod")
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(
        os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'rallypoint.db'}")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = [
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
        ).split(",")
        if o.strip()
    ]
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

    # Public base URL of the SPA — used to build links inside transactional
    # emails (verification, password reset).
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:5173")

    # SMTP — transactional email. Leave SMTP_HOST blank in dev: emails are
    # logged to the console instead of being sent.
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    SMTP_FROM = os.environ.get("SMTP_FROM", "RallyPoint <no-reply@rallypoint.app>")
    SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
    # Resend HTTP API (preferred over SMTP — port 443, not blocked by PaaS hosts).
    # Falls back to SMTP_PASSWORD when that's already a `re_...` key.
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

    # Lifetimes for single-use action tokens (minutes).
    VERIFY_TOKEN_TTL_MIN = int(os.environ.get("VERIFY_TOKEN_TTL_MIN", str(60 * 24)))
    RESET_TOKEN_TTL_MIN = int(os.environ.get("RESET_TOKEN_TTL_MIN", "60"))

    # Auth cookies. The JWT lives in an httpOnly cookie (JS can't read it, so
    # XSS can't exfiltrate it); a readable CSRF cookie is echoed back in a
    # header for double-submit CSRF protection on unsafe methods.
    AUTH_COOKIE_NAME = os.environ.get("AUTH_COOKIE_NAME", "rp_session")
    CSRF_COOKIE_NAME = os.environ.get("CSRF_COOKIE_NAME", "rp_csrf")
    # Secure=False for http://localhost dev; set COOKIE_SECURE=true in prod.
    COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
    # "Lax" is enough when the SPA and API share a registrable domain
    # (localhost:3000 ↔ localhost:5050). Use "None" for true cross-site setups.
    COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "Lax")
    COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN") or None
    AUTH_COOKIE_MAX_AGE = int(os.environ.get("AUTH_COOKIE_MAX_AGE", str(7 * 24 * 3600)))
