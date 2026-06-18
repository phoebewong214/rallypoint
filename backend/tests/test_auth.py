"""
Tests for the auth surface. Covers the JWT-issued + Pydantic-validated
happy paths and the security invariants we care about.
"""


def test_signup_returns_jwt_and_user(client):
    rsp = client.post(
        "/api/auth/signup",
        json={
            "email": "new@rally.app",
            "password": "rally1234",
            "name": "New Player",
            "sport": "Tennis",
            "ntrp": "3.0",
        },
    )
    assert rsp.status_code == 201
    body = rsp.get_json()
    assert "token" in body and len(body["token"]) > 20
    assert body["user"]["email"] == "new@rally.app"
    assert body["user"]["name"] == "New Player"
    assert body["user"]["primarySport"] == "Tennis"
    # Password must never be echoed back
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_login_with_correct_password_works(client):
    client.post(
        "/api/auth/signup",
        json={
            "email": "login@rally.app",
            "password": "rally1234",
            "name": "Login User",
            "sport": "Pickleball",
            "ntrp": "3.5",
        },
    )
    rsp = client.post(
        "/api/auth/login",
        json={"email": "login@rally.app", "password": "rally1234"},
    )
    assert rsp.status_code == 200
    assert "token" in rsp.get_json()


def test_login_with_wrong_password_is_401(client):
    client.post(
        "/api/auth/signup",
        json={
            "email": "wrongpw@rally.app",
            "password": "rally1234",
            "name": "X",
            "sport": "Pickleball",
            "ntrp": "3.5",
        },
    )
    rsp = client.post(
        "/api/auth/login",
        json={"email": "wrongpw@rally.app", "password": "not-the-password"},
    )
    assert rsp.status_code == 401


def test_signup_with_bad_input_returns_422_with_field_errors(client):
    """Pydantic validation must surface per-field errors, not generic 500s."""
    rsp = client.post(
        "/api/auth/signup",
        json={"email": "not-an-email", "password": "short", "name": ""},
    )
    assert rsp.status_code == 422
    body = rsp.get_json()
    assert body["error"] == "validation failed"
    assert "email" in body["fields"]
    assert "password" in body["fields"]
    assert "name" in body["fields"]


def test_me_requires_bearer_token(client):
    """Security invariant: protected routes reject unauthenticated requests."""
    rsp = client.get("/api/auth/me")
    assert rsp.status_code == 401


def test_protected_route_rejects_x_user_id_header(client):
    """
    Security invariant: the old "X-User-Id: 1 = I'm Alex" bypass MUST stay dead.
    """
    rsp = client.get("/api/auth/me", headers={"X-User-Id": "1"})
    assert rsp.status_code == 401


def test_me_with_valid_token_returns_user(client, auth_headers):
    rsp = client.get("/api/auth/me", headers=auth_headers)
    assert rsp.status_code == 200
    assert rsp.get_json()["user"]["email"] == "fixture@rally.app"


def test_me_with_garbage_token_is_401(client):
    rsp = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert rsp.status_code == 401
    assert "invalid" in rsp.get_json()["error"].lower()
