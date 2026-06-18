"""
Small management CLI for deploys.

    python manage.py init-db   # create any missing tables (safe to re-run)
    python manage.py seed      # DROP everything and load sample data (dev only!)

On a fresh production database run `init-db` once (e.g. in the Render Shell)
to create the schema. Do NOT run `seed` against real data — it drops tables.
"""
import sys

from app import create_app
from extensions import db
import models  # noqa: F401 — register models on db.metadata


def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        print("init-db: tables created (existing tables left untouched).")


def seed():
    # Defer to the existing seed script (drops + recreates + sample data).
    from seed import _seed
    app = create_app()
    with app.app_context():
        _seed()


COMMANDS = {"init-db": init_db, "seed": seed}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    fn = COMMANDS.get(cmd)
    if not fn:
        print(f"usage: python manage.py [{' | '.join(COMMANDS)}]")
        sys.exit(1)
    fn()
