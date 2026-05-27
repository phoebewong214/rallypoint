"""
Centralized request validation: parse + validate with Pydantic, return a
clean 422 JSON on failure rather than a 500.

Usage:
    from utils.validate import parse_json
    data = parse_json(LoginSchema)
    # data is a validated LoginSchema instance or a Flask response was already returned

Implementation note: we use Werkzeug's `abort(make_response(...))` pattern via
a custom exception caught by an error handler registered on the blueprint.
"""
from typing import Type, TypeVar
from flask import request, jsonify
from pydantic import BaseModel, ValidationError
from werkzeug.exceptions import HTTPException

T = TypeVar("T", bound=BaseModel)


class APIValidationError(HTTPException):
    code = 422

    def __init__(self, errors):
        super().__init__(description="Validation failed")
        self.errors = errors

    def get_response(self, environ=None, scope=None):
        rsp = jsonify({"error": "validation failed", "fields": self.errors})
        rsp.status_code = 422
        return rsp


def parse_json(schema_cls: Type[T]) -> T:
    """Validate request JSON against schema_cls; raise APIValidationError on failure."""
    raw = request.get_json(silent=True) or {}
    try:
        return schema_cls.model_validate(raw)
    except ValidationError as ve:
        # flatten pydantic errors to {field: [messages]}
        out: dict[str, list[str]] = {}
        for err in ve.errors():
            loc = ".".join(str(p) for p in err.get("loc", ()))
            out.setdefault(loc or "_", []).append(err.get("msg", "invalid"))
        raise APIValidationError(out)
