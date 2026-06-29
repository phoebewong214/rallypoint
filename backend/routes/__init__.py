from .auth import auth_bp
from .players import players_bp
from .sessions import sessions_bp
from .ai import ai_bp
from .courts import courts_bp
from .appointments import appointments_bp
from .invites import invites_bp
from .admin import admin_bp
from .support import support_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(players_bp, url_prefix="/api/players")
    app.register_blueprint(sessions_bp, url_prefix="/api/sessions")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(courts_bp, url_prefix="/api/courts")
    app.register_blueprint(appointments_bp, url_prefix="/api")
    app.register_blueprint(invites_bp, url_prefix="/api/invites")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(support_bp, url_prefix="/api/support")
