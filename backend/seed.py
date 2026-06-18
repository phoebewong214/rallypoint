"""
Drop the DB, recreate it, and load enough sample data for the frontend
to render every page meaningfully.

Run:  python seed.py
"""
from datetime import datetime, timedelta
from app import create_app
from extensions import db
from models import (
    User, SportProfile, Court, Session, SessionStatus,
    AvailabilitySlot, FeedPost, FeedType,
)


SAMPLE_USERS = [
    # email, name, primary_sport, location, lat, lng, tennis_ntrp, pickle_ntrp, avail
    ("alex@rally.app",   "Alex Rivera",     "Pickleball", "The Loop, Chicago",      41.8819, -87.6278, "3.0", "3.5", "Weekday evenings, Sat morning"),
    ("maya@rally.app",   "Maya Patel",      "Pickleball", "Streeterville, Chicago", 41.8932, -87.6212, None,  "3.5", "Weekends, mornings"),
    ("jordan@rally.app", "Jordan Williams", "Tennis",     "River North, Chicago",   41.8924, -87.6340, "4.0", None,  "Weekday evenings"),
    ("sofia@rally.app",  "Sofia Rodriguez", "Pickleball", "Wicker Park, Chicago",   41.9088, -87.6796, None,  "3.0", "Afternoons, weekdays"),
    ("marcus@rally.app", "Marcus Chen",     "Tennis",     "Lincoln Park, Chicago",  41.9214, -87.6513, "4.5", None,  "Mornings, weekends"),
    ("aisha@rally.app",  "Aisha Johnson",   "Pickleball", "West Loop, Chicago",     41.8835, -87.6534, None,  "3.5", "Evenings, weekends"),
]

# Real Chicago courts (lat/lng verified) — matches the frontend Courts page.
SAMPLE_COURTS = [
    ("lincoln-park",     "Lincoln Park Cultural Center Tennis Courts", "2045 N Lincoln Park West · Chicago", 41.9220, -87.6350, "tennis",     "Tennis,Pickleball", 6,  "Outdoor · Hard",            True),
    ("grant-park",       "Grant Park Tennis Center",                    "331 E Randolph St · Chicago",        41.8835, -87.6188, "tennis",     "Tennis",            12, "Outdoor · Hard",            True),
    ("maggie-daley",     "Maggie Daley Park Tennis",                    "337 E Randolph St · Chicago",        41.8855, -87.6178, "pickleball", "Tennis,Pickleball", 4,  "Outdoor · Resurfaced 2024", True),
    ("wicker-park",      "Wicker Park Tennis Courts",                   "1425 N Damen Ave · Chicago",         41.9080, -87.6790, "tennis",     "Tennis",            4,  "Outdoor · Hard",            False),
    ("welles-park",      "Welles Park",                                 "2333 W Sunnyside Ave · Chicago",     41.9647, -87.6892, "pickleball", "Tennis,Pickleball", 8,  "Outdoor · Hard",            True),
    ("lake-shore-park",  "Lake Shore Park",                             "808 N Lake Shore Dr · Chicago",      41.8974, -87.6191, "pickleball", "Pickleball",        2,  "Outdoor · Resurfaced 2023", True),
    ("smith-park",       "Smith Park",                                  "2526 W Grand Ave · Chicago",         41.8909, -87.6918, "pickleball", "Pickleball",        4,  "Indoor · Climate-controlled", True),
    ("mcguane-park",     "McGuane Park",                                "2901 S Poplar Ave · Chicago",        41.8400, -87.6580, "pickleball", "Tennis,Pickleball", 4,  "Outdoor · Hard",            False),
]


def _seed():
    db.drop_all()
    db.create_all()

    # Courts
    courts = {}
    for slug, name, addr, lat, lng, primary, sports, count, surface, lights in SAMPLE_COURTS:
        c = Court(slug=slug, name=name, address=addr, lat=lat, lng=lng,
                  primary_sport=primary, sports=sports, court_count=count,
                  surface=surface, lights=lights)
        db.session.add(c)
        courts[slug] = c
    db.session.flush()

    # Users + sport profiles
    users = {}
    for email, name, primary, loc, lat, lng, tennis_ntrp, pickle_ntrp, avail in SAMPLE_USERS:
        u = User(email=email, name=name, handle="@" + email.split("@")[0],
                 primary_sport=primary, location=loc, lat=lat, lng=lng,
                 email_verified=True,
                 bio=f"Capstone-era player picking up {primary.lower()} this semester.")
        u.set_password("rally1234")
        db.session.add(u)
        db.session.flush()
        if tennis_ntrp:
            db.session.add(SportProfile(user_id=u.id, sport="Tennis",
                                        ntrp=tennis_ntrp, availability_summary=avail,
                                        home_court_id=courts["grant-park"].id))
        if pickle_ntrp:
            db.session.add(SportProfile(user_id=u.id, sport="Pickleball",
                                        ntrp=pickle_ntrp, availability_summary=avail,
                                        home_court_id=courts["lincoln-park"].id))
        users[email] = u
    db.session.flush()

    alex = users["alex@rally.app"]
    maya = users["maya@rally.app"]
    jordan = users["jordan@rally.app"]
    marcus = users["marcus@rally.app"]
    aisha = users["aisha@rally.app"]
    sofia = users["sofia@rally.app"]

    # Availability heatmap for Alex (matches the Profile page demo)
    # 0=unavail, 1=maybe, 2=available
    grid = [
        # MORN          AFT           EVE
        ("MORN", [0, 0, 0, 0, 0, 2, 2]),
        ("AFT",  [0, 0, 1, 0, 1, 1, 1]),
        ("EVE",  [0, 2, 0, 2, 0, 1, 0]),
    ]
    for band, row in grid:
        for dow, status in enumerate(row):
            if status:
                db.session.add(AvailabilitySlot(user_id=alex.id, day_of_week=dow,
                                                time_band=band, status=status))

    # Sessions
    now = datetime.utcnow()
    sessions = [
        Session(host_id=alex.id,   guest_id=maya.id,   court_id=courts["lincoln-park"].id,
                sport="Pickleball", scheduled_at=now + timedelta(days=1, hours=2),
                status=SessionStatus.CONFIRMED.value),
        Session(host_id=alex.id,   guest_id=jordan.id, court_id=courts["grant-park"].id,
                sport="Tennis",     scheduled_at=now + timedelta(days=3, hours=10),
                status=SessionStatus.PENDING.value),
        Session(host_id=marcus.id, guest_id=alex.id,   court_id=courts["wicker-park"].id,
                sport="Tennis",     scheduled_at=now + timedelta(days=6),
                status=SessionStatus.REQUESTED.value,
                note="Up for an early Sunday match? I'll bring new balls."),
        Session(host_id=alex.id,   guest_id=maya.id,   court_id=courts["lincoln-park"].id,
                sport="Pickleball", scheduled_at=now - timedelta(days=5),
                status=SessionStatus.COMPLETED.value, result="W", score="11-7, 11-9"),
        Session(host_id=alex.id,   guest_id=jordan.id, court_id=courts["grant-park"].id,
                sport="Tennis",     scheduled_at=now - timedelta(days=7),
                status=SessionStatus.COMPLETED.value, result="W", score="6-3, 4-6, 7-5"),
        Session(host_id=alex.id,   guest_id=sofia.id,  court_id=courts["lincoln-park"].id,
                sport="Pickleball", scheduled_at=now - timedelta(days=14),
                status=SessionStatus.COMPLETED.value, result="L", score="9-11, 7-11"),
    ]
    db.session.add_all(sessions)

    # Feed posts
    db.session.add_all([
        FeedPost(author_id=maya.id, type=FeedType.MATCH_WIN.value,
                 text="Third shot drop is finally clicking. Took two sets vs Alex this morning.",
                 likes=24, comments=5, shares=2),
        FeedPost(author_id=jordan.id, type=FeedType.LFG.value,
                 text="Anyone up for a hit Saturday morning? Looking for 3.5-4.0 level.",
                 likes=7, comments=4, shares=1),
        FeedPost(author_id=marcus.id, type=FeedType.ACHIEVEMENT.value,
                 text="Five in a row. Don't @ me about the 5-7 third set last night.",
                 likes=41, comments=12, shares=3),
    ])

    db.session.commit()
    print(f"Seeded {len(users)} users, {len(courts)} courts, {len(sessions)} sessions.")
    print("Login as any user with password: rally1234")


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        _seed()
