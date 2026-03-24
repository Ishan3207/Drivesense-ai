from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal
import uuid


# ── Telemetry ─────────────────────────────────────────────────────────────────

class TelemetryFrame(BaseModel):
    """Live OBD-II telemetry snapshot emitted by the simulator."""
    rpm: float = Field(..., ge=0, le=8000, description="Engine RPM")
    speed_kmh: float = Field(..., ge=0, le=300, description="Vehicle speed in km/h")
    engine_load_pct: float = Field(..., ge=0, le=100, description="Engine load %")
    coolant_temp_c: float = Field(..., description="Coolant temperature in Celsius")
    throttle_pos_pct: float = Field(..., ge=0, le=100, description="Throttle position %")
    fuel_level_pct: float = Field(..., ge=0, le=100, description="Fuel level %")
    intake_air_temp_c: float = Field(..., description="Intake air temperature Celsius")
    maf_g_per_sec: float = Field(..., ge=0, description="Mass Air Flow g/s")
    battery_voltage: float = Field(..., description="Battery voltage")
    active_dtcs: list[str] = Field(default_factory=list, description="Currently active DTC codes")
    gear: int = Field(default=1, ge=0, le=6, description="Current gear (0 = neutral)")
    oil_temp_c: float = Field(default=50.0, description="Oil temperature in Celsius")
    turbo_boost_psi: float = Field(default=0.0, description="Turbo boost pressure in PSI")
    timestamp: float = Field(..., description="Unix epoch timestamp")


class SimulatorControlRequest(BaseModel):
    """Body for POST /api/v1/mock/control"""
    mode: Optional[Literal["idle", "accelerating", "cruising", "decelerating"]] = None
    speed_kmh: Optional[float] = Field(default=None, ge=0, le=250)
    rpm: Optional[float] = Field(default=None, ge=0, le=8000)
    throttle_pos_pct: Optional[float] = Field(default=None, ge=0, le=100)
    fuel_level_pct: Optional[float] = Field(default=None, ge=0, le=100)
    inject_dtc: Optional[str] = Field(default=None, description="DTC code to inject, e.g. P0300")
    clear_dtcs: Optional[bool] = False
    reset: Optional[bool] = False


class DTCEntry(BaseModel):
    code: str
    description: str
    severity: str  # low | medium | high | critical


class MockDTCResponse(BaseModel):
    vehicle_id: Optional[str] = None
    dtcs: list[DTCEntry]
    scan_timestamp: float
