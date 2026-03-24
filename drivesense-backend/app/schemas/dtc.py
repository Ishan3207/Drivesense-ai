"""Pydantic schemas for DTCLog resource."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class DTCLogCreate(BaseModel):
    vehicle_id: uuid.UUID
    code: str = Field(..., max_length=8, examples=["P0300"])
    description: Optional[str] = None
    llm_analysis: Optional[Any] = None
    severity: str = Field("unknown", pattern=r"^(low|medium|high|critical|unknown)$")


class DTCLogUpdate(BaseModel):
    resolved: Optional[bool] = None
    llm_analysis: Optional[Any] = None
    severity: Optional[str] = Field(None, pattern=r"^(low|medium|high|critical|unknown)$")
    description: Optional[str] = None


class DTCLogRead(BaseModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    code: str
    description: Optional[str]
    llm_analysis: Optional[Any]
    severity: str
    resolved: bool
    detected_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}
