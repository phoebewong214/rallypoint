"""
Tests for the admin dashboard endpoints: access gating (auth + is_admin) and
the support-desk user edit/list/stats behaviour.
"""
from extensions import db
from models import User


def _signup(client, email, sport="Pickleball", ntrp="3.5"):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": email.split("@")[0].title(),
        "sport": sport, "ntrp": ntrp,
    })
    assert r.status_code == 201, r.get_json()
    body = r.get_json()
    return body["token"], body["user"]["id"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _make_admin(app, email):
    # The conftest `app` fixture keeps an app context active for the whole test,
    # so operate on that session directly. Pushing a *nested* app context here
    # would commit on a separate session whose write isn't visible to the shared
    # in-memory SQLite connection the test client reads through.
    u = User.query.filter_by(email=email).first()
    u.is_admin = True
    db.session.commit()


def _admin_client(app, client, email="admin@rally.app"):
    """Sign up a user, promote to admin, and return fresh auth headers."""
    _signup(client, email)
    _make_admin(app, email)
    # Re-login so the returned token reflects the (unchanged) token_version.
    r = client.post("/api/auth/login", json={"email": email, "password": "rally1234"})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["user"]["isAdmin"] is True
    return _h(body["token"])


# ----- gating -----

def test_admin_requires_authentication(client):
    r = client.get("/api/admin/stats")
    assert r.status_code == 401


def test_admin_rejects_non_admin(client):
    tok, _ = _signup(client, "plain@rally.app")
    r = client.get("/api/admin/stats", headers=_h(tok))
    assert r.status_code == 403
    assert "admin" in r.get_json()["error"].lower()


def test_me_exposes_is_admin_flag(app, client):
    tok, _ = _signup(client, "flag@rally.app")
    assert client.get("/api/auth/me", headers=_h(tok)).get_json()["user"]["isAdmin"] is False
    _make_admin(app, "flag@rally.app")
    r = client.post("/api/auth/login", json={"email": "flag@rally.app", "password": "rally1234"})
    assert r.get_json()["user"]["isAdmin"] is True


# ----- reads -----

def test_stats_counts_users(app, client):
    h = _admin_client(app, client)
    _signup(client, "u1@rally.app")
    _signup(client, "u2@rally.app")
    r = client.get("/api/admin/stats", headers=h)
    assert r.status_code == 200
    body = r.get_json()
    assert body["users"]["total"] == 3  # admin + 2
    assert body["users"]["admins"] == 1
    assert "courts" in body and "invites" in body and "appointments" in body


def test_list_users_search_and_paginate(app, client):
    h = _admin_client(app, client)
    _signup(client, "alice@rally.app")
    _signup(client, "bob@rally.app")

    r = client.get("/api/admin/users", headers=h)
    assert r.status_code == 200
    assert r.get_json()["total"] == 3

    r = client.get("/api/admin/users?q=alice", headers=h)
    users = r.get_json()["users"]
    assert len(users) == 1 and users[0]["email"] == "alice@rally.app"

    r = client.get("/api/admin/users?perPage=1&page=1", headers=h)
    body = r.get_json()
    assert len(body["users"]) == 1 and body["pages"] == 3


def test_get_user_404(app, client):
    h = _admin_client(app, client)
    assert client.get("/api/admin/users/99999", headers=h).status_code == 404


# ----- writes -----

def test_admin_edits_user_support_desk_fields(app, client):
    h = _admin_client(app, client)
    _, uid = _signup(client, "target@rally.app")

    r = client.patch(f"/api/admin/users/{uid}", headers=h, json={
        "name": "New Name",
        "location": "Hyde Park, Chicago",
        "emailVerified": True,
        "primarySport": "Tennis",
        "sportProfiles": [{"sport": "Tennis", "ntrp": "4.5"}],
    })
    assert r.status_code == 200, r.get_json()
    user = r.get_json()["user"]
    assert user["name"] == "New Name"
    assert user["location"] == "Hyde Park, Chicago"
    assert user["emailVerified"] is True
    assert user["primarySport"] == "Tennis"
    assert {p["sport"]: p["ntrp"] for p in user["sportProfiles"]}["Tennis"] == "4.5"


def test_admin_cannot_set_duplicate_email(app, client):
    h = _admin_client(app, client)
    _signup(client, "taken@rally.app")
    _, uid = _signup(client, "mover@rally.app")
    r = client.patch(f"/api/admin/users/{uid}", headers=h, json={"email": "taken@rally.app"})
    assert r.status_code == 409


def test_admin_normalizes_handle(app, client):
    h = _admin_client(app, client)
    _, uid = _signup(client, "handle@rally.app")
    r = client.patch(f"/api/admin/users/{uid}", headers=h, json={"handle": "Cool_Name!!"})
    # invalid chars rejected
    assert r.status_code == 422
    r = client.patch(f"/api/admin/users/{uid}", headers=h, json={"handle": "Cool-Name"})
    assert r.status_code == 200
    assert r.get_json()["user"]["handle"] == "@cool-name"


def test_admin_cannot_grant_admin_via_api(app, client):
    """is_admin is not an accepted field — sending it is silently ignored."""
    h = _admin_client(app, client)
    _, uid = _signup(client, "wannabe@rally.app")
    r = client.patch(f"/api/admin/users/{uid}", headers=h, json={"isAdmin": True, "is_admin": True})
    assert r.status_code == 200
    assert r.get_json()["user"]["isAdmin"] is False
