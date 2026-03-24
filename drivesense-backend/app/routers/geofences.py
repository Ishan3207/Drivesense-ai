"""
Geofence Service & Router
──────────────────────────
Manages safety zones (school, hospital, residential) and
checks whether a GPS position falls within a zone.
"""

from __future__ import annotations

import math
import logging
import uuid
from typing import Optional
from fastapi import APIRouter

from app.schemas.geofence import GeofenceZone, GeofenceCheckRequest, GeofenceCheckResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Mock zone seed data ────────────────────────────────────────────────────────
# These coordinates are landmarks used as demo zones.
# Users can add custom zones via the mobile app.

MOCK_ZONES: list[GeofenceZone] = [
    GeofenceZone(
        id=str(uuid.uuid4()),
        name="Lincoln Elementary School",
        zone_type="school",
        latitude=37.7749,
        longitude=-122.4194,
        radius_meters=300.0,
        speed_limit_kmh=25.0,
    ),
    GeofenceZone(
        id=str(uuid.uuid4()),
        name="St. Mary's Hospital",
        zone_type="hospital",
        latitude=37.7765,
        longitude=-122.4172,
        radius_meters=250.0,
        speed_limit_kmh=30.0,
    ),
    GeofenceZone(
        id=str(uuid.uuid4()),
        name="Sunrise Residential Area",
        zone_type="residential",
        latitude=37.7735,
        longitude=-122.4210,
        radius_meters=500.0,
        speed_limit_kmh=40.0,
    ),
]

_zones: list[GeofenceZone] = list(MOCK_ZONES)


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in metres between two GPS coordinates."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def check_position(lat: float, lon: float, speed_kmh: float = 0.0) -> GeofenceCheckResponse:
    """Return the first active zone the coordinate falls inside, if any."""
    for zone in _zones:
        if not zone.active:
            continue
        dist = _haversine_m(lat, lon, zone.latitude, zone.longitude)
        if dist <= zone.radius_meters:
            excess = max(0.0, speed_kmh - zone.speed_limit_kmh)
            return GeofenceCheckResponse(
                inside_zone=True,
                zone=zone,
                speeding=excess > 0,
                speed_excess_kmh=round(excess, 1),
            )
    return GeofenceCheckResponse(inside_zone=False)


# ── Router endpoints ───────────────────────────────────────────────────────────

@router.get("", response_model=list[GeofenceZone], tags=["Geofencing"])
async def list_geofences():
    """Returns all configured geofence safety zones."""
    return _zones


@router.post("/check", response_model=GeofenceCheckResponse, tags=["Geofencing"])
async def check_geofence(req: GeofenceCheckRequest) -> GeofenceCheckResponse:
    """
    Check if a GPS coordinate is inside any active geofence zone.
    If speed is provided and exceeds the zone limit, speeding=True.
    """
    return check_position(req.latitude, req.longitude, req.speed_kmh)


@router.post("/add", response_model=GeofenceZone, tags=["Geofencing"])
async def add_geofence(zone: GeofenceZone) -> GeofenceZone:
    """Add a custom geofence zone."""
    if not zone.id:
        zone.id = str(uuid.uuid4())
    _zones.append(zone)
    return zone
