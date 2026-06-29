"""
Small management CLI for deploys.

    python manage.py init-db        # create any missing tables (safe to re-run)
    python manage.py seed           # DROP everything and load sample data (dev only!)
    python manage.py seed-demo      # ADD N virtual users (non-destructive; N defaults to 40)
    python manage.py seed-demo 60   # ...with a custom count
    python manage.py unseed-demo    # REMOVE the virtual demo users (@demo.tryrallypoint.com)
    python manage.py set-admin <email>    # grant admin-dashboard access to a user
    python manage.py unset-admin <email>  # revoke it
    python manage.py create-admin <email> <password> ["Name"]  # make a dedicated admin account

Set BOOTSTRAP_ADMIN_EMAIL (env, comma-separated) to auto-promote those accounts
to admin on every `init-db` — the shell-less way to grant the first prod admin.

On a fresh production database run `init-db` once to create the schema.
Do NOT run `seed` against real data — it drops tables. `seed-demo` and
`unseed-demo` are both safe in prod: they only touch the @demo.tryrallypoint.com
accounts and never drop tables.
"""
import sys

from app import create_app
from extensions import db
import models  # noqa: F401 — register models on db.metadata


# Columns added after a table's first deploy. create_all() never alters an
# existing table, and our deploy runs init-db (not `flask db upgrade`), so each
# new column is added idempotently here. Safe to re-run: existing columns are
# skipped. Works on both SQLite (dev) and Postgres (prod).
_ENSURE_COLUMNS = {
    "users": {
        "bio_embedding": "TEXT",
        "is_admin": "BOOLEAN NOT NULL DEFAULT FALSE",
    },
}


def _ensure_columns():
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())
    for table, columns in _ENSURE_COLUMNS.items():
        if table not in existing_tables:
            continue  # create_all() just built it with every column already.
        present = {c["name"] for c in inspector.get_columns(table)}
        for name, ddl in columns.items():
            if name in present:
                continue
            db.session.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {name} {ddl}'))
            db.session.commit()
            print(f"init-db: added missing column {table}.{name}")


def _bootstrap_admins():
    """Promote any email(s) in BOOTSTRAP_ADMIN_EMAIL to admin on startup.

    Lets the first admin be granted on a shell-less host (Render free tier) by
    setting one env var — no SQL needed. Comma-separated for multiple. Idempotent;
    only promotes accounts that already exist (sign the account up first). Never
    fails the deploy: a bad value just logs and is skipped.
    """
    import os
    raw = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "")
    emails = [e.strip().lower() for e in raw.split(",") if e.strip()]
    if not emails:
        return
    from models import User
    for email in emails:
        try:
            user = User.query.filter(db.func.lower(User.email) == email).first()
            if not user:
                print(f"init-db: BOOTSTRAP_ADMIN_EMAIL {email!r} has no account yet — skipped")
                continue
            if not user.is_admin or not user.email_verified:
                user.is_admin = True
                user.email_verified = True
                db.session.commit()
                print(f"init-db: bootstrapped admin {user.email}")
        except Exception as e:  # noqa: BLE001 — never block startup on this
            db.session.rollback()
            print(f"init-db: bootstrap-admin failed for {email!r}: {e}")


def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        _ensure_columns()
        _bootstrap_admins()
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


def unseed_demo_cmd():
    from seed_demo import unseed_demo
    unseed_demo()


def _set_admin(make_admin: bool):
    if len(sys.argv) < 3:
        verb = "set-admin" if make_admin else "unset-admin"
        print(f"usage: python manage.py {verb} <email>")
        sys.exit(1)
    email = sys.argv[2].strip().lower()
    from models import User
    app = create_app()
    with app.app_context():
        user = User.query.filter(db.func.lower(User.email) == email).first()
        if not user:
            print(f"set-admin: no user with email {email!r}")
            sys.exit(1)
        user.is_admin = make_admin
        db.session.commit()
        state = "now an admin" if make_admin else "no longer an admin"
        print(f"set-admin: {user.email} ({user.name}) is {state}.")


def set_admin_cmd():
    _set_admin(True)


def unset_admin_cmd():
    _set_admin(False)


def _unique_handle(base: str) -> str:
    """Slugify into a unique @handle (mirrors routes.auth._unique_handle)."""
    import re
    from models import User
    slug = re.sub(r"[^a-z0-9]+", "", base.lower())[:20] or "admin"
    candidate = "@" + slug
    n = 2
    while User.query.filter_by(handle=candidate).first():
        suffix = str(n)
        candidate = "@" + slug[: 20 - len(suffix)] + suffix
        n += 1
    return candidate


def create_admin_cmd():
    """Create (or promote) a dedicated admin account — verified + is_admin set."""
    if len(sys.argv) < 4:
        print('usage: python manage.py create-admin <email> <password> ["Display Name"]')
        sys.exit(1)
    email = sys.argv[2].strip().lower()
    password = sys.argv[3]
    name = sys.argv[4].strip() if len(sys.argv) > 4 else "RallyPoint Admin"
    from models import User
    app = create_app()
    with app.app_context():
        user = User.query.filter(db.func.lower(User.email) == email).first()
        if user:
            # Existing account → promote + reset password so it's usable.
            user.is_admin = True
            user.email_verified = True
            user.set_password(password)
            db.session.commit()
            print(f"create-admin: promoted existing {user.email} to admin (password reset).")
            return
        user = User(
            email=email,
            name=name,
            handle=_unique_handle(email.split("@")[0]),
            email_verified=True,
            is_admin=True,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        print(f"create-admin: created admin {user.email} ({user.name}, {user.handle}).")


def build_courts_cmd():
    from import_courts import build
    build()


def import_courts_cmd():
    from import_courts import load
    load(only_if_empty="--if-empty" in sys.argv)


COMMANDS = {
    "init-db": init_db,
    "seed": seed,
    "seed-demo": seed_demo_cmd,
    "unseed-demo": unseed_demo_cmd,
    "build-courts": build_courts_cmd,
    "import-courts": import_courts_cmd,
    "set-admin": set_admin_cmd,
    "unset-admin": unset_admin_cmd,
    "create-admin": create_admin_cmd,
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    fn = COMMANDS.get(cmd)
    if not fn:
        print(f"usage: python manage.py [{' | '.join(COMMANDS)}]")
        sys.exit(1)
    fn()
