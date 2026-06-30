from typing import Literal, Optional
from pydantic import BaseModel, Field

# Keep in sync with REPORT_REASONS / REPORT_STATUSES in models/report.py.
ReportReason = Literal["harassment", "no_show", "fake_profile", "inappropriate", "safety", "other"]


class CreateReportSchema(BaseModel):
    """A user filing a report against another player."""
    reason: ReportReason
    details: Optional[str] = Field(default=None, max_length=1000)


class AdminReviewReportSchema(BaseModel):
    """An admin resolving a report from the review queue. `status` is the
    resolution; `suspend` optionally locks the reported account in the same step."""
    status: Literal["reviewed", "dismissed"]
    note: Optional[str] = Field(default=None, max_length=1000)
    suspend: bool = False
