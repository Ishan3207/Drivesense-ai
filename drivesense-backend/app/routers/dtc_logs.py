"""
DTC Logs Router – store and retrieve Diagnostic Trouble Code history.
Endpoints:
  POST   /api/v1/dtc-logs                   – record a new DTC event
  GET    /api/v1/dtc-logs                   – list logs (filter by vehicle/resolved)
  GET    /api/v1/dtc-logs/{id}              – get a specific DTC log
  PATCH  /api/v1/dtc-logs/{id}              – update (mark resolved, add LLM analysis)
  DELETE /api/v1/dtc-logs/{id}              – delete a DTC log
"""

from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.dtc import DTCLogCreate, DTCLogRead, DTCLogUpdate
from app.crud import dtc as crud

router = APIRouter(tags=["DTC Logs"])


@router.post("", response_model=DTCLogRead, status_code=status.HTTP_201_CREATED)
async def create_dtc_log(data: DTCLogCreate, db: AsyncSession = Depends(get_db)):
    """Record a new DTC event for a vehicle."""
    return await crud.create_dtc_log(db, data)


@router.get("", response_model=List[DTCLogRead])
async def list_dtc_logs(
    vehicle_id: Optional[uuid.UUID] = Query(None, description="Filter by vehicle UUID"),
    resolved: Optional[bool] = Query(None, description="Filter by resolution status"),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List DTC logs, optionally filtered by vehicle and/or resolution status."""
    return await crud.list_dtc_logs(db, vehicle_id=vehicle_id, resolved=resolved, skip=skip, limit=limit)


@router.get("/{log_id}", response_model=DTCLogRead)
async def get_dtc_log(log_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve a single DTC log entry by its UUID."""
    log = await crud.get_dtc_log(db, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="DTC log not found")
    return log


@router.patch("/{log_id}", response_model=DTCLogRead)
async def update_dtc_log(
    log_id: uuid.UUID, data: DTCLogUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a DTC log (e.g., mark as resolved or attach LLM analysis)."""
    log = await crud.update_dtc_log(db, log_id, data)
    if log is None:
        raise HTTPException(status_code=404, detail="DTC log not found")
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dtc_log(log_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a specific DTC log entry."""
    deleted = await crud.delete_dtc_log(db, log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="DTC log not found")
