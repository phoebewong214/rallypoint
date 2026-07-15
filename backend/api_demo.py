"""
Milestone 2 — live API demonstration harness.

Exercises the RallyPoint REST API end-to-end against a fresh on-disk SQLite
database and, after EVERY write operation, prints the resulting change in the
database (which tables gained/lost rows, and the affected row itself). This is
the reproducible evidence behind docs/MILESTONE_2_TEST_RESULTS.md:

    request  ->  HTTP response  ->  database delta

Run:  .venv/bin/python api_demo.py
      .venv/bin/python api_demo.py > ../docs/api_demo_output.txt

It is self-contained: it builds its own DB, seeds two players + one court + an
admin, and never touches the dev rallypoint.db. Rate limiting is disabled so the
script can hit auth endpoints repeatedly.
"""
import json
import os
import tempfile
from datetime import datetime, timedelta

# Point the app at a throwaway demo DB before importing config/app.
_DB_PATH = os.path.join(tempfile.gettempdir(), "rallypoint_api_demo.db")
if os.path.exists(_DB_PATH):
    os.remove(_DB_PATH)
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"

from app import create_app                     # noqa: E402
from config import Config                       # noqa: E402
from extensions import db                       # noqa: E402
from models import User, SportProfile, Court    # noqa: E402

# Every table we track for the "database delta" evidence lines.
TABLES = [
    "users", "sport_profiles", "availability_slots", "courts", "court_favorites",
    "court_checkins", "court_appointments", "appointment_participants",
    "saved_players", "sessions", "game_invites", "time_proposals",
    "ai_match_logs", "user_reports", "support_tickets",
]

FUTURE = (datetime.utcnow() + timedelta(days=7)).replace(microsecond=0).isoformat()
FUTURE2 = (datetime.utcnow() + timedelta(days=8)).replace(microsecond=0).isoformat()


class DemoConfig(Config):
    TESTING = True
    RATELIMIT_ENABLED = False
    SECRET_KEY = "demo-secret"


app = create_app(DemoConfig)
client = app.test_client()

_step = 0


def counts() -> dict:
    """Row count per tracked table (a snapshot of DB state)."""
    with app.app_context():
        out = {}
        for t in TABLES:
            out[t] = db.session.execute(db.text(f"SELECT COUNT(*) FROM {t}")).scalar()
        return out


def delta(before: dict, after: dict) -> str:
    """Human-readable diff of two count snapshots."""
    changes = []
    for t in TABLES:
        d = after[t] - before[t]
        if d:
            changes.append(f"{t} {before[t]}->{after[t]} ({'+' if d > 0 else ''}{d} row{'s' if abs(d) != 1 else ''})")
    return "; ".join(changes) if changes else "(no row-count change — in-place UPDATE or read-only)"


def j(obj) -> str:
    return json.dumps(obj, indent=2, default=str)


def watch_row(sql: str, params: dict):
    """Fetch one row as a dict for before/after comparison of in-place UPDATEs."""
    with app.app_context():
        row = db.session.execute(db.text(sql), params).mappings().first()
        return dict(row) if row else None


def call(title, method, path, *, headers=None, body=None, note=None,
         db_evidence=True, show_resp=True, watch=None):
    """Make one API call and print request -> response -> DB delta.

    watch = (sql, params) — a query returning one row; its column values are
    captured before and after so in-place UPDATEs (which don't change row
    counts) still show concrete evidence the database changed.
    """
    global _step
    _step += 1
    before = counts() if db_evidence else None
    w_before = watch_row(*watch) if watch else None
    fn = getattr(client, method.lower())
    kwargs = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    rsp = fn(path, **kwargs)
    after = counts() if db_evidence else None
    w_after = watch_row(*watch) if watch else None

    print(f"\n{'=' * 78}")
    print(f"STEP {_step}: {title}")
    print(f"{'=' * 78}")
    print(f"  {method.upper()} {path}   ->  HTTP {rsp.status_code}")
    if note:
        print(f"  note: {note}")
    if body is not None:
        print("  request body:")
        for line in j(body).splitlines():
            print(f"    {line}")
    payload = rsp.get_json()
    if show_resp and payload is not None:
        text = j(payload)
        # Trim very long list responses so the transcript stays readable.
        lines = text.splitlines()
        if len(lines) > 40:
            lines = lines[:40] + [f"    ... ({len(lines) - 40} more lines)"]
        print("  response body:")
        for line in lines:
            print(f"    {line}")
    if db_evidence:
        print(f"  DB DELTA: {delta(before, after)}")
    if watch:
        print(f"  ROW BEFORE: {w_before}")
        print(f"  ROW AFTER:  {w_after}")
    return rsp


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def seed():
    """Create the demo dataset directly (two players + one court + admin)."""
    with app.app_context():
        alex = User(email="alex@rally.app", name="Alex Rivera", handle="@alex",
                    primary_sport="Pickleball", location="The Loop, Chicago",
                    lat=41.8819, lng=-87.6278, is_admin=True, email_verified=True,
                    bio="Consistent baseliner, love long rallies and weekend games.")
        alex.set_password("rally1234")
        alex.sport_profiles.append(SportProfile(sport="Pickleball", ntrp="3.5"))
        maya = User(email="maya@rally.app", name="Maya Patel", handle="@maya",
                    primary_sport="Pickleball", location="Streeterville, Chicago",
                    lat=41.8932, lng=-87.6212, email_verified=True,
                    bio="Also a steady baseliner who enjoys relaxed weekend rallies.")
        maya.set_password("rally1234")
        maya.sport_profiles.append(SportProfile(sport="Pickleball", ntrp="3.5"))
        db.session.add_all([alex, maya])
        db.session.add(Court(
            slug="grant-park", name="Grant Park Tennis Center",
            address="331 E Randolph St, Chicago", lat=41.8835, lng=-87.6188,
            primary_sport="tennis", sports="Tennis,Pickleball", court_count=12,
            surface="Outdoor · Hard", lights=True))
        db.session.commit()
        return alex.id, maya.id


def main():
    print("RallyPoint API — Milestone 2 live demonstration")
    print(f"Generated: {datetime.utcnow().isoformat()}Z  (UTC)")
    print(f"Database:  {_DB_PATH} (fresh SQLite, seeded with 2 users + 1 court)")
    with app.app_context():
        db.create_all()
    print(f"\nInitial DB state (empty tables): {counts()}")

    alex_id, maya_id = seed()
    print(f"After seed:       {counts()}")

    # ---- AUTH ---------------------------------------------------------------
    r = call("Sign up a brand-new account (INSERT users + sport_profiles)",
             "POST", "/api/auth/signup",
             body={"email": "casey@rally.app", "password": "rally1234",
                   "name": "Casey Nguyen", "sport": "Pickleball", "ntrp": "3.5",
                   "location": "West Loop, Chicago"})
    casey = r.get_json()
    casey_id, casey_tok = casey["user"]["id"], casey["token"]

    r = call("Log in as the seeded admin (no DB write — issues a JWT)",
             "POST", "/api/auth/login",
             body={"email": "alex@rally.app", "password": "rally1234"})
    alex_tok = r.get_json()["token"]
    ah = bearer(alex_tok)

    call("Reject a bad login (401, no write)", "POST", "/api/auth/login",
         body={"email": "alex@rally.app", "password": "wrong-password"})

    call("Validation failure returns a structured 422 (no write)",
         "POST", "/api/auth/signup",
         body={"email": "not-an-email", "password": "short", "name": ""})

    call("Who am I? (GET /auth/me, read-only)", "GET", "/api/auth/me", headers=ah)

    call("Update my profile + weekly availability (UPDATE users, INSERT slots)",
         "PATCH", "/api/auth/me", headers=ah,
         body={"bio": "4.0-ish dinker, quick hands at the net.",
               "location": "Gold Coast, Chicago",
               "availability": [
                   {"dayOfWeek": 5, "timeBand": "MORN", "status": 2},
                   {"dayOfWeek": 6, "timeBand": "MORN", "status": 2},
                   {"dayOfWeek": 2, "timeBand": "EVE", "status": 1}]},
         watch=(f"SELECT id, location, bio FROM users WHERE id={alex_id}", {}))

    # ---- PLAYERS / MATCHING -------------------------------------------------
    call("AI-ranked partner list for the viewer (read-only GET; scores inline)",
         "GET", "/api/players?sport=Pickleball", headers=ah)

    call("Save a player (INSERT saved_players)",
         "POST", f"/api/players/{maya_id}/save", headers=ah)

    call("Un-save the player (DELETE saved_players)",
         "DELETE", f"/api/players/{maya_id}/save", headers=ah)

    call("File a trust & safety report against a player (INSERT user_reports)",
         "POST", f"/api/players/{casey_id}/report", headers=ah,
         body={"reason": "no_show", "details": "Booked a game then never showed."})

    # ---- AI MATCH REASON ----------------------------------------------------
    call("On-demand AI match reason, cached (INSERT ai_match_logs)",
         "POST", "/api/ai/match-reason", headers=ah,
         body={"candidateId": maya_id, "sport": "Pickleball"})

    call("Same call again — upserts the cached row (no new row)",
         "POST", "/api/ai/match-reason", headers=ah,
         body={"candidateId": maya_id, "sport": "Pickleball"})

    # ---- SESSIONS (request -> accept -> reschedule -> cancel) ---------------
    r = call("Alex requests a game with Maya (INSERT sessions, status=pending)",
             "POST", "/api/sessions", headers=ah,
             body={"guestId": maya_id, "sport": "Pickleball",
                   "scheduledAt": FUTURE, "court": "grant-park",
                   "note": "Sat morning hit?"})
    sid = r.get_json()["session"]["id"]
    maya_tok = client.post("/api/auth/login",
                           json={"email": "maya@rally.app", "password": "rally1234"}
                           ).get_json()["token"]
    mh = bearer(maya_tok)

    call("Duplicate request is rejected (409, no new row)",
         "POST", "/api/sessions", headers=ah,
         body={"guestId": maya_id, "sport": "Pickleball", "scheduledAt": FUTURE2})

    call("Maya accepts the request (UPDATE sessions status -> confirmed)",
         "POST", f"/api/sessions/{sid}/accept", headers=mh,
         watch=(f"SELECT id, host_id, guest_id, status, scheduled_at FROM sessions WHERE id={sid}", {}))

    call("Maya reschedules — re-opens to Alex (UPDATE sessions time + status)",
         "POST", f"/api/sessions/{sid}/reschedule", headers=mh,
         body={"scheduledAt": FUTURE2},
         watch=(f"SELECT id, host_id, guest_id, status, scheduled_at FROM sessions WHERE id={sid}", {}))

    call("List sessions from Alex's perspective (read-only, viewer-relative)",
         "GET", "/api/sessions", headers=ah)

    call("Cancel the session — kept as a trace (UPDATE status -> cancelled)",
         "POST", f"/api/sessions/{sid}/cancel", headers=ah,
         watch=(f"SELECT id, status FROM sessions WHERE id={sid}", {}))

    # ---- COURTS + CHECK-INS + APPOINTMENTS ----------------------------------
    call("List courts with real distance + activity counts (read-only)",
         "GET", "/api/courts?sport=Pickleball", headers=ah)

    call("Favorite a court (INSERT court_favorites)",
         "POST", "/api/courts/grant-park/favorite", headers=ah)

    call("Check in 'I'm here now' (INSERT court_checkins)",
         "POST", "/api/courts/grant-park/checkin", headers=ah,
         body={"lat": 41.8836, "lng": -87.6189})

    r = call("Create an open game at the court (INSERT court_appointments + participant)",
             "POST", "/api/courts/grant-park/appointments", headers=ah,
             body={"sport": "Pickleball", "scheduledAt": FUTURE, "maxPlayers": 2})
    aid = r.get_json()["appointment"]["id"]

    call("Maya joins the open game (INSERT appointment_participants)",
         "POST", f"/api/appointments/{aid}/join", headers=mh)

    call("Casey joins a full game -> waitlisted (INSERT participant, waitlisted)",
         "POST", f"/api/appointments/{aid}/join", headers=bearer(casey_tok))

    call("Maya leaves -> Casey promoted off the waitlist (DELETE + promote)",
         "POST", f"/api/appointments/{aid}/leave", headers=mh)

    call("Check out of the court (DELETE court_checkins)",
         "DELETE", "/api/courts/grant-park/checkin", headers=ah)

    # ---- TWO-PHASE INVITES --------------------------------------------------
    r = call("Alex invites Maya with a time WINDOW (INSERT game_invites + time_proposals)",
             "POST", "/api/invites", headers=ah,
             body={"inviteeId": maya_id, "sport": "Pickleball",
                   "startAt": FUTURE, "endAt": FUTURE2, "court": "grant-park"})
    iid = r.get_json()["invite"]["id"]

    call("Maya confirms she'll play (UPDATE game_invites phase -> settling)",
         "POST", f"/api/invites/{iid}/confirm-opponent", headers=mh,
         watch=(f"SELECT id, phase FROM game_invites WHERE id={iid}", {}))

    call("Maya proposes a SPECIFIC time (INSERT time_proposals, supersede old)",
         "POST", f"/api/invites/{iid}/propose-time", headers=mh,
         body={"startAt": FUTURE})

    call("Alex accepts the time -> materializes a confirmed session "
         "(INSERT sessions, UPDATE invite phase -> confirmed)",
         "POST", f"/api/invites/{iid}/accept-time", headers=ah,
         watch=(f"SELECT id, phase, session_id FROM game_invites WHERE id={iid}", {}))

    # ---- SUPPORT ------------------------------------------------------------
    call("Escalate to a human -> persisted ticket (INSERT support_tickets)",
         "POST", "/api/support/escalate", headers=ah,
         body={"message": "I can't change my home court — is that a bug?"})

    # ---- ADMIN (alex is an admin) -------------------------------------------
    call("Admin dashboard overview (read-only aggregate)",
         "GET", "/api/admin/overview", headers=ah)

    call("Admin lists users (read-only)", "GET", "/api/admin/users", headers=ah)

    call("Admin lists the trust & safety report queue (read-only)",
         "GET", "/api/admin/reports", headers=ah)

    # find the open report id
    reports = client.get("/api/admin/reports", headers=ah).get_json()
    rid = reports["reports"][0]["id"] if reports.get("reports") else None
    if rid:
        call("Admin reviews the report + suspends the account "
             "(UPDATE user_reports + users.is_active)",
             "PATCH", f"/api/admin/reports/{rid}", headers=ah,
             body={"status": "reviewed", "note": "Confirmed no-show pattern.",
                   "suspend": True},
             watch=(f"SELECT r.id, r.status, u.is_active AS reported_is_active "
                    f"FROM user_reports r JOIN users u ON u.id = r.reported_id "
                    f"WHERE r.id={rid}", {}))

    tickets = client.get("/api/admin/support", headers=ah).get_json()
    tid = tickets["tickets"][0]["id"] if tickets.get("tickets") else None
    if tid:
        call("Admin closes the support ticket (UPDATE support_tickets status)",
             "PATCH", f"/api/admin/support/{tid}", headers=ah,
             body={"status": "closed", "note": "Explained the fix over email."},
             watch=(f"SELECT id, status, resolution_note FROM support_tickets WHERE id={tid}", {}))

    print(f"\n{'=' * 78}")
    print("FINAL DB STATE")
    print(f"{'=' * 78}")
    for t, c in counts().items():
        print(f"  {t:28} {c}")
    print(f"\nTotal API calls exercised: {_step}")
    print("Demo complete — every write above shows its database delta inline.")


if __name__ == "__main__":
    main()
