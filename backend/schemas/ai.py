from typing import Literal
from pydantic import BaseModel, Field


class MatchReasonSchema(BaseModel):
    candidateId: int = Field(gt=0)
    sport: Literal["Tennis", "Pickleball"]
