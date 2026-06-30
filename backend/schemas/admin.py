from typing import Literal, Optional
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
    # When true (typically with a changed `email`), mark the address unverified
    # and re-send the verification email to the new address. Overrides
    # emailVerified=True if both are sent.
    resendVerification: Optional[bool] = None
    # Trust & safety: false suspends the account (locks it out + logs it out),
    # true lifts the suspension.
    isActive: Optional[bool] = None
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


class AdminCourtSchema(BaseModel):
    """Create/edit a court from the admin Courts tab. All fields optional so it
    doubles as a PATCH; the create route additionally requires `name`. `slug` is
    auto-derived from the name when omitted."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    slug: Optional[str] = Field(default=None, max_length=80)
    address: Optional[str] = Field(default=None, max_length=255)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    primarySport: Optional[Literal["tennis", "pickleball"]] = None
    sports: Optional[list[Literal["Tennis", "Pickleball"]]] = None
    courtCount: Optional[int] = Field(default=None, ge=1, le=200)
    surface: Optional[str] = Field(default=None, max_length=120)
    lights: Optional[bool] = None
    isActive: Optional[bool] = None

    @field_validator("name", "surface", "address")
    @classmethod
    def strip_text(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        import re
        v = re.sub(r"[^a-z0-9]+", "-", v.strip().lower()).strip("-")
        if not v:
            raise ValueError("Slug must contain letters or numbers")
        return v
