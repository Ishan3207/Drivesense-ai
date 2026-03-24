"""
Vehicles Router – full CRUD for registered vehicles.
Endpoints:
  POST   /api/v1/vehicles          – register a new vehicle
  GET    /api/v1/vehicles          – list all vehicles
  GET    /api/v1/vehicles/{id}     – get vehicle by ID
  PATCH  /api/v1/vehicles/{id}     – update vehicle fields
  DELETE /api/v1/vehicles/{id}     – remove vehicle
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate
from app.crud import vehicle as crud

router = APIRouter(tags=["Vehicles"])


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
async def register_vehicle(data: VehicleCreate, db: AsyncSession = Depends(get_db)):
    """Register a new vehicle in the system."""
    return await crud.create_vehicle(db, data)


@router.get("", response_model=List[VehicleRead])
async def list_vehicles(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """List all registered vehicles."""
    return await crud.list_vehicles(db, skip=skip, limit=limit)


@router.get("/{vehicle_id}", response_model=VehicleRead)
async def get_vehicle(vehicle_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve a single vehicle by its UUID."""
    vehicle = await crud.get_vehicle(db, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleRead)
async def update_vehicle(
    vehicle_id: uuid.UUID, data: VehicleUpdate, db: AsyncSession = Depends(get_db)
):
    """Update one or more fields on an existing vehicle."""
    vehicle = await crud.update_vehicle(db, vehicle_id, data)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(vehicle_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a vehicle and all its associated records (cascade)."""
    deleted = await crud.delete_vehicle(db, vehicle_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Vehicle not found")
