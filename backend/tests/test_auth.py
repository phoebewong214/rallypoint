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


def test_logout_all_revokes_existing_tokens(client, auth_headers):
    """After /logout-all, a previously-valid token must stop working."""
    assert client.get("/api/auth/me", headers=auth_headers).status_code == 200
    rsp = client.post("/api/auth/logout-all", headers=auth_headers)
    assert rsp.status_code == 200 and rsp.get_json()["ok"] is True
    # The same token is now rejected because its `tv` is stale.
    assert client.get("/api/auth/me", headers=auth_headers).status_code == 401


def test_signup_rejects_password_without_a_number(client):
    rsp = client.post(
        "/api/auth/signup",
        json={"email": "weak@rally.app", "password": "allletters", "name": "Weak"},
    )
    assert rsp.status_code == 422
    assert "password" in rsp.get_json()["fields"]


def test_signup_rounds_coordinates_to_block_precision(client):
    rsp = client.post(
        "/api/auth/signup",
        json={
            "email": "geo@rally.app",
            "password": "rally1234",
            "name": "Geo User",
            "lat": 41.881912345,
            "lng": -87.627812345,
        },
    )
    assert rsp.status_code == 201
    user = rsp.get_json()["user"]
    assert user["lat"] == 41.882 and user["lng"] == -87.628


def test_handles_are_unique_for_duplicate_names(client):
    """Two players named the same must not collide on @handle."""
    first = client.post(
        "/api/auth/signup",
        json={"email": "a@rally.app", "password": "rally1234", "name": "Sam Court"},
    ).get_json()["user"]["handle"]
    second = client.post(
        "/api/auth/signup",
        json={"email": "b@rally.app", "password": "rally1234", "name": "Sam Court"},
    ).get_json()["user"]["handle"]
    assert first != second


def _signup(client, email="flow@rally.app"):
    return client.post(
        "/api/auth/signup",
        json={"email": email, "password": "rally1234", "name": "Flow User"},
    ).get_json()


def test_signup_starts_unverified_and_verify_email_flow(client, app):
    from services.auth import issue_action_token
    from routes.auth import VERIFY_PURPOSE

    body = _signup(client)
    uid = body["user"]["id"]
    assert body["user"]["emailVerified"] is False

    token = issue_action_token(uid, VERIFY_PURPOSE, 60)
    rsp = client.post("/api/auth/verify-email", json={"token": token})
    assert rsp.status_code == 200
    assert rsp.get_json()["user"]["emailVerified"] is True


def test_verify_email_rejects_token_of_wrong_purpose(client, app):
    from services.auth import issue_action_token
    from routes.auth import RESET_PURPOSE

    uid = _signup(client)["user"]["id"]
    # A reset token must not double as a verification token.
    token = issue_action_token(uid, RESET_PURPOSE, 60, token_version=1)
    rsp = client.post("/api/auth/verify-email", json={"token": token})
    assert rsp.status_code == 400


def test_forgot_password_always_returns_200_no_enumeration(client):
    """The response must not reveal whether the account exists."""
    known = client.post("/api/auth/forgot-password", json={"email": "flow@rally.app"})
    _signup(client)
    unknown = client.post("/api/auth/forgot-password", json={"email": "nobody@rally.app"})
    assert known.status_code == 200 and unknown.status_code == 200
    assert known.get_json()["ok"] and unknown.get_json()["ok"]


def test_reset_password_updates_pw_revokes_sessions_and_is_single_use(client, app):
    from services.auth import issue_action_token
    from routes.auth import RESET_PURPOSE
    from models import User

    body = _signup(client)
    uid = body["user"]["id"]
    old_headers = {"Authorization": f"Bearer {body['token']}"}
    assert client.get("/api/auth/me", headers=old_headers).status_code == 200

    tv = User.query.get(uid).token_version
    reset_token = issue_action_token(uid, RESET_PURPOSE, 60, token_version=tv)

    rsp = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "password": "brandnew99"},
    )
    assert rsp.status_code == 200

    # Existing sessions are revoked, and the new password works.
    assert client.get("/api/auth/me", headers=old_headers).status_code == 401
    assert client.post(
        "/api/auth/login",
        json={"email": "flow@rally.app", "password": "brandnew99"},
    ).status_code == 200

    # The reset link is single-use (token_version moved on).
    reuse = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "password": "another99"},
    )
    assert reuse.status_code == 400


def test_signup_creates_a_sport_profile_from_chosen_sport_and_ntrp(client):
    body = client.post(
        "/api/auth/signup",
        json={"email": "prof@rally.app", "password": "rally1234", "name": "Prof",
              "sport": "Tennis", "ntrp": "4.0"},
    ).get_json()
    profiles = body["user"]["sportProfiles"]
    assert len(profiles) == 1
    assert profiles[0]["sport"] == "Tennis" and profiles[0]["ntrp"] == "4.0"


def test_signup_rejects_whitespace_only_name(client):
    rsp = client.post(
        "/api/auth/signup",
        json={"email": "blank@rally.app", "password": "rally1234", "name": "   "},
    )
    assert rsp.status_code == 422
    assert "name" in rsp.get_json()["fields"]


def _set_cookie_value(rsp, name):
    for h in rsp.headers.get_all("Set-Cookie"):
        if h.startswith(name + "="):
            return h.split(";", 1)[0].split("=", 1)[1]
    return None


def test_login_sets_httponly_session_and_readable_csrf_cookie(client, app):
    _signup(client, "cookie@rally.app")
    rsp = client.post(
        "/api/auth/login", json={"email": "cookie@rally.app", "password": "rally1234"}
    )
    set_cookies = rsp.headers.get_all("Set-Cookie")
    session_line = next(h for h in set_cookies if h.startswith(app.config["AUTH_COOKIE_NAME"] + "="))
    csrf_line = next(h for h in set_cookies if h.startswith(app.config["CSRF_COOKIE_NAME"] + "="))
    # JWT cookie must be httpOnly (XSS-safe); CSRF cookie must be JS-readable.
    assert "HttpOnly" in session_line
    assert "HttpOnly" not in csrf_line


def test_cookie_session_authenticates_without_bearer(client):
    # signup populates the test client's cookie jar
    _signup(client, "cookieauth@rally.app")
    rsp = client.get("/api/auth/me")  # no Authorization header → cookie used
    assert rsp.status_code == 200
    assert rsp.get_json()["user"]["email"] == "cookieauth@rally.app"


def test_cookie_auth_enforces_csrf_on_unsafe_methods(client, app):
    rsp = client.post(
        "/api/auth/signup",
        json={"email": "csrf@rally.app", "password": "rally1234", "name": "Csrf"},
    )
    csrf = _set_cookie_value(rsp, app.config["CSRF_COOKIE_NAME"])

    # Safe method: no CSRF token needed.
    assert client.get("/api/auth/me").status_code == 200
    # Unsafe method via cookie without the CSRF header → rejected.
    assert client.post("/api/auth/logout-all").status_code == 403
    # With the matching double-submit header → allowed.
    ok = client.post("/api/auth/logout-all", headers={"X-CSRF-Token": csrf})
    assert ok.status_code == 200


def test_logout_expires_the_session_cookie(client):
    _signup(client, "bye@rally.app")
    rsp = client.post("/api/auth/logout")
    assert rsp.status_code == 200
    joined = " ".join(rsp.headers.get_all("Set-Cookie"))
    assert "rp_session=" in joined and ("Max-Age=0" in joined or "Expires" in joined)
