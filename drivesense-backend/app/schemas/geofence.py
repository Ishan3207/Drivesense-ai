from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
import uuid


class GeofenceZone(BaseModel):
    id: Optional[str] = None
    name: str
    zone_type: str  # school | hospital | residential | custom
    latitude: float
    longitude: float
    radius_meters: float = 300.0
    speed_limit_kmh: float = 25.0
    active: bool = True


class GeofenceCheckRequest(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: float = 0.0


class GeofenceCheckResponse(BaseModel):
    inside_zone: bool
    zone: Optional[GeofenceZone] = None
    speeding: bool = False
    speed_excess_kmh: float = 0.0
