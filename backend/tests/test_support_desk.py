"""
Admin support desk: escalations persist as tickets, surface in the admin queue,
and can be resolved / reopened.
"""
import routes.support as support_routes
from extensions import db
from models import User


def _signup(client, email):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": email.split("@")[0].title(),
        "sport": "Pickleball", "ntrp": "3.5",
    })
    assert r.status_code == 201, r.get_json()
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


def _admin(app, client, email="admin@rally.app"):
    _signup(client, email)
    User.query.filter_by(email=email).first().is_admin = True
    db.session.commit()
    r = client.post("/api/auth/login", json={"email": email, "password": "rally1234"})
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


def test_escalation_creates_ticket(client, monkeypatch):
    monkeypatch.setattr(support_routes, "send_email", lambda *a, **k: True)
    h = _signup(client, "tkt@rally.app")
    r = client.post("/api/support/escalate", headers=h, json={
        "message": "I can't change my email",
        "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
    })
    assert r.status_code == 200 and r.get_json()["ok"] is True


def test_admin_sees_and_resolves_ticket(app, client, monkeypatch):
    monkeypatch.setattr(support_routes, "send_email", lambda *a, **k: True)
    h_admin = _admin(app, client)
    h_user = _signup(client, "asker@rally.app")
    client.post("/api/support/escalate", headers=h_user, json={"message": "help me"})

    # open queue + stat counter
    q = client.get("/api/admin/support", headers=h_admin).get_json()
    assert q["openCount"] == 1 and len(q["tickets"]) == 1
    tkt = q["tickets"][0]
    assert tkt["message"] == "help me" and tkt["user"]["email"] == "asker@rally.app"
    assert client.get("/api/admin/stats", headers=h_admin).get_json()["openTickets"] == 1

    # resolve
    tid = tkt["id"]
    r = client.patch(f"/api/admin/support/{tid}", headers=h_admin,
                     json={"status": "closed", "note": "replied by email"})
    assert r.status_code == 200 and r.get_json()["ticket"]["status"] == "closed"
    assert client.get("/api/admin/support", headers=h_admin).get_json()["openCount"] == 0

    # reopen
    r2 = client.patch(f"/api/admin/support/{tid}", headers=h_admin, json={"status": "open"})
    assert r2.status_code == 200 and r2.get_json()["ticket"]["status"] == "open"
    assert client.get("/api/admin/support", headers=h_admin).get_json()["openCount"] == 1


def test_support_desk_requires_admin(client):
    h = _signup(client, "nope@rally.app")
    assert client.get("/api/admin/support", headers=h).status_code == 403


def test_ticket_history_round_trips(app, client, monkeypatch):
    monkeypatch.setattr(support_routes, "send_email", lambda *a, **k: True)
    h_admin = _admin(app, client)
    h_user = _signup(client, "hist@rally.app")
    client.post("/api/support/escalate", headers=h_user, json={
        "message": "see history",
        "history": [{"role": "user", "content": "q1"}, {"role": "assistant", "content": "a1"}],
    })
    tkt = client.get("/api/admin/support", headers=h_admin).get_json()["tickets"][0]
    assert [t["content"] for t in tkt["history"]] == ["q1", "a1"]
