"""
Pydantic v2 request schemas. Routes call `Schema.model_validate(json)`
and catch ValidationError to return a 422 with structured field errors.
"""
from .auth import (
    LoginSchema,
    SignupSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema,
    TokenSchema,
)
from .sessions import CreateSessionSchema, RescheduleSessionSchema
from .appointments import CreateAppointmentSchema, CheckInSchema
from .ai import MatchReasonSchema
from .profile import UpdateProfileSchema

__all__ = [
    "LoginSchema",
    "SignupSchema",
    "ForgotPasswordSchema",
    "ResetPasswordSchema",
    "TokenSchema",
    "CreateSessionSchema",
    "RescheduleSessionSchema",
    "CreateAppointmentSchema",
    "CheckInSchema",
    "MatchReasonSchema",
    "UpdateProfileSchema",
]
