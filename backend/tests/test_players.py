"""
Tests for /api/players — list + filtering + auth enforcement.
"""


def _seed_partner(client, email="partner@rally.app", sport="Pickleball", ntrp="3.5"):
    """Create another user with a matching sport profile so /api/players returns them."""
    rsp = client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "rally1234",
            "name": "Partner User",
            "sport": sport,
            "ntrp": ntrp,
        },
    )
    assert rsp.status_code == 201
    # Signup now creates the matching SportProfile (sport + ntrp) automatically.


def test_players_requires_auth(client):
    rsp = client.get("/api/players")
    assert rsp.status_code == 401


def test_players_returns_empty_when_nobody_else_exists(client, auth_headers):
    rsp = client.get("/api/players?sport=Pickleball", headers=auth_headers)
    assert rsp.status_code == 200
    assert rsp.get_json() == {"players": [], "count": 0}


def test_players_lists_matching_candidates(client, auth_headers):
    """Seed a fellow pickleball player and verify they show up with a score+reason.
    Both the viewer (auth_headers fixture) and the partner get their Pickleball
    SportProfile automatically at signup."""
    _seed_partner(client)

    rsp = client.get("/api/players?sport=Pickleball", headers=auth_headers)
    assert rsp.status_code == 200
    body = rsp.get_json()
    assert body["count"] == 1
    p = body["players"][0]
    assert p["name"] == "Partner User"
    assert p["ntrp"] == "3.5"
    assert 0 <= p["matchScore"] <= 100
    assert isinstance(p["reason"], str) and len(p["reason"]) > 0


def _signup_h(client, email, sport="Pickleball", ntrp="3.5"):
    rsp = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": "P", "sport": sport, "ntrp": ntrp})
    assert rsp.status_code == 201, rsp.get_json()
    return {"Authorization": f"Bearer {rsp.get_json()['token']}"}


def test_players_payload_includes_availability_slots(client, auth_headers):
    h = _signup_h(client, "avp@rally.app")
    client.patch("/api/auth/me", headers=h, json={"availability": [{"dayOfWeek": 1, "timeBand": "MORN", "status": 2}]})
    p = client.get("/api/players?sport=Pickleball", headers=auth_headers).get_json()["players"][0]
    assert {"dayOfWeek": 1, "timeBand": "MORN", "status": 2} in p["availabilitySlots"]


def test_players_timebands_filter(client, auth_headers):
    h = _signup_h(client, "tb@rally.app")
    client.patch("/api/auth/me", headers=h, json={"availability": [{"dayOfWeek": 1, "timeBand": "MORN", "status": 2}]})
    assert client.get("/api/players?sport=Pickleball&timeBands=MORN", headers=auth_headers).get_json()["count"] == 1
    # has a grid but no EVE availability → excluded by an EVE filter
    assert client.get("/api/players?sport=Pickleball&timeBands=EVE", headers=auth_headers).get_json()["count"] == 0


def test_players_timebands_keeps_users_with_no_grid(client, auth_headers):
    # a partner who never set preferred times must not be hidden by a time filter
    _seed_partner(client, email="nogrid@rally.app")
    assert client.get("/api/players?sport=Pickleball&timeBands=EVE", headers=auth_headers).get_json()["count"] == 1
