"""
Tests for the customer-support endpoints: AI chat (with graceful degrade) and
human escalation (emails the support inbox).
"""
import routes.support as support_routes


def _signup(client, email="supp@rally.app"):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": "Supp User",
        "sport": "Pickleball", "ntrp": "3.5",
    })
    assert r.status_code == 201, r.get_json()
    return {"Authorization": f"Bearer {r.get_json()['token']}"}


# ----- chat -----

def test_chat_degrades_without_ai(client, monkeypatch):
    # No AI configured → service returns None → route steers to human.
    monkeypatch.setattr(support_routes, "answer_support", lambda *a, **k: None)
    h = _signup(client)
    r = client.post("/api/support/chat", headers=h, json={"message": "How do I request a game?"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["source"] == "unavailable"
    assert "human" in body["reply"].lower()


def test_chat_returns_ai_reply(client, monkeypatch):
    monkeypatch.setattr(support_routes, "answer_support", lambda *a, **k: "Tap a player, then pick a court.")
    h = _signup(client)
    r = client.post("/api/support/chat", headers=h, json={
        "message": "How do I request a game?",
        "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
    })
    assert r.status_code == 200
    body = r.get_json()
    assert body["source"] == "ai"
    assert body["reply"] == "Tap a player, then pick a court."


def test_chat_degrades_on_ai_error(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("openai down")
    monkeypatch.setattr(support_routes, "answer_support", boom)
    h = _signup(client)
    r = client.post("/api/support/chat", headers=h, json={"message": "hello"})
    assert r.status_code == 200
    assert r.get_json()["source"] == "unavailable"


def test_chat_validation_and_auth(client, app):
    h = _signup(client)
    assert client.post("/api/support/chat", headers=h, json={"message": ""}).status_code == 422
    # Fresh, cookie-less client → genuinely unauthenticated.
    anon = app.test_client()
    assert anon.post("/api/support/chat", json={"message": "hi"}).status_code == 401


# ----- escalate -----

def test_escalate_emails_support_inbox(client, monkeypatch):
    sent = {}
    def fake_send(to, subject, body):
        sent.update(to=to, subject=subject, body=body)
        return True
    monkeypatch.setattr(support_routes, "send_email", fake_send)

    h = _signup(client, "needhelp@rally.app")
    r = client.post("/api/support/escalate", headers=h, json={
        "message": "I can't change my email",
        "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
    })
    assert r.status_code == 200 and r.get_json()["ok"] is True
    assert sent["to"] == "admin@tryrallypoint.com"
    assert "needhelp@rally.app" in sent["subject"]
    assert "I can't change my email" in sent["body"]
    assert "Conversation so far" in sent["body"]  # history included


def test_escalate_502_on_email_failure(client, monkeypatch):
    monkeypatch.setattr(support_routes, "send_email", lambda *a, **k: False)
    h = _signup(client, "fail@rally.app")
    r = client.post("/api/support/escalate", headers=h, json={"message": "help"})
    assert r.status_code == 502
    assert r.get_json()["ok"] is False
