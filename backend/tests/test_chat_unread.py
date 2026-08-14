"""
Chat read positions + unread counts (RP-FEAT-003): the read-report endpoint
(participant gating, validation, forward-only + tail clamp), the per-row
`unreadCount` on GET /api/sessions, and the nav-dot total at
GET /api/chat/unread-total (live threads only).
"""
from datetime import datetime, timedelta

from extensions import db
from models import Session

# Future-relative so the "must be in the future" invite validation keeps passing.
_START = (datetime.utcnow() + timedelta(days=60)).replace(
    hour=18, minute=0, second=0, microsecond=0).isoformat()


def _signup(client, email):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": email.split("@")[0].title(),
        "sport": "Tennis", "ntrp": "3.5"})
    assert r.status_code == 201, r.get_json()
    b = r.get_json()
    return b["token"], b["user"]["id"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _confirmed_game(client, inviter_token, acceptor_token, invitee_id, sport="Tennis"):
    """Run the real invite → accept-time flow so a sessions row materializes
    (the unread total is scoped to live materialized games)."""
    r = client.post("/api/invites", headers=_h(inviter_token),
                    json={"inviteeId": invitee_id, "sport": sport, "startAt": _START})
    assert r.status_code == 201, r.get_json()
    invite_id = r.get_json()["invite"]["id"]
    r = client.post(f"/api/invites/{invite_id}/accept-time", headers=_h(acceptor_token))
    assert r.status_code == 200, r.get_json()
    return invite_id, r.get_json()["session"]["id"]


def _send(client, token, invite_id, body):
    r = client.post(f"/api/invites/{invite_id}/messages", headers=_h(token),
                    json={"body": body})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["message"]["id"]


def _mark_read(client, token, invite_id, last_read_id):
    return client.post(f"/api/invites/{invite_id}/messages/read", headers=_h(token),
                       json={"lastReadId": last_read_id})


def _session_unread(client, token, session_id):
    rows = client.get("/api/sessions", headers=_h(token)).get_json()["sessions"]
    return next(s["unreadCount"] for s in rows if s["id"] == session_id)


def _total(client, token):
    return client.get("/api/chat/unread-total", headers=_h(token)).get_json()["total"]


def test_read_and_total_require_auth(client):
    assert client.post("/api/invites/1/messages/read",
                       json={"lastReadId": 1}).status_code == 401
    assert client.get("/api/chat/unread-total").status_code == 401


def test_read_report_participant_gating(client):
    ta, _ = _signup(client, "unread_gate_a@rally.app")
    tb, bid = _signup(client, "unread_gate_b@rally.app")
    tc, _ = _signup(client, "unread_gate_c@rally.app")
    invite_id, _sid = _confirmed_game(client, ta, tb, bid)
    # Missing invite and non-participant get the same 404 (no thread enumeration).
    assert _mark_read(client, ta, 9999, 1).status_code == 404
    assert _mark_read(client, tc, invite_id, 1).status_code == 404
    assert _mark_read(client, ta, invite_id, 1).status_code == 200


def test_read_report_validation(client):
    ta, _ = _signup(client, "unread_val_a@rally.app")
    tb, bid = _signup(client, "unread_val_b@rally.app")
    invite_id, _sid = _confirmed_game(client, ta, tb, bid)
    url = f"/api/invites/{invite_id}/messages/read"
    assert client.post(url, headers=_h(ta), json={}).status_code == 422
    assert client.post(url, headers=_h(ta), json={"lastReadId": 0}).status_code == 422
    assert client.post(url, headers=_h(ta), json={"lastReadId": -3}).status_code == 422
    assert client.post(url, headers=_h(ta), json={"lastReadId": "x"}).status_code == 422


def test_session_rows_carry_viewer_relative_unread(client):
    ta, _ = _signup(client, "unread_rows_a@rally.app")
    tb, bid = _signup(client, "unread_rows_b@rally.app")
    invite_id, sid = _confirmed_game(client, ta, tb, bid)

    _send(client, ta, invite_id, "I'll bring balls")
    last = _send(client, ta, invite_id, "court 3, back corner")

    # Two unread for B; the sender's own messages never count against A.
    assert _session_unread(client, tb, sid) == 2
    assert _session_unread(client, ta, sid) == 0

    # Marking read clears it — and it stays cleared on refetch (server-side).
    r = _mark_read(client, tb, invite_id, last)
    assert r.status_code == 200 and r.get_json() == {"unread": 0}
    assert _session_unread(client, tb, sid) == 0
    assert _session_unread(client, tb, sid) == 0

    # A reply flips the direction: now A has unread, B stays clear.
    _send(client, tb, invite_id, "see you there")
    assert _session_unread(client, ta, sid) == 1
    assert _session_unread(client, tb, sid) == 0


def test_read_position_only_moves_forward(client):
    ta, _ = _signup(client, "unread_fwd_a@rally.app")
    tb, bid = _signup(client, "unread_fwd_b@rally.app")
    invite_id, sid = _confirmed_game(client, ta, tb, bid)
    ids = [_send(client, ta, invite_id, b) for b in ("one", "two", "three")]

    assert _mark_read(client, tb, invite_id, ids[1]).get_json() == {"unread": 1}
    # A stale tab re-reporting an older id must not resurrect cleared unread.
    assert _mark_read(client, tb, invite_id, ids[0]).get_json() == {"unread": 1}
    assert _session_unread(client, tb, sid) == 1


def test_read_position_clamps_to_thread_tail(client):
    ta, _ = _signup(client, "unread_clamp_a@rally.app")
    tb, bid = _signup(client, "unread_clamp_b@rally.app")
    invite_id, sid = _confirmed_game(client, ta, tb, bid)
    _send(client, ta, invite_id, "hello")

    # Reporting an id past the tail reads as "everything so far"...
    assert _mark_read(client, tb, invite_id, 10_000_000).get_json() == {"unread": 0}
    # ...but must NOT pre-read messages that didn't exist yet.
    _send(client, ta, invite_id, "new message after the bogus report")
    assert _session_unread(client, tb, sid) == 1


def test_unread_total_sums_live_threads(client):
    ta, aid = _signup(client, "unread_tot_a@rally.app")
    tb, bid = _signup(client, "unread_tot_b@rally.app")
    tc, _cid = _signup(client, "unread_tot_c@rally.app")
    # Two live games for B, against different opponents.
    inv_a, _sid_a = _confirmed_game(client, ta, tb, bid)
    r = client.post("/api/invites", headers=_h(tb),
                    json={"inviteeId": aid, "sport": "Pickleball", "startAt": _START})
    # B ↔ A pickleball via B as inviter (A accepts), just to vary direction.
    inv_b = r.get_json()["invite"]["id"]
    assert client.post(f"/api/invites/{inv_b}/accept-time",
                       headers=_h(ta)).status_code == 200

    _send(client, ta, inv_a, "m1")
    _send(client, ta, inv_a, "m2")
    _send(client, ta, inv_b, "m3")
    assert _total(client, tb) == 3
    # B's own send doesn't feed B's total; the counterparty's does feed theirs.
    _send(client, tb, inv_a, "reply")
    assert _total(client, tb) == 3
    assert _total(client, ta) == 1
    # Third account has no threads at all.
    assert _total(client, tc) == 0

    # Clearing one thread subtracts exactly that thread.
    msgs = client.get(f"/api/invites/{inv_a}/messages",
                      headers=_h(tb)).get_json()["messages"]
    _mark_read(client, tb, inv_a, msgs[-1]["id"])
    assert _total(client, tb) == 1


def test_unread_total_only_counts_threads_with_a_chat_entry(client):
    """The dot must always be clearable: threads whose card no longer offers a
    chat button (cancelled game, long-past game) don't feed the total."""
    ta, _ = _signup(client, "unread_dead_a@rally.app")
    tb, bid = _signup(client, "unread_dead_b@rally.app")
    invite_id, sid = _confirmed_game(client, ta, tb, bid)
    _send(client, ta, invite_id, "you there?")
    assert _total(client, tb) == 1

    # Cancelling the game removes its chat entry — and its unread — for both.
    assert client.post(f"/api/sessions/{sid}/cancel",
                       headers=_h(ta)).status_code == 200
    assert _total(client, tb) == 0
    # The thread history (and marking it read) still works; the row's own
    # unreadCount keeps reporting, the card just doesn't render a button.
    assert _mark_read(client, tb, invite_id, 10_000_000).status_code == 200
    assert _session_unread(client, tb, sid) == 0

    # A second game whose time has long passed also stops feeding the total.
    inv2, sid2 = _confirmed_game(client, ta, tb, bid, sport="Pickleball")
    _send(client, ta, inv2, "gg!")
    assert _total(client, tb) == 1
    db.session.get(Session, sid2).scheduled_at = datetime.utcnow() - timedelta(days=2)
    db.session.commit()
    assert _total(client, tb) == 0


def test_legacy_sessions_report_zero_unread(client):
    ta, _ = _signup(client, "unread_leg_a@rally.app")
    _tb, bid = _signup(client, "unread_leg_b@rally.app")
    r = client.post("/api/sessions", headers=_h(ta),
                    json={"guestId": bid, "sport": "Tennis", "scheduledAt": _START})
    assert r.status_code == 201
    sid = r.get_json()["session"]["id"]
    rows = client.get("/api/sessions", headers=_h(ta)).get_json()["sessions"]
    row = next(s for s in rows if s["id"] == sid)
    assert row["inviteId"] is None and row["unreadCount"] == 0
    assert _total(client, ta) == 0
