"""
Driver Score Router – persisted score history and latest score per vehicle.
Endpoints:
  POST  /api/v1/driver-scores               – record a score event
  GET   /api/v1/driver-scores/{vehicle_id}  – list score history for vehicle
  GET   /api/v1/driver-scores/{vehicle_id}/latest – most recent score snapshot
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.vehicle import DriverScoreCreate, DriverScoreRead
from app.crud import driver_score as crud

router = APIRouter(tags=["Driver Scores"])


@router.post("", response_model=DriverScoreRead, status_code=status.HTTP_201_CREATED)
async def record_score(data: DriverScoreCreate, db: AsyncSession = Depends(get_db)):
    """Persist a driver score snapshot (called by the scoring engine)."""
    return await crud.record_score(db, data)


@router.get("/{vehicle_id}", response_model=List[DriverScoreRead])
async def list_scores(
    vehicle_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Return chronological driver score history for a given vehicle."""
    return await crud.list_scores(db, vehicle_id, skip=skip, limit=limit)


@router.get("/{vehicle_id}/latest", response_model=DriverScoreRead)
async def latest_score(vehicle_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return the most recent driver score for a vehicle."""
    score = await crud.latest_score(db, vehicle_id)
    if score is None:
        raise HTTPException(
            status_code=404, detail="No score records found for this vehicle"
        )
    return score
