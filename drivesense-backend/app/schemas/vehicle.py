"""Pydantic schemas for Vehicle and DriverScore resources."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Vehicle ────────────────────────────────────────────────────────────────────

class VehicleCreate(BaseModel):
    make: str = Field(..., max_length=64, examples=["Toyota"])
    model: str = Field(..., max_length=64, examples=["Camry"])
    year: int = Field(..., ge=1900, le=2100, examples=[2022])
    vin: Optional[str] = Field(None, max_length=17, examples=["1HGCM82633A004352"])
    nickname: Optional[str] = Field(None, max_length=64, examples=["My Daily Driver"])


class VehicleUpdate(BaseModel):
    make: Optional[str] = Field(None, max_length=64)
    model: Optional[str] = Field(None, max_length=64)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    vin: Optional[str] = Field(None, max_length=17)
    nickname: Optional[str] = Field(None, max_length=64)


class VehicleRead(BaseModel):
    id: uuid.UUID
    make: str
    model: str
    year: int
    vin: Optional[str]
    nickname: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Driver Score ───────────────────────────────────────────────────────────────

class DriverScoreCreate(BaseModel):
    vehicle_id: uuid.UUID
    score: float = Field(..., ge=0.0, le=100.0)
    delta: float = 0.0
    reason: Optional[str] = Field(None, max_length=256)


class DriverScoreRead(BaseModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    score: float
    delta: float
    reason: Optional[str]
    recorded_at: datetime

    model_config = {"from_attributes": True}
