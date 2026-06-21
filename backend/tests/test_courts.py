"""
Tests for the Courts endpoints: real viewer distance + favorites toggle.
"""
from extensions import db
from models import Court


def _signup(client, email, lat=None, lng=None):
    body = {"email": email, "password": "rally1234", "name": "Court Tester"}
    if lat is not None:
        body["lat"], body["lng"] = lat, lng
    r = client.post("/api/auth/signup", json=body)
    assert r.status_code == 201, r.get_json()
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


def _make_court(app, slug="grant-park", lat=41.8835, lng=-87.6188):
    with app.app_context():
        db.session.add(Court(
            slug=slug, name="Grant Park Tennis Center", address="331 E Randolph St",
            lat=lat, lng=lng, primary_sport="tennis", sports="Tennis",
            court_count=12, surface="Outdoor · Hard", lights=True,
        ))
        db.session.commit()


def test_list_returns_real_distance_and_fav_false(client, app):
    _make_court(app)
    h = _signup(client, "viewer@rally.app", lat=41.881, lng=-87.629)
    courts = client.get("/api/courts", headers=h).get_json()["courts"]
    assert len(courts) == 1
    assert courts[0]["fav"] is False
    assert isinstance(courts[0]["distance"], (int, float)) and courts[0]["distance"] > 0


def test_distance_is_null_without_viewer_coords(client, app):
    _make_court(app)
    h = _signup(client, "nocoords@rally.app")  # no lat/lng
    courts = client.get("/api/courts", headers=h).get_json()["courts"]
    assert courts[0]["distance"] is None


def test_favorite_and_unfavorite_toggle(client, app):
    _make_court(app)
    h = _signup(client, "fav@rally.app", lat=41.881, lng=-87.629)
    assert client.post("/api/courts/grant-park/favorite", headers=h).status_code == 200
    courts = client.get("/api/courts", headers=h).get_json()["courts"]
    assert courts[0]["fav"] is True
    # idempotent: favoriting again is fine
    assert client.post("/api/courts/grant-park/favorite", headers=h).status_code == 200
    assert client.delete("/api/courts/grant-park/favorite", headers=h).status_code == 200
    courts = client.get("/api/courts", headers=h).get_json()["courts"]
    assert courts[0]["fav"] is False


def test_favorite_unknown_court_404(client, app):
    h = _signup(client, "nf@rally.app")
    assert client.post("/api/courts/does-not-exist/favorite", headers=h).status_code == 404


def test_list_includes_regulars_and_upcoming(client, app):
    """regularsCount/regulars (home_court_id) and upcomingCount (future live
    sessions at the court) are derived from real data."""
    from datetime import datetime, timedelta
    _make_court(app)
    h = _signup(client, "v2@rally.app", lat=41.881, lng=-87.629)
    with app.app_context():
        from models import User, SportProfile, Court, Session, SessionStatus
        court = Court.query.filter_by(slug="grant-park").first()
        viewer = User.query.filter_by(email="v2@rally.app").first()
        reg = User(email="reg@rally.app", name="Reg Ular", handle="@regular")
        reg.set_password("rally1234")
        db.session.add(reg)
        db.session.flush()
        db.session.add(SportProfile(user_id=reg.id, sport="Tennis", ntrp="3.5", home_court_id=court.id))
        db.session.add(Session(
            host_id=reg.id, guest_id=viewer.id, sport="Tennis",
            scheduled_at=datetime.utcnow() + timedelta(days=2),
            status=SessionStatus.CONFIRMED.value, court_id=court.id,
        ))
        db.session.commit()
    gp = next(c for c in client.get("/api/courts", headers=h).get_json()["courts"] if c["id"] == "grant-park")
    assert gp["regularsCount"] == 1
    assert gp["regulars"][0]["initials"] == "RU"
    assert gp["upcomingCount"] == 1


def test_create_session_with_court_records_it(client, app):
    _make_court(app)  # grant-park
    a = _signup(client, "ch@rally.app")
    _signup(client, "cg@rally.app")
    with app.app_context():
        from models import User
        bid = User.query.filter_by(email="cg@rally.app").first().id
    r = client.post("/api/sessions", headers=a, json={
        "guestId": bid, "sport": "Tennis",
        "scheduledAt": "2026-09-01T18:00:00", "court": "grant-park",
    })
    assert r.status_code == 201, r.get_json()
    assert r.get_json()["session"]["court"] == "Grant Park Tennis Center"
