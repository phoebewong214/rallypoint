import datetime as dt
from typing import Literal, Optional
from pydantic import BaseModel, Field


class SportProfileInput(BaseModel):
    """One sport a user plays (NTRP for tennis, DUPR for pickleball — both stored
    as a short rating string)."""
    sport: Literal["Tennis", "Pickleball"]
    ntrp: str = Field(pattern=r"^\d\.\d$", max_length=4)  # e.g. "3.5"
    homeCourt: Optional[str] = Field(default=None, max_length=80)  # court slug
    availabilitySummary: Optional[str] = Field(default=None, max_length=200)


class AvailabilityInput(BaseModel):
    dayOfWeek: int = Field(ge=0, le=6)
    timeBand: Literal["MORN", "AFT", "EVE"]
    status: int = Field(ge=0, le=2)


class AvailabilityOverrideInput(BaseModel):
    date: dt.date
    timeBand: Literal["MORN", "AFT", "EVE"]
    status: int = Field(ge=0, le=2)


class UpdateProfileSchema(BaseModel):
    """Partial profile update — every field optional, only sent ones touched.
    sportProfiles, when sent, is the complete desired set (the primary sport's
    profile is always kept even if omitted). availability, when sent, replaces
    the whole weekly grid."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=1000)
    location: Optional[str] = Field(default=None, max_length=120)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    primarySport: Optional[str] = Field(default=None, pattern=r"^(Tennis|Pickleball)$")
    sportProfiles: Optional[list[SportProfileInput]] = None
    availability: Optional[list[AvailabilityInput]] = None
    # When sent, replaces the whole set of date-specific tweaks (like the grid).
    availabilityOverrides: Optional[list[AvailabilityOverrideInput]] = None
