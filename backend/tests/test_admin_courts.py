"""
Admin court management: create, edit, soft-deactivate (hidden from the public
list), guarded delete, and slug auto-generation.
"""
from extensions import db
from models import User, Court


def _signup(client, email, sport="Pickleball", ntrp="3.5"):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": email.split("@")[0].title(),
        "sport": sport, "ntrp": ntrp,
    })
    assert r.status_code == 201, r.get_json()
    return {"Authorization": f"Bearer {r.get_json()['token']}"}, r.get_json()["user"]["id"]


def _admin(app, client, email="admin@rally.app"):
    _signup(client, email)
    User.query.filter_by(email=email).first().is_admin = True
    db.session.commit()
    r = client.post("/api/auth/login", json={"email": email, "password": "rally1234"})
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


def test_create_court_autoslugs(app, client):
    h = _admin(app, client)
    r = client.post("/api/admin/courts", headers=h, json={
        "name": "Hyde Park Courts", "address": "1500 E 55th St", "sports": ["Tennis", "Pickleball"],
        "lat": 41.79, "lng": -87.59, "courtCount": 4, "lights": True,
    })
    assert r.status_code == 201, r.get_json()
    court = r.get_json()["court"]
    assert court["slug"] == "hyde-park-courts"
    assert court["primarySport"] == "tennis"  # defaulted from first sport
    assert court["sports"] == ["Tennis", "Pickleball"] and court["isActive"] is True


def test_create_requires_name(app, client):
    h = _admin(app, client)
    assert client.post("/api/admin/courts", headers=h, json={"address": "nowhere"}).status_code in (400, 422)


def test_duplicate_names_get_distinct_slugs(app, client):
    h = _admin(app, client)
    a = client.post("/api/admin/courts", headers=h, json={"name": "Lincoln Park"}).get_json()["court"]
    b = client.post("/api/admin/courts", headers=h, json={"name": "Lincoln Park"}).get_json()["court"]
    assert a["slug"] == "lincoln-park" and b["slug"] == "lincoln-park-2"


def test_edit_court(app, client):
    h = _admin(app, client)
    cid = client.post("/api/admin/courts", headers=h, json={"name": "Old Name"}).get_json()["court"]["id"]
    r = client.patch(f"/api/admin/courts/{cid}", headers=h, json={"name": "New Name", "surface": "Hard"})
    assert r.status_code == 200
    assert r.get_json()["court"]["name"] == "New Name" and r.get_json()["court"]["surface"] == "Hard"


def test_deactivate_hides_from_public_list(app, client):
    h = _admin(app, client)
    _, _ = _signup(client, "player@rally.app")
    hp = _signup(client, "p2@rally.app")[0]
    cid = client.post("/api/admin/courts", headers=h, json={
        "name": "Visible Park", "sports": ["Pickleball"], "lat": 41.8, "lng": -87.6,
    }).get_json()["court"]["id"]

    listed = client.get("/api/courts", headers=hp).get_json()["courts"]
    assert any(c["name"] == "Visible Park" for c in listed)

    client.patch(f"/api/admin/courts/{cid}", headers=h, json={"isActive": False})
    listed2 = client.get("/api/courts", headers=hp).get_json()["courts"]
    assert not any(c["name"] == "Visible Park" for c in listed2)
    # still visible to admin
    assert any(c["id"] == cid for c in client.get("/api/admin/courts", headers=h).get_json()["courts"])


def test_delete_unreferenced_court(app, client):
    h = _admin(app, client)
    cid = client.post("/api/admin/courts", headers=h, json={"name": "Typo Court"}).get_json()["court"]["id"]
    assert client.delete(f"/api/admin/courts/{cid}", headers=h).status_code == 200
    assert Court.query.get(cid) is None


def test_delete_blocked_when_referenced(app, client):
    h = _admin(app, client)
    # a court that is someone's home court can't be hard-deleted
    cid = client.post("/api/admin/courts", headers=h, json={
        "name": "Home Court", "slug": "home-court", "sports": ["Tennis"],
    }).get_json()["court"]["id"]
    _, uid = _signup(client, "homer@rally.app", sport="Tennis", ntrp="4.0")
    # set their home court via the profile update
    huser = {"Authorization": client.post("/api/auth/login", json={"email": "homer@rally.app", "password": "rally1234"}).get_json()["token"]}
    huser = {"Authorization": f"Bearer {huser['Authorization']}"}
    client.patch("/api/auth/me", headers=huser, json={
        "sportProfiles": [{"sport": "Tennis", "ntrp": "4.0", "homeCourt": "home-court"}],
    })
    r = client.delete(f"/api/admin/courts/{cid}", headers=h)
    assert r.status_code == 409
    assert Court.query.get(cid) is not None


def test_court_endpoints_require_admin(client):
    h, _ = _signup(client, "plain@rally.app")
    assert client.get("/api/admin/courts", headers=h).status_code == 403
    assert client.post("/api/admin/courts", headers=h, json={"name": "x"}).status_code == 403
