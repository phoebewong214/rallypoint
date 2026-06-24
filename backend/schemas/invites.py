"""
Schemas for the two-phase invite flow (create / propose-time / decline).
"""
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

_CLOCK_SKEW = timedelta(minutes=5)


def _validate_future(v: datetime) -> datetime:
    """Reject times clearly in the past (handles tz-aware ISO + naive)."""
    now = datetime.now(timezone.utc) if v.tzinfo else datetime.utcnow()
    if v < now - _CLOCK_SKEW:
        raise ValueError("time must be in the future")
    return v


class _TimeFields(BaseModel):
    # startAt = the proposed time; endAt set ⇒ an offered window [startAt, endAt].
    startAt: datetime
    endAt: Optional[datetime] = None

    _future = field_validator("startAt")(_validate_future)

    @model_validator(mode="after")
    def _window_after_start(self):
        if self.endAt is not None and self.endAt <= self.startAt:
            raise ValueError("endAt must be after startAt")
        return self


class CreateInviteSchema(_TimeFields):
    inviteeId: int = Field(gt=0)
    sport: Literal["Tennis", "Pickleball"]
    note: Optional[str] = Field(default=None, max_length=500)
    court: Optional[str] = Field(default=None, max_length=80)  # court slug


class ProposeTimeSchema(_TimeFields):
    pass


class DeclineInviteSchema(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=200)
