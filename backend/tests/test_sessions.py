"""
Tests for the session scheduling lifecycle:
request → (guest) accept / decline → reschedule (re-opens to the other party) →
cancel. Covers the viewer-relative status that makes accept actually reachable.
"""


def _signup(client, email, name="Player"):
    r = client.post(
        "/api/auth/signup",
        json={"email": email, "password": "rally1234", "name": name},
    )
    assert r.status_code == 201, r.get_json()
    body = r.get_json()
    return body["user"]["id"], {"Authorization": f"Bearer {body['token']}"}


def _list(client, headers):
    return client.get("/api/sessions", headers=headers).get_json()["sessions"]


def _request(client, host_headers, guest_id, when="2026-07-01T18:00:00"):
    r = client.post(
        "/api/sessions",
        headers=host_headers,
        json={"guestId": guest_id, "sport": "Tennis", "scheduledAt": when},
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()["session"]["id"]


def test_request_is_a_request_to_the_guest_and_pending_to_the_host(client):
    a_id, a = _signup(client, "hosta@rally.app", "Host A")
    b_id, b = _signup(client, "guestb@rally.app", "Guest B")
    _request(client, a, b_id)

    gb = _list(client, b)[0]
    assert gb["status"] == "requested" and gb["bucket"] == "requests" and gb["sentByMe"] is False

    ha = _list(client, a)[0]
    assert ha["status"] == "pending" and ha["bucket"] == "upcoming" and ha["sentByMe"] is True


def test_guest_accepts_request_to_confirm(client):
    a_id, a = _signup(client, "h@rally.app")
    b_id, b = _signup(client, "g@rally.app")
    sid = _request(client, a, b_id)
    rsp = client.post(f"/api/sessions/{sid}/accept", headers=b)
    assert rsp.status_code == 200 and rsp.get_json()["session"]["status"] == "confirmed"


def test_host_cannot_accept_own_request(client):
    a_id, a = _signup(client, "h2@rally.app")
    b_id, b = _signup(client, "g2@rally.app")
    sid = _request(client, a, b_id)
    assert client.post(f"/api/sessions/{sid}/accept", headers=a).status_code == 403


def test_reschedule_reopens_to_the_other_party(client):
    a_id, a = _signup(client, "h3@rally.app")
    b_id, b = _signup(client, "g3@rally.app")
    sid = _request(client, a, b_id)
    client.post(f"/api/sessions/{sid}/accept", headers=b)  # confirmed

    # B proposes a new time → A must now re-confirm.
    rs = client.post(
        f"/api/sessions/{sid}/reschedule",
        headers=b,
        json={"scheduledAt": "2026-07-02T19:00:00"},
    )
    assert rs.status_code == 200
    ga = _list(client, a)[0]
    assert ga["status"] == "requested" and ga["bucket"] == "requests"
    assert ga["scheduledAt"].startswith("2026-07-02")


def test_cancel_keeps_a_trace_in_past(client):
    """Cancelled games are NOT silently deleted — they stay visible (in Past,
    status 'cancelled') so the other party can see the game was called off."""
    a_id, a = _signup(client, "h4@rally.app")
    b_id, b = _signup(client, "g4@rally.app")
    sid = _request(client, a, b_id)
    client.post(f"/api/sessions/{sid}/accept", headers=b)  # confirmed
    assert client.post(f"/api/sessions/{sid}/cancel", headers=a).status_code == 200
    for headers in (a, b):
        rows = _list(client, headers)
        assert len(rows) == 1, rows
        assert rows[0]["status"] == "cancelled"
        assert rows[0]["bucket"] == "past"


def test_duplicate_request_to_same_player_is_rejected(client):
    """A second open/active request to the same player for the same sport is a
    409 returning the existing session (idempotency guard)."""
    a_id, a = _signup(client, "dup_h@rally.app")
    b_id, b = _signup(client, "dup_g@rally.app")
    first = _request(client, a, b_id)
    r = client.post(
        "/api/sessions",
        headers=a,
        json={"guestId": b_id, "sport": "Tennis", "scheduledAt": "2026-07-05T18:00:00"},
    )
    assert r.status_code == 409, r.get_json()
    assert r.get_json().get("session", {}).get("id") == first


def test_session_payload_exposes_opponent_id(client):
    """to_dict includes oppId so the Find Partner page can mark a player as
    already-requested from real data."""
    a_id, a = _signup(client, "opp_h@rally.app")
    b_id, b = _signup(client, "opp_g@rally.app")
    _request(client, a, b_id)
    ha = _list(client, a)[0]
    assert ha["oppId"] == b_id


def test_session_payload_includes_opponent_rating(client):
    """to_dict exposes oppNtrp = the opponent's rating for THAT session's sport,
    so the calendar block can show their level (no scores — just skill)."""
    rh = client.post("/api/auth/signup", json={
        "email": "rate_h@rally.app", "password": "rally1234", "name": "Host", "sport": "Tennis", "ntrp": "3.0"})
    a = {"Authorization": f"Bearer {rh.get_json()['token']}"}
    rg = client.post("/api/auth/signup", json={
        "email": "rate_g@rally.app", "password": "rally1234", "name": "Guest", "sport": "Tennis", "ntrp": "4.0"})
    b_id = rg.get_json()["user"]["id"]
    _request(client, a, b_id)  # Tennis session
    assert _list(client, a)[0]["oppNtrp"] == "4.0"


def test_cancel_requires_being_a_participant(client):
    a_id, a = _signup(client, "h5@rally.app")
    b_id, b = _signup(client, "g5@rally.app")
    _c_id, c = _signup(client, "stranger@rally.app")
    sid = _request(client, a, b_id)
    assert client.post(f"/api/sessions/{sid}/cancel", headers=c).status_code == 403
