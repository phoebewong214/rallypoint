"""
Centralized config loaded from environment.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-not-for-prod")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{BASE_DIR / 'rallypoint.db'}"
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

    # Lifetimes for single-use action tokens (minutes).
    VERIFY_TOKEN_TTL_MIN = int(os.environ.get("VERIFY_TOKEN_TTL_MIN", str(60 * 24)))
    RESET_TOKEN_TTL_MIN = int(os.environ.get("RESET_TOKEN_TTL_MIN", "60"))
