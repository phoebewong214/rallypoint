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
