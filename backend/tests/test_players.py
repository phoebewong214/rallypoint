"""
Tests for /api/players — list + filtering + auth enforcement.
"""


def _seed_partner(client, email="partner@rally.app", sport="Pickleball", ntrp="3.5"):
    """Create another user with a matching sport profile so /api/players returns them."""
    rsp = client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "rally1234",
            "name": "Partner User",
            "sport": sport,
            "ntrp": ntrp,
        },
    )
    assert rsp.status_code == 201

    # Manually add a sport profile (signup creates the user but no profile row yet).
    # Use the app context to write via SQLAlchemy.
    from extensions import db
    from models import User, SportProfile

    u = User.query.filter_by(email=email).first()
    db.session.add(
        SportProfile(
            user_id=u.id,
            sport=sport,
            ntrp=ntrp,
            availability_summary="Weekends, mornings",
        )
    )
    db.session.commit()


def test_players_requires_auth(client):
    rsp = client.get("/api/players")
    assert rsp.status_code == 401


def test_players_returns_empty_when_nobody_else_exists(client, auth_headers):
    rsp = client.get("/api/players?sport=Pickleball", headers=auth_headers)
    assert rsp.status_code == 200
    assert rsp.get_json() == {"players": [], "count": 0}


def test_players_lists_matching_candidates(client, auth_headers, app):
    """Seed a fellow pickleball player and verify they show up with a score+reason."""
    with app.app_context():
        # Give the test viewer their own SportProfile too so matching has something to compare
        from extensions import db
        from models import User, SportProfile

        me = User.query.filter_by(email="fixture@rally.app").first()
        db.session.add(
            SportProfile(
                user_id=me.id,
                sport="Pickleball",
                ntrp="3.5",
                availability_summary="Weekends, mornings",
            )
        )
        db.session.commit()
        _seed_partner(client)

    rsp = client.get("/api/players?sport=Pickleball", headers=auth_headers)
    assert rsp.status_code == 200
    body = rsp.get_json()
    assert body["count"] == 1
    p = body["players"][0]
    assert p["name"] == "Partner User"
    assert p["ntrp"] == "3.5"
    assert 0 <= p["matchScore"] <= 100
    assert isinstance(p["reason"], str) and len(p["reason"]) > 0
