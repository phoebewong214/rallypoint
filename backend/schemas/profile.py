from typing import Literal, Optional
from pydantic import BaseModel, Field


class SportProfileInput(BaseModel):
    """One sport a user plays (NTRP for tennis, DUPR for pickleball — both stored
    as a short rating string)."""
    sport: Literal["Tennis", "Pickleball"]
    ntrp: str = Field(pattern=r"^\d\.\d$", max_length=4)  # e.g. "3.5"
    homeCourt: Optional[str] = Field(default=None, max_length=80)  # court slug
    availabilitySummary: Optional[str] = Field(default=None, max_length=200)


class UpdateProfileSchema(BaseModel):
    """Partial profile update — every field optional, only sent ones touched.
    sportProfiles, when sent, is the complete desired set (the primary sport's
    profile is always kept even if omitted)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=1000)
    location: Optional[str] = Field(default=None, max_length=120)
    primarySport: Optional[str] = Field(default=None, pattern=r"^(Tennis|Pickleball)$")
    sportProfiles: Optional[list[SportProfileInput]] = None
