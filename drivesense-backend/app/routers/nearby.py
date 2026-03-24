"""
Nearby Services Router
──────────────────────
Finds nearby auto repair shops and petrol/fuel stations.
Uses Google Places API; falls back to realistic mock data when no API key is set.

Endpoints:
  GET /api/v1/nearby/shops   – nearby auto repair workshops
  GET /api/v1/nearby/fuel    – nearby petrol / fuel stations
  GET /api/v1/nearby/all     – both mechanics + fuel in one call (used by dashboard)
"""

from __future__ import annotations

import logging
import math
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()


# ── Shared schema ──────────────────────────────────────────────────────────────

class PlaceResult(BaseModel):
    place_id: str
    name: str
    address: str
    place_type: str           # "mechanic" | "fuel"
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    distance_km: Optional[float] = None
    open_now: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    maps_url: str


class NearbyAllResponse(BaseModel):
    mechanics: list[PlaceResult]
    fuel: list[PlaceResult]


# ── Mock data ──────────────────────────────────────────────────────────────────

MOCK_MECHANICS: list[PlaceResult] = [
    PlaceResult(
        place_id="mock_m001", name="AutoZone Expert Services", place_type="mechanic",
        address="1234 Main St, San Francisco, CA",
        rating=4.7, user_ratings_total=312, distance_km=0.8, open_now=True,
        latitude=37.7762, longitude=-122.4183,
        maps_url="https://maps.google.com/?q=AutoZone+Expert+Services+San+Francisco",
    ),
    PlaceResult(
        place_id="mock_m002", name="Pep Boys Auto Parts & Service", place_type="mechanic",
        address="5678 Market St, San Francisco, CA",
        rating=4.3, user_ratings_total=198, distance_km=1.4, open_now=True,
        latitude=37.7740, longitude=-122.4220,
        maps_url="https://maps.google.com/?q=Pep+Boys+San+Francisco",
    ),
    PlaceResult(
        place_id="mock_m003", name="Midas Muffler & Brakes", place_type="mechanic",
        address="910 Mission Blvd, San Francisco, CA",
        rating=4.1, user_ratings_total=87, distance_km=2.1, open_now=False,
        latitude=37.7720, longitude=-122.4205,
        maps_url="https://maps.google.com/?q=Midas+San+Francisco",
    ),
    PlaceResult(
        place_id="mock_m004", name="Jiffy Lube", place_type="mechanic",
        address="2020 Valencia St, San Francisco, CA",
        rating=4.5, user_ratings_total=523, distance_km=2.9, open_now=True,
        latitude=37.7700, longitude=-122.4214,
        maps_url="https://maps.google.com/?q=Jiffy+Lube+San+Francisco",
    ),
]

MOCK_FUEL: list[PlaceResult] = [
    PlaceResult(
        place_id="mock_f001", name="Chevron Station", place_type="fuel",
        address="100 Divisadero St, San Francisco, CA",
        rating=4.2, user_ratings_total=145, distance_km=0.4, open_now=True,
        latitude=37.7756, longitude=-122.4200,
        maps_url="https://maps.google.com/?q=Chevron+Divisadero+San+Francisco",
    ),
    PlaceResult(
        place_id="mock_f002", name="Shell Fuel Station", place_type="fuel",
        address="750 Fell St, San Francisco, CA",
        rating=4.0, user_ratings_total=89, distance_km=1.1, open_now=True,
        latitude=37.7731, longitude=-122.4232,
        maps_url="https://maps.google.com/?q=Shell+Fell+St+San+Francisco",
    ),
    PlaceResult(
        place_id="mock_f003", name="BP Petrol & Convenience", place_type="fuel",
        address="300 Haight St, San Francisco, CA",
        rating=3.9, user_ratings_total=62, distance_km=1.7, open_now=True,
        latitude=37.7714, longitude=-122.4216,
        maps_url="https://maps.google.com/?q=BP+Haight+San+Francisco",
    ),
    PlaceResult(
        place_id="mock_f004", name="Valero Fast Fuel", place_type="fuel",
        address="480 Castro St, San Francisco, CA",
        rating=4.4, user_ratings_total=231, distance_km=2.3, open_now=False,
        latitude=37.7693, longitude=-122.4197,
        maps_url="https://maps.google.com/?q=Valero+Castro+San+Francisco",
    ),
]


# ── Google Places helper ───────────────────────────────────────────────────────

async def _fetch_places(
    lat: float, lng: float, radius_m: int, place_type: str, max_results: int, ptype_label: str
) -> list[PlaceResult]:
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius_m,
        "type": place_type,
        "key": settings.google_maps_api_key,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Google Places API error")

    results: list[PlaceResult] = []
    for p in resp.json().get("results", [])[:max_results]:
        loc = p.get("geometry", {}).get("location", {})
        results.append(PlaceResult(
            place_id=p.get("place_id", ""),
            name=p.get("name", "Unknown"),
            address=p.get("vicinity", ""),
            place_type=ptype_label,
            rating=p.get("rating"),
            user_ratings_total=p.get("user_ratings_total"),
            open_now=p.get("opening_hours", {}).get("open_now"),
            latitude=loc.get("lat"),
            longitude=loc.get("lng"),
            maps_url=f"https://maps.google.com/?place_id={p.get('place_id', '')}",
        ))
    return results


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/shops", response_model=list[PlaceResult], tags=["Nearby Fix"])
async def nearby_repair_shops(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius_m: int = Query(default=5000, le=50000),
    max_results: int = Query(default=5, le=10),
):
    """Find top-rated nearby auto repair/mechanic shops. Falls back to mock data if no API key."""
    if not settings.google_maps_api_key:
        logger.warning("GOOGLE_MAPS_API_KEY not set – returning mock mechanic data.")
        return MOCK_MECHANICS[:max_results]
    return await _fetch_places(lat, lng, radius_m, "car_repair", max_results, "mechanic")


@router.get("/fuel", response_model=list[PlaceResult], tags=["Nearby Fix"])
async def nearby_fuel_stations(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius_m: int = Query(default=5000, le=50000),
    max_results: int = Query(default=5, le=10),
):
    """Find nearby petrol / fuel stations. Falls back to mock data if no API key."""
    if not settings.google_maps_api_key:
        logger.warning("GOOGLE_MAPS_API_KEY not set – returning mock fuel data.")
        return MOCK_FUEL[:max_results]
    return await _fetch_places(lat, lng, radius_m, "gas_station", max_results, "fuel")


@router.get("/all", response_model=NearbyAllResponse, tags=["Nearby Fix"])
async def nearby_all(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius_m: int = Query(default=5000, le=50000),
    max_results: int = Query(default=5, le=10),
):
    """
    Combined endpoint – returns nearby mechanics AND fuel stations in one request.
    Used by the web dashboard map panel.
    """
    if not settings.google_maps_api_key:
        return NearbyAllResponse(
            mechanics=MOCK_MECHANICS[:max_results],
            fuel=MOCK_FUEL[:max_results],
        )
    mechanics = await _fetch_places(lat, lng, radius_m, "car_repair", max_results, "mechanic")
    fuel = await _fetch_places(lat, lng, radius_m, "gas_station", max_results, "fuel")
    return NearbyAllResponse(mechanics=mechanics, fuel=fuel)
