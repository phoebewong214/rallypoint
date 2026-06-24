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
