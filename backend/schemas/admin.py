from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from schemas.profile import SportProfileInput

COORD_PRECISION = 3


class AdminUpdateUserSchema(BaseModel):
    """Admin-side edit of any user's profile — the support-desk fields a user
    cannot change themselves (email, handle, verification status) plus the
    regular profile fields. Every field optional; only sent ones are touched.
    sportProfiles, when sent, is the complete desired set (same semantics as the
    self-serve profile update)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    handle: Optional[str] = Field(default=None, min_length=2, max_length=80)
    emailVerified: Optional[bool] = None
    bio: Optional[str] = Field(default=None, max_length=1000)
    location: Optional[str] = Field(default=None, max_length=120)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    primarySport: Optional[str] = Field(default=None, pattern=r"^(Tennis|Pickleball)$")
    sportProfiles: Optional[list[SportProfileInput]] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v

    @field_validator("handle")
    @classmethod
    def normalize_handle(cls, v: Optional[str]) -> Optional[str]:
        # Handles are stored "@slug": lowercase, alphanumerics + hyphens.
        if v is None:
            return v
        v = v.strip().lstrip("@").lower()
        import re
        if not re.fullmatch(r"[a-z0-9-]{1,79}", v):
            raise ValueError("Handle may only contain letters, numbers and hyphens")
        return "@" + v

    @field_validator("lat", "lng")
    @classmethod
    def round_coordinate(cls, v: Optional[float]) -> Optional[float]:
        return round(v, COORD_PRECISION) if v is not None else v
