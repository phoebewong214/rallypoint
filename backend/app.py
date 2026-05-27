"""
Application factory + dev entry point.

Run:
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    python seed.py            # create DB + seed sample data
    python app.py             # → http://localhost:5050
"""
from flask import Flask, jsonify
from flask_cors import CORS
from flasgger import Swagger

from config import Config
from extensions import db, migrate, limiter
import models  # noqa: F401  — registers models on db.metadata
from routes import register_blueprints
from utils.validate import APIValidationError


SWAGGER_TEMPLATE = {
    "swagger": "2.0",
    "info": {
        "title": "RallyPoint API",
        "description": "AI-powered sports partner matching. All write/protected endpoints require an `Authorization: Bearer <jwt>` header obtained from `/api/auth/login`.",
        "version": "0.1.0",
    },
    "basePath": "/api",
    "schemes": ["http"],
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT prefixed with `Bearer `, e.g. `Bearer eyJhbGciOi...`",
        }
    },
}

SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "openapi",
            "route": "/api/openapi.json",
            "rule_filter": lambda rule: rule.rule.startswith("/api/"),
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs/",
}


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)
    limiter.init_app(app)
    Swagger(app, template=SWAGGER_TEMPLATE, config=SWAGGER_CONFIG)

    register_blueprints(app)

    @app.errorhandler(APIValidationError)
    def handle_validation_error(e: APIValidationError):
        return e.get_response()

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "rallypoint-api"})

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(500)
    def server_error(_):
        return jsonify({"error": "internal server error"}), 500

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5050)
