"""
Non-destructive demo seeding — add N virtual, verified users (each with a
sport profile + Chicago-area location) so Find Partner / matching have data.

Safe to run against PRODUCTION:
  - never drops tables (unlike seed.py)
  - skips emails that already exist (idempotent — safe to re-run)
  - only inserts the sample courts if the courts table is empty

Run locally against the prod DB:
    cd backend && source .venv/bin/activate
    DATABASE_URL="<Render EXTERNAL database url>" python manage.py seed-demo
    DATABASE_URL="..." python manage.py seed-demo 60   # custom count
"""
import random
import re

from app import create_app
from extensions import db
from models import User, SportProfile, Court
from seed import SAMPLE_COURTS  # reuse the 8 real Chicago courts

FIRST_NAMES = [
    "Alex", "Maya", "Jordan", "Sofia", "Marcus", "Aisha", "Liam", "Nina",
    "Ethan", "Priya", "Diego", "Hannah", "Noah", "Yuki", "Omar", "Grace",
    "Leo", "Zoe", "Caleb", "Ivy", "Sam", "Lena", "Theo", "Mia",
    "Andre", "Kira", "Felix", "Aria", "Jonah", "Tara",
]
LAST_NAMES = [
    "Rivera", "Patel", "Williams", "Rodriguez", "Chen", "Johnson", "Nguyen",
    "Kim", "Garcia", "Park", "Silva", "Brooks", "Okafor", "Tanaka", "Hassan",
    "Lopez", "Murphy", "Cohen", "Ahmed", "Reed", "Flores", "Walsh", "Bauer",
    "Khan", "Ortiz", "Novak", "Diaz", "Foster",
]
SPORTS = ["Tennis", "Pickleball"]
NTRPS = ["2.5", "3.0", "3.0", "3.5", "3.5", "4.0", "4.5"]  # weighted toward mid
AVAILABILITY = [
    "Weekday evenings", "Weekends, mornings", "Afternoons, weekdays",
    "Mornings, weekends", "Evenings, weekends", "Weekday lunchtimes",
    "Flexible most days", "Saturday mornings",
]
NEIGHBORHOODS = [
    "The Loop, Chicago", "Lincoln Park, Chicago", "Wicker Park, Chicago",
    "River North, Chicago", "West Loop, Chicago", "Streeterville, Chicago",
    "Logan Square, Chicago", "Hyde Park, Chicago",
]
CENTER_LAT, CENTER_LNG = 41.8881, -87.6298  # downtown Chicago


def _ensure_courts():
    if Court.query.first():
        return
    for slug, name, addr, lat, lng, primary, sports, count, surface, lights in SAMPLE_COURTS:
        db.session.add(Court(
            slug=slug, name=name, address=addr, lat=lat, lng=lng,
            primary_sport=primary, sports=sports, court_count=count,
            surface=surface, lights=lights,
        ))
    db.session.commit()


def _handle(first, last, i):
    base = re.sub(r"[^a-z0-9]", "", f"{first}{last}".lower())[:14]
    return f"@{base}{i}"


def seed_demo(count=40):
    app = create_app()
    with app.app_context():
        _ensure_courts()
        court_ids = [c.id for c in Court.query.all()]
        rng = random.Random(42)  # reproducible
        created = 0
        for i in range(1, count + 1):
            first = rng.choice(FIRST_NAMES)
            last = rng.choice(LAST_NAMES)
            email = f"{first.lower()}.{last.lower()}{i}@demo.tryrallypoint.com"
            if User.query.filter_by(email=email).first():
                continue
            sport = rng.choice(SPORTS)
            user = User(
                email=email,
                name=f"{first} {last}",
                handle=_handle(first, last, i),
                primary_sport=sport,
                location=rng.choice(NEIGHBORHOODS),
                lat=round(CENTER_LAT + rng.uniform(-0.06, 0.06), 3),
                lng=round(CENTER_LNG + rng.uniform(-0.06, 0.06), 3),
                email_verified=True,
                bio=f"Looking for {sport.lower()} hits around Chicago. Always up for a rally.",
            )
            user.set_password("rally1234")
            user.sport_profiles.append(SportProfile(
                sport=sport,
                ntrp=rng.choice(NTRPS),
                availability_summary=rng.choice(AVAILABILITY),
                home_court_id=rng.choice(court_ids) if court_ids else None,
            ))
            db.session.add(user)
            created += 1
        db.session.commit()
        print(
            f"seed-demo: added {created} demo users "
            f"(skipped {count - created} already-present). "
            f"Total users now: {User.query.count()}. Demo password: rally1234"
        )


def unseed_demo():
    """Remove the virtual demo users (email @demo.tryrallypoint.com) and every
    row that references them — sessions, AI match logs, plus their own sport
    profiles / availability (ORM cascade). Real users are NEVER touched (they
    have other email domains). Idempotent: safe to re-run.

    Run against prod the same way as seed-demo:
        DATABASE_URL="<Render EXTERNAL url>" python manage.py unseed-demo
    """
    from sqlalchemy import or_
    from models import Session, AIMatchLog

    app = create_app()
    with app.app_context():
        demo = User.query.filter(User.email.like("%@demo.tryrallypoint.com")).all()
        ids = [u.id for u in demo]
        if not ids:
            print("unseed-demo: no demo users found — nothing to remove.")
            return

        # Delete rows that reference the demo users BEFORE the users themselves,
        # so FK constraints (enforced on Postgres) are never violated.
        logs = AIMatchLog.query.filter(
            or_(AIMatchLog.viewer_id.in_(ids), AIMatchLog.candidate_id.in_(ids))
        ).delete(synchronize_session=False)
        sess = Session.query.filter(
            or_(Session.host_id.in_(ids), Session.guest_id.in_(ids))
        ).delete(synchronize_session=False)

        for u in demo:
            db.session.delete(u)  # cascades sport_profiles + availability
        db.session.commit()
        print(
            f"unseed-demo: removed {len(ids)} demo users "
            f"(+{sess} sessions, {logs} match-logs). "
            f"Users left: {User.query.count()}."
        )
