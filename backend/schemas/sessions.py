from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Allow a little slack for client/server clock skew when rejecting past times.
_CLOCK_SKEW = timedelta(minutes=5)


def _validate_future(v: datetime) -> datetime:
    """Reject times clearly in the past. Handles both tz-aware ISO strings
    (what the frontend sends) and naive datetimes (tests / manual calls)."""
    now = datetime.now(timezone.utc) if v.tzinfo else datetime.utcnow()
    if v < now - _CLOCK_SKEW:
        raise ValueError("scheduledAt must be in the future")
    return v


class CreateSessionSchema(BaseModel):
    guestId: int = Field(gt=0)
    sport: Literal["Tennis", "Pickleball"]
    scheduledAt: datetime
    note: Optional[str] = Field(default=None, max_length=500)

    _future = field_validator("scheduledAt")(_validate_future)


class RescheduleSessionSchema(BaseModel):
    scheduledAt: datetime
    note: Optional[str] = Field(default=None, max_length=500)

    _future = field_validator("scheduledAt")(_validate_future)
