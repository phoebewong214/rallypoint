from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class CreateSessionSchema(BaseModel):
    guestId: int = Field(gt=0)
    sport: Literal["Tennis", "Pickleball"]
    scheduledAt: datetime
    note: Optional[str] = Field(default=None, max_length=500)


class RescheduleSessionSchema(BaseModel):
    scheduledAt: datetime
    note: Optional[str] = Field(default=None, max_length=500)
