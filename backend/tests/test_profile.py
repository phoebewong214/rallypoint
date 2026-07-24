"""
Tests for profile editing: secondary sport (SportProfile upsert/replace) and
saved players.
"""


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


def test_add_then_remove_secondary_sport(client):
    tok, _ = _signup(client, "sec@rally.app", sport="Pickleball", ntrp="3.5")
    h = _h(tok)
    r = client.patch("/api/auth/me", headers=h, json={
        "sportProfiles": [{"sport": "Pickleball", "ntrp": "3.5"}, {"sport": "Tennis", "ntrp": "4.0"}],
    })
    assert r.status_code == 200, r.get_json()
    sports = {p["sport"]: p["ntrp"] for p in r.get_json()["user"]["sportProfiles"]}
    assert sports == {"Pickleball": "3.5", "Tennis": "4.0"}

    # drop the secondary by sending only the primary
    r2 = client.patch("/api/auth/me", headers=h, json={"sportProfiles": [{"sport": "Pickleball", "ntrp": "3.5"}]})
    assert {p["sport"] for p in r2.get_json()["user"]["sportProfiles"]} == {"Pickleball"}


def test_primary_profile_kept_even_if_omitted(client):
    tok, _ = _signup(client, "prim@rally.app", sport="Pickleball", ntrp="3.0")
    h = _h(tok)
    # send a set without the primary (Pickleball) — it must survive
    r = client.patch("/api/auth/me", headers=h, json={"sportProfiles": [{"sport": "Tennis", "ntrp": "3.5"}]})
    sports = {p["sport"] for p in r.get_json()["user"]["sportProfiles"]}
    assert "Pickleball" in sports and "Tennis" in sports


def test_invalid_ntrp_rejected(client):
    tok, _ = _signup(client, "badntrp@rally.app")
    r = client.patch("/api/auth/me", headers=_h(tok), json={"sportProfiles": [{"sport": "Tennis", "ntrp": "abc"}]})
    assert r.status_code == 422


def test_save_unsave_player(client):
    tok_a, _ = _signup(client, "sa@rally.app", sport="Pickleball")
    tok_b, bid = _signup(client, "sb@rally.app", sport="Tennis", ntrp="4.0")
    h = _h(tok_a)
    assert client.post(f"/api/players/{bid}/save", headers=h).status_code == 200
    assert any(p["id"] == bid for p in client.get("/api/players/saved", headers=h).get_json()["players"])
    brow = next((p for p in client.get("/api/players?sport=Tennis", headers=h).get_json()["players"] if p["id"] == bid), None)
    assert brow and brow["saved"] is True
    assert client.delete(f"/api/players/{bid}/save", headers=h).status_code == 200
    assert client.get("/api/players/saved", headers=h).get_json()["count"] == 0


def test_cannot_save_self(client):
    tok, uid = _signup(client, "self@rally.app")
    assert client.post(f"/api/players/{uid}/save", headers=_h(tok)).status_code == 400


def test_update_location_and_coords(client):
    tok, _ = _signup(client, "loc@rally.app")
    r = client.patch("/api/auth/me", headers=_h(tok),
                     json={"location": "Hyde Park", "lat": 41.794, "lng": -87.590})
    assert r.status_code == 200, r.get_json()
    u = r.get_json()["user"]
    assert u["location"] == "Hyde Park"
    assert abs(u["lat"] - 41.794) < 1e-6 and abs(u["lng"] + 87.590) < 1e-6


def test_home_court_set_and_clear(client):
    from extensions import db
    from models import Court
    db.session.add(Court(slug="lincoln-park", name="Lincoln Park Courts"))
    db.session.commit()
    tok, _ = _signup(client, "hc@rally.app", sport="Tennis", ntrp="3.5")
    h = _h(tok)
    r = client.patch("/api/auth/me", headers=h, json={
        "sportProfiles": [{"sport": "Tennis", "ntrp": "3.5", "homeCourt": "lincoln-park"}]})
    prof = next(p for p in r.get_json()["user"]["sportProfiles"] if p["sport"] == "Tennis")
    assert prof["homeCourt"] == "lincoln-park" and prof["homeCourtName"] == "Lincoln Park Courts"
    # sending "" clears the home court
    r2 = client.patch("/api/auth/me", headers=h, json={
        "sportProfiles": [{"sport": "Tennis", "ntrp": "3.5", "homeCourt": ""}]})
    prof2 = next(p for p in r2.get_json()["user"]["sportProfiles"] if p["sport"] == "Tennis")
    assert prof2["homeCourt"] is None and prof2["homeCourtName"] is None


def test_signup_seeds_availability(client):
    r = client.post("/api/auth/signup", json={
        "email": "onb@rally.app", "password": "rally1234", "name": "Onb",
        "sport": "Pickleball", "ntrp": "3.5",
        "availability": [
            {"dayOfWeek": 1, "timeBand": "EVE", "status": 2},
            {"dayOfWeek": 3, "timeBand": "MORN", "status": 1},
            {"dayOfWeek": 0, "timeBand": "AFT", "status": 0},  # 0 → not stored
        ],
    })
    assert r.status_code == 201, r.get_json()
    cells = {(a["dayOfWeek"], a["timeBand"]): a["status"] for a in r.get_json()["user"]["availability"]}
    assert cells == {(1, "EVE"): 2, (3, "MORN"): 1}


def test_set_and_replace_availability(client):
    tok, _ = _signup(client, "avail@rally.app")
    h = _h(tok)
    r = client.patch("/api/auth/me", headers=h, json={"availability": [
        {"dayOfWeek": 5, "timeBand": "MORN", "status": 2},
        {"dayOfWeek": 2, "timeBand": "EVE", "status": 1},
        {"dayOfWeek": 0, "timeBand": "AFT", "status": 0},  # 0 → not stored
    ]})
    assert r.status_code == 200, r.get_json()
    cells = {(a["dayOfWeek"], a["timeBand"]): a["status"] for a in r.get_json()["user"]["availability"]}
    assert cells == {(5, "MORN"): 2, (2, "EVE"): 1}
    # replace semantics: sending an empty grid clears it
    r2 = client.patch("/api/auth/me", headers=h, json={"availability": []})
    assert r2.get_json()["user"]["availability"] == []


def test_set_replace_and_expire_availability_overrides(client):
    from datetime import date, timedelta
    tok, _ = _signup(client, "ovr@rally.app")
    h = _h(tok)
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Two future tweaks stored (status 0 included — "busy that day" matters);
    # the past date is silently dropped.
    r = client.patch("/api/auth/me", headers=h, json={"availabilityOverrides": [
        {"date": tomorrow, "timeBand": "MORN", "status": 0},
        {"date": next_week, "timeBand": "EVE", "status": 2},
        {"date": yesterday, "timeBand": "AFT", "status": 1},
    ]})
    assert r.status_code == 200, r.get_json()
    got = [(o["date"], o["timeBand"], o["status"]) for o in r.get_json()["user"]["availabilityOverrides"]]
    assert got == [(tomorrow, "MORN", 0), (next_week, "EVE", 2)]

    # Replace-all semantics, like the weekly grid.
    r2 = client.patch("/api/auth/me", headers=h, json={"availabilityOverrides": [
        {"date": next_week, "timeBand": "MORN", "status": 1},
    ]})
    got2 = [(o["date"], o["timeBand"], o["status"]) for o in r2.get_json()["user"]["availabilityOverrides"]]
    assert got2 == [(next_week, "MORN", 1)]

    # Omitting the field leaves the stored tweaks untouched.
    r3 = client.patch("/api/auth/me", headers=h, json={"bio": "hi"})
    assert len(r3.get_json()["user"]["availabilityOverrides"]) == 1

    # Bad band rejected by the schema.
    r4 = client.patch("/api/auth/me", headers=h, json={"availabilityOverrides": [
        {"date": tomorrow, "timeBand": "NIGHT", "status": 2},
    ]})
    assert r4.status_code == 422


def test_overrides_surface_in_players_payload(client):
    from datetime import date, timedelta
    tok_a, _ = _signup(client, "ovra@rally.app", sport="Tennis", ntrp="4.0")
    tok_b, bid = _signup(client, "ovrb@rally.app", sport="Tennis", ntrp="4.0")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    client.patch("/api/auth/me", headers=_h(tok_b), json={"availabilityOverrides": [
        {"date": tomorrow, "timeBand": "EVE", "status": 2},
    ]})
    row = next(p for p in client.get("/api/players?sport=Tennis", headers=_h(tok_a)).get_json()["players"]
               if p["id"] == bid)
    assert row["availabilityOverrides"] == [{"date": tomorrow, "timeBand": "EVE", "status": 2}]
