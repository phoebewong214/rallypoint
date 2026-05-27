from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


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

    @field_validator("ntrp")
    @classmethod
    def ntrp_must_be_valid(cls, v: str) -> str:
        allowed = {"2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"}
        if v not in allowed:
            raise ValueError(f"ntrp must be one of {sorted(allowed)}")
        return v
