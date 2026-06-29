from typing import Literal, Optional
from pydantic import BaseModel, Field


class SupportTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class SupportChatSchema(BaseModel):
    """A user message to the support assistant, with optional prior turns."""
    message: str = Field(min_length=1, max_length=2000)
    history: Optional[list[SupportTurn]] = None


class SupportEscalateSchema(BaseModel):
    """A 'talk to a human' request — emailed to the support inbox."""
    message: str = Field(min_length=1, max_length=4000)
    history: Optional[list[SupportTurn]] = None
