from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
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
    timestamp: float = Field(..., description="Unix epoch timestamp")


class DTCEntry(BaseModel):
    code: str
    description: str
    severity: str  # low | medium | high | critical


class MockDTCResponse(BaseModel):
    vehicle_id: Optional[str] = None
    dtcs: list[DTCEntry]
    scan_timestamp: float
