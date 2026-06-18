"""
Small management CLI for deploys.

    python manage.py init-db        # create any missing tables (safe to re-run)
    python manage.py seed           # DROP everything and load sample data (dev only!)
    python manage.py seed-demo      # ADD N virtual users (non-destructive; N defaults to 40)
    python manage.py seed-demo 60   # ...with a custom count

On a fresh production database run `init-db` once to create the schema.
Do NOT run `seed` against real data — it drops tables. `seed-demo` is safe in
prod: it never drops and skips existing emails.
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


def seed_demo_cmd():
    from seed_demo import seed_demo
    count = 40
    if len(sys.argv) > 2:
        try:
            count = int(sys.argv[2])
        except ValueError:
            print("seed-demo: count must be an integer")
            sys.exit(1)
    seed_demo(count)


COMMANDS = {"init-db": init_db, "seed": seed, "seed-demo": seed_demo_cmd}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    fn = COMMANDS.get(cmd)
    if not fn:
        print(f"usage: python manage.py [{' | '.join(COMMANDS)}]")
        sys.exit(1)
    fn()
