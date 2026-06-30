"""
Admin: permanent user deletion (with cascade cleanup) and the
email-change + resend-verification path.
"""
import routes.auth as auth_routes
import routes.support as support_routes
from extensions import db
from models import User, SavedPlayer, UserReport, SupportTicket


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


def test_delete_user_cascades(app, client, monkeypatch):
    monkeypatch.setattr(support_routes, "send_email", lambda *a, **k: True)
    h_admin = _admin(app, client)
    h_victim, vid = _signup(client, "victim@rally.app", sport="Tennis", ntrp="4.0")
    _, bid = _signup(client, "other@rally.app", sport="Tennis", ntrp="4.0")

    # victim builds up some data
    client.post(f"/api/players/{bid}/save", headers=h_victim)
    client.post(f"/api/players/{bid}/report", headers=h_victim, json={"reason": "no_show"})
    client.post("/api/support/escalate", headers=h_victim, json={"message": "help"})
    # someone reports the victim
    h_b = {"Authorization": client.post("/api/auth/login", json={"email": "other@rally.app", "password": "rally1234"}).get_json()["token"]}
    h_b = {"Authorization": f"Bearer {h_b['Authorization']}"}
    client.post(f"/api/players/{vid}/report", headers=h_b, json={"reason": "harassment"})

    assert SavedPlayer.query.filter_by(user_id=vid).count() == 1
    assert UserReport.query.filter(UserReport.reporter_id == vid).count() == 1
    assert UserReport.query.filter(UserReport.reported_id == vid).count() == 1
    assert SupportTicket.query.filter_by(user_id=vid).count() == 1

    # delete the victim
    r = client.delete(f"/api/admin/users/{vid}", headers=h_admin)
    assert r.status_code == 200, r.get_json()

    # user + all their referencing rows are gone; the other user survives
    assert User.query.get(vid) is None
    assert User.query.get(bid) is not None
    assert SavedPlayer.query.filter(or_columns(vid)).count() == 0
    assert UserReport.query.filter(UserReport.reporter_id == vid).count() == 0
    assert UserReport.query.filter(UserReport.reported_id == vid).count() == 0
    assert SupportTicket.query.filter_by(user_id=vid).count() == 0


def or_columns(uid):
    from sqlalchemy import or_
    return or_(SavedPlayer.user_id == uid, SavedPlayer.player_id == uid)


def test_cannot_delete_self(app, client):
    h_admin = _admin(app, client)
    me = client.get("/api/admin/users?q=admin@rally.app", headers=h_admin).get_json()["users"][0]
    r = client.delete(f"/api/admin/users/{me['id']}", headers=h_admin)
    assert r.status_code == 400


def test_delete_missing_user_404(app, client):
    h_admin = _admin(app, client)
    assert client.delete("/api/admin/users/999999", headers=h_admin).status_code == 404


def test_delete_requires_admin(client):
    h, _ = _signup(client, "plain@rally.app")
    _, target = _signup(client, "target@rally.app")
    assert client.delete(f"/api/admin/users/{target}", headers=h).status_code == 403


def test_change_email_with_resend_verification(app, client, monkeypatch):
    calls = []
    monkeypatch.setattr(auth_routes, "_send_verification", lambda user: calls.append(user.email))
    h_admin = _admin(app, client)
    _, uid = _signup(client, "old@rally.app")
    # verify first so we can see it get reset
    client.patch(f"/api/admin/users/{uid}", headers=h_admin, json={"emailVerified": True})

    r = client.patch(f"/api/admin/users/{uid}", headers=h_admin, json={
        "email": "new@rally.app", "resendVerification": True,
    })
    assert r.status_code == 200, r.get_json()
    body = r.get_json()["user"]
    assert body["email"] == "new@rally.app"
    assert body["emailVerified"] is False          # reset, awaiting the new link
    assert calls[-1] == "new@rally.app"            # verification email re-sent to the new address
