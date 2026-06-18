import re
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator

# ~3 decimal places ≈ 110 m. We store coordinates at street-block precision so
# distance matching still works without retaining a user's exact position.
COORD_PRECISION = 3


class LoginSchema(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class SignupSchema(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    sport: Literal["Tennis", "Pickleball"] = "Pickleball"
    ntrp: str = "3.5"
    location: str | None = Field(default=None, max_length=120)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("ntrp")
    @classmethod
    def ntrp_must_be_valid(cls, v: str) -> str:
        allowed = {"2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"}
        if v not in allowed:
            raise ValueError(f"ntrp must be one of {sorted(allowed)}")
        return v

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        return _require_strong_password(v)

    @field_validator("lat", "lng")
    @classmethod
    def round_coordinate(cls, v: float | None) -> float | None:
        return round(v, COORD_PRECISION) if v is not None else v


def _require_strong_password(v: str) -> str:
    # Mirrors the UI hint: "8+ chars with letters & numbers".
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must contain at least one letter and one number")
    return v


class ForgotPasswordSchema(BaseModel):
    email: EmailStr


class ResetPasswordSchema(BaseModel):
    token: str = Field(min_length=1)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        return _require_strong_password(v)


class TokenSchema(BaseModel):
    """A bare action token (email verification, etc.)."""
    token: str = Field(min_length=1)
