"""
Read path for the two-phase invite feed (GET /api/invites). Invites are created
directly (the create/confirm mutations land in a later change); this verifies the
viewer-relative serialization that My Games will consume.
"""
from datetime import datetime, timedelta

from extensions import db
from models import GameInvite
from models.game_invite import TimeProposal, PHASE_SETTLING


def _signup(client, email, sport="Tennis", ntrp="3.5"):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": email.split("@")[0].title(),
        "sport": sport, "ntrp": ntrp})
    assert r.status_code == 201, r.get_json()
    b = r.get_json()
    return b["token"], b["user"]["id"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def test_invites_requires_auth(client):
    assert client.get("/api/invites").status_code == 401


def test_awaiting_opponent_is_request_to_invitee_pending_to_inviter(client):
    ta, aid = _signup(client, "inv_a@rally.app")
    tb, bid = _signup(client, "inv_b@rally.app", ntrp="4.0")
    db.session.add(GameInvite(inviter_id=aid, invitee_id=bid, sport="Tennis"))
    db.session.commit()

    # invitee B: in Requests, must confirm the opponent first
    bb = client.get("/api/invites", headers=_h(tb)).get_json()["invites"][0]
    assert bb["phase"] == "awaiting_opponent"
    assert bb["bucket"] == "requests" and bb["status"] == "requested"
    assert bb["yourTurn"] is True and bb["sentByMe"] is False
    assert bb["opp"] == "Inv_A" and bb["oppNtrp"] == "3.5"
    assert bb["kind"] == "invite" and bb["scheduledAt"] is None  # no time proposed yet

    # inviter A: in Upcoming, waiting on them
    aa = client.get("/api/invites", headers=_h(ta)).get_json()["invites"][0]
    assert aa["bucket"] == "upcoming" and aa["status"] == "pending"
    assert aa["yourTurn"] is False and aa["sentByMe"] is True


def test_settling_time_turn_follows_latest_proposal(client):
    ta, aid = _signup(client, "s_a@rally.app")
    tb, bid = _signup(client, "s_b@rally.app")
    inv = GameInvite(inviter_id=aid, invitee_id=bid, sport="Tennis", phase=PHASE_SETTLING)
    db.session.add(inv)
    db.session.flush()
    # A put a specific time on the table → it's B's turn to respond
    db.session.add(TimeProposal(invite_id=inv.id, proposed_by_id=aid,
                                start_at=datetime.utcnow() + timedelta(days=2)))
    db.session.commit()

    bb = client.get("/api/invites", headers=_h(tb)).get_json()["invites"][0]
    assert bb["yourTurn"] is True and bb["bucket"] == "requests"
    assert bb["scheduledAt"] is not None and bb["isWindow"] is False
    aa = client.get("/api/invites", headers=_h(ta)).get_json()["invites"][0]
    assert aa["yourTurn"] is False and aa["bucket"] == "upcoming"


def test_confirmed_invites_excluded_from_feed(client):
    ta, aid = _signup(client, "c_a@rally.app")
    tb, bid = _signup(client, "c_b@rally.app")
    db.session.add(GameInvite(inviter_id=aid, invitee_id=bid, sport="Tennis", phase="confirmed"))
    db.session.commit()
    assert client.get("/api/invites", headers=_h(ta)).get_json()["invites"] == []


# ---- mutations ------------------------------------------------------------

def _create(client, h, invitee_id, start="2026-12-01T18:00:00", end=None, sport="Tennis"):
    body = {"inviteeId": invitee_id, "sport": sport, "startAt": start}
    if end:
        body["endAt"] = end
    return client.post("/api/invites", headers=h, json=body)


def test_create_invite_awaiting(client):
    ta, _ = _signup(client, "ca@rally.app")
    _, bid = _signup(client, "cb@rally.app")
    r = _create(client, _h(ta), bid)
    assert r.status_code == 201, r.get_json()
    inv = r.get_json()["invite"]
    assert inv["phase"] == "awaiting_opponent" and inv["sentByMe"] is True
    assert inv["scheduledAt"] is not None and inv["isWindow"] is False


def test_cannot_invite_self(client):
    ta, aid = _signup(client, "self_inv@rally.app")
    assert _create(client, _h(ta), aid).status_code == 400


def test_create_invite_idempotent(client):
    ta, _ = _signup(client, "i_a@rally.app")
    _, bid = _signup(client, "i_b@rally.app")
    assert _create(client, _h(ta), bid).status_code == 201
    assert _create(client, _h(ta), bid).status_code == 409


def test_create_past_time_rejected(client):
    ta, _ = _signup(client, "p_a@rally.app")
    _, bid = _signup(client, "p_b@rally.app")
    assert _create(client, _h(ta), bid, start="2020-01-01T10:00:00").status_code == 422


def test_accept_specific_time_one_tap_confirms_and_materializes(client):
    ta, _ = _signup(client, "ac_a@rally.app")
    tb, bid = _signup(client, "ac_b@rally.app")
    iid = _create(client, _h(ta), bid).get_json()["invite"]["id"]
    r = client.post(f"/api/invites/{iid}/accept-time", headers=_h(tb))
    assert r.status_code == 200, r.get_json()
    assert r.get_json()["invite"]["phase"] == "confirmed"
    # confirmed invite drops out of the invite feed
    assert client.get("/api/invites", headers=_h(tb)).get_json()["invites"] == []
    # ...and shows as a confirmed upcoming session for the invitee
    sb = client.get("/api/sessions", headers=_h(tb)).get_json()["sessions"]
    assert any(s["status"] == "confirmed" and s["bucket"] == "upcoming" for s in sb)


def test_inviter_cannot_accept_own_time(client):
    ta, _ = _signup(client, "own_a@rally.app")
    _, bid = _signup(client, "own_b@rally.app")
    iid = _create(client, _h(ta), bid).get_json()["invite"]["id"]
    assert client.post(f"/api/invites/{iid}/accept-time", headers=_h(ta)).status_code == 409


def test_window_requires_specific_before_accept(client):
    ta, _ = _signup(client, "w_a@rally.app")
    tb, bid = _signup(client, "w_b@rally.app")
    iid = _create(client, _h(ta), bid, start="2026-12-01T18:00:00", end="2026-12-01T20:00:00").get_json()["invite"]["id"]
    # can't one-tap accept a bare window
    assert client.post(f"/api/invites/{iid}/accept-time", headers=_h(tb)).status_code == 409
    # B confirms opponent, then proposes a specific time inside the window
    assert client.post(f"/api/invites/{iid}/confirm-opponent", headers=_h(tb)).status_code == 200
    assert client.post(f"/api/invites/{iid}/propose-time", headers=_h(tb),
                       json={"startAt": "2026-12-01T19:00:00"}).status_code == 200
    # now A (the non-proposer) accepts B's specific time → confirmed
    r = client.post(f"/api/invites/{iid}/accept-time", headers=_h(ta))
    assert r.status_code == 200 and r.get_json()["invite"]["phase"] == "confirmed"


def test_confirm_opponent_only_invitee(client):
    ta, _ = _signup(client, "co_a@rally.app")
    _, bid = _signup(client, "co_b@rally.app")
    iid = _create(client, _h(ta), bid, start="2026-12-01T18:00:00", end="2026-12-01T20:00:00").get_json()["invite"]["id"]
    assert client.post(f"/api/invites/{iid}/confirm-opponent", headers=_h(ta)).status_code == 403


def test_decline_moves_to_past(client):
    ta, _ = _signup(client, "d_a@rally.app")
    tb, bid = _signup(client, "d_b@rally.app")
    iid = _create(client, _h(ta), bid).get_json()["invite"]["id"]
    assert client.post(f"/api/invites/{iid}/decline", headers=_h(tb), json={"reason": "busy"}).status_code == 200
    aa = client.get("/api/invites", headers=_h(ta)).get_json()["invites"][0]
    assert aa["phase"] == "declined" and aa["bucket"] == "past" and aa["declineReason"] == "busy"


def test_cancel_by_inviter(client):
    ta, _ = _signup(client, "cx_a@rally.app")
    _, bid = _signup(client, "cx_b@rally.app")
    iid = _create(client, _h(ta), bid).get_json()["invite"]["id"]
    assert client.post(f"/api/invites/{iid}/cancel", headers=_h(ta)).status_code == 200
