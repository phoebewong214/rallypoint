from typing import Optional
from pydantic import BaseModel, Field


class UpdateProfileSchema(BaseModel):
    """Partial profile update — every field optional, only sent ones touched."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=1000)
    location: Optional[str] = Field(default=None, max_length=120)
    primarySport: Optional[str] = Field(default=None, pattern=r"^(Tennis|Pickleball)$")
