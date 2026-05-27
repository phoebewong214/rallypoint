"""
Shared pytest fixtures. Each test gets a fresh in-memory SQLite DB
so tests are isolated and don't touch rallypoint.db.
"""
import pytest

from app import create_app
from extensions import db
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SECRET_KEY = "test-secret"
    # Disable the rate limiter for tests so we can hit endpoints repeatedly
    RATELIMIT_ENABLED = False


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Sign a fresh user up and return Authorization headers for them."""
    payload = {
        "email": "fixture@rally.app",
        "password": "rally1234",
        "name": "Fixture User",
        "sport": "Pickleball",
        "ntrp": "3.5",
    }
    rsp = client.post("/api/auth/signup", json=payload)
    assert rsp.status_code == 201, rsp.get_json()
    token = rsp.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}
