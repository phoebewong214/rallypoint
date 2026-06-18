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


def test_either_party_cancels_and_it_disappears(client):
    a_id, a = _signup(client, "h4@rally.app")
    b_id, b = _signup(client, "g4@rally.app")
    sid = _request(client, a, b_id)
    client.post(f"/api/sessions/{sid}/accept", headers=b)  # confirmed
    assert client.post(f"/api/sessions/{sid}/cancel", headers=a).status_code == 200
    assert _list(client, a) == []
    assert _list(client, b) == []


def test_cancel_requires_being_a_participant(client):
    a_id, a = _signup(client, "h5@rally.app")
    b_id, b = _signup(client, "g5@rally.app")
    _c_id, c = _signup(client, "stranger@rally.app")
    sid = _request(client, a, b_id)
    assert client.post(f"/api/sessions/{sid}/cancel", headers=c).status_code == 403


def _confirmed(client):
    a_id, a = _signup(client, f"ha{id(client)}@rally.app")
    b_id, b = _signup(client, f"gb{id(client)}@rally.app")
    sid = _request(client, a, b_id)
    client.post(f"/api/sessions/{sid}/accept", headers=b)
    return sid, a, b


def test_complete_casual_has_no_result(client):
    sid, a, b = _confirmed(client)
    rsp = client.post(f"/api/sessions/{sid}/complete", headers=a, json={})
    assert rsp.status_code == 200
    s = rsp.get_json()["session"]
    assert s["status"] == "completed" and s["bucket"] == "past" and s["result"] is None


def test_complete_with_outcome_is_viewer_relative(client):
    sid, a, b = _confirmed(client)
    # A reports a win, with a score.
    rsp = client.post(
        f"/api/sessions/{sid}/complete", headers=a,
        json={"outcome": "won", "score": "11-7, 11-9"},
    )
    assert rsp.status_code == 200
    assert rsp.get_json()["session"]["result"] == "W"  # A's perspective
    # B sees the same game as a loss.
    b_view = [x for x in _list(client, b) if x["id"] == sid][0]
    assert b_view["result"] == "L" and b_view["score"] == "11-7, 11-9"


def test_only_confirmed_can_be_completed(client):
    a_id, a = _signup(client, "hc@rally.app")
    b_id, b = _signup(client, "gc@rally.app")
    sid = _request(client, a, b_id)  # still pending, not accepted
    assert client.post(f"/api/sessions/{sid}/complete", headers=a, json={}).status_code == 409
