"""
Tests for court appointments (open games), the waitlist queue, and check-ins.
"""
from datetime import datetime, timedelta

from extensions import db
from models import Court

# Relative to now so the future-time validation keeps passing over time.
_FUTURE = (datetime.utcnow() + timedelta(days=30)).replace(microsecond=0).isoformat()


def _signup(client, email):
    r = client.post("/api/auth/signup", json={"email": email, "password": "rally1234", "name": email.split("@")[0].title()})
    assert r.status_code == 201, r.get_json()
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


def _make_court(app, slug="grant-park"):
    with app.app_context():
        db.session.add(Court(
            slug=slug, name="Grant Park Tennis Center", address="331 E Randolph St",
            lat=41.8835, lng=-87.6188, primary_sport="tennis", sports="Tennis",
            court_count=12, surface="Hard", lights=True,
        ))
        db.session.commit()


def _create(client, headers, max_players=2):
    r = client.post("/api/courts/grant-park/appointments", headers=headers,
                    json={"sport": "Tennis", "scheduledAt": _FUTURE, "maxPlayers": max_players})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["appointment"]


def test_create_join_waitlist_and_promote(client, app):
    _make_court(app)
    a = _signup(client, "a@rally.app")
    appt = _create(client, a, max_players=2)
    aid = appt["id"]
    assert appt["confirmedCount"] == 1 and appt["isHost"] is True  # creator auto-joined

    b = _signup(client, "b@rally.app")
    rb = client.post(f"/api/appointments/{aid}/join", headers=b).get_json()["appointment"]
    assert rb["confirmedCount"] == 2 and rb["joined"] is True and rb["spotsLeft"] == 0

    c = _signup(client, "c@rally.app")
    rc = client.post(f"/api/appointments/{aid}/join", headers=c).get_json()["appointment"]
    assert rc["waitlisted"] is True and rc["queuePosition"] == 1

    # b leaves a confirmed spot → c is promoted off the waitlist
    assert client.post(f"/api/appointments/{aid}/leave", headers=b).status_code == 200
    detail = client.get("/api/courts/grant-park", headers=c).get_json()["court"]
    appt_c = detail["appointments"][0]
    assert appt_c["confirmedCount"] == 2
    assert appt_c["joined"] is True and appt_c["waitlisted"] is False


def test_host_cancel_only(client, app):
    _make_court(app)
    a = _signup(client, "host@rally.app")
    b = _signup(client, "other@rally.app")
    appt = _create(client, a)
    assert client.delete(f"/api/appointments/{appt['id']}", headers=b).status_code == 403
    assert client.delete(f"/api/appointments/{appt['id']}", headers=a).status_code == 200


def test_checkin_drives_here_now(client, app):
    _make_court(app)
    a = _signup(client, "ci@rally.app")
    # before
    d0 = client.get("/api/courts/grant-park", headers=a).get_json()["court"]
    assert d0["hereNow"] == 0 and d0["checkedIn"] is False
    # check in
    assert client.post("/api/courts/grant-park/checkin", headers=a, json={}).status_code == 200
    d1 = client.get("/api/courts/grant-park", headers=a).get_json()["court"]
    assert d1["hereNow"] == 1 and d1["checkedIn"] is True
    # list endpoint reflects it too
    gp = next(c for c in client.get("/api/courts", headers=a).get_json()["courts"] if c["id"] == "grant-park")
    assert gp["hereNow"] == 1 and gp["openGames"] == 0
    # check out
    assert client.delete("/api/courts/grant-park/checkin", headers=a).status_code == 200
    d2 = client.get("/api/courts/grant-park", headers=a).get_json()["court"]
    assert d2["hereNow"] == 0 and d2["checkedIn"] is False


def test_checkin_rejected_when_far_away(client, app):
    _make_court(app)
    a = _signup(client, "far@rally.app")
    # ~LA coords, far from Chicago court
    r = client.post("/api/courts/grant-park/checkin", headers=a, json={"lat": 34.05, "lng": -118.24})
    assert r.status_code == 400
