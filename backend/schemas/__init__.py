"""
Pydantic v2 request schemas. Routes call `Schema.model_validate(json)`
and catch ValidationError to return a 422 with structured field errors.
"""
from .auth import LoginSchema, SignupSchema
from .sessions import CreateSessionSchema
from .ai import MatchReasonSchema
from .profile import UpdateProfileSchema

__all__ = [
    "LoginSchema",
    "SignupSchema",
    "CreateSessionSchema",
    "MatchReasonSchema",
    "UpdateProfileSchema",
]
