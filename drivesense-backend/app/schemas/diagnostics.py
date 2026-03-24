from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


# ── DTC Analysis Request / Response ───────────────────────────────────────────

class VehicleContext(BaseModel):
    make: str = Field(default="Toyota")
    model: str = Field(default="Camry")
    year: int = Field(default=2019)
    mileage_km: Optional[float] = Field(default=None)


class DiagnosticRequest(BaseModel):
    dtc_code: str = Field(..., examples=["P0420"])
    vehicle: VehicleContext = Field(default_factory=VehicleContext)
    region: Optional[str] = Field(default="United States")
    currency: Optional[str] = Field(default="USD")


class CostRange(BaseModel):
    low: float
    high: float
    currency: str = "USD"


class DiagnosticResult(BaseModel):
    dtc_code: str
    translation: str
    root_causes: list[str]
    repair_steps: list[str]
    cost_estimate_parts: CostRange
    cost_estimate_labor: CostRange
    diy_difficulty: str   # Easy | Medium | Hard | Expert
    ai_confidence: float  # 0.0 – 1.0
    urgency: str          # monitor | soon | urgent | immediate


class PreventionTipsRequest(BaseModel):
    vehicle: VehicleContext
    past_dtc_codes: list[str]
    mileage_km: Optional[float] = None


class PreventionTipsResult(BaseModel):
    tips: list[str]
    next_service_items: list[str]
    estimated_next_service_date: Optional[str] = None
