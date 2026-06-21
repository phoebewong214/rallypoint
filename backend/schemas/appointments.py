from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

from .sessions import _validate_future


class CreateAppointmentSchema(BaseModel):
    sport: Literal["Tennis", "Pickleball"]
    scheduledAt: datetime
    maxPlayers: int = Field(default=4, ge=2, le=12)
    note: Optional[str] = Field(default=None, max_length=500)

    _future = field_validator("scheduledAt")(_validate_future)


class CheckInSchema(BaseModel):
    # Optional coordinates for a "you're near the court" sanity check.
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
