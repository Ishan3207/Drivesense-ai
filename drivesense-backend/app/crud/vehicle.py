"""
CRUD operations for Vehicle model.
All functions are async-first and accept an AsyncSession.
"""

from __future__ import annotations

import uuid
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


async def create_vehicle(db: AsyncSession, data: VehicleCreate) -> Vehicle:
    vehicle = Vehicle(**data.model_dump())
    db.add(vehicle)
    await db.flush()
    await db.refresh(vehicle)
    return vehicle


async def get_vehicle(db: AsyncSession, vehicle_id: uuid.UUID) -> Optional[Vehicle]:
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    return result.scalar_one_or_none()


async def list_vehicles(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Vehicle]:
    result = await db.execute(select(Vehicle).offset(skip).limit(limit))
    return list(result.scalars().all())


async def update_vehicle(
    db: AsyncSession, vehicle_id: uuid.UUID, data: VehicleUpdate
) -> Optional[Vehicle]:
    vehicle = await get_vehicle(db, vehicle_id)
    if vehicle is None:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)
    await db.flush()
    await db.refresh(vehicle)
    return vehicle


async def delete_vehicle(db: AsyncSession, vehicle_id: uuid.UUID) -> bool:
    vehicle = await get_vehicle(db, vehicle_id)
    if vehicle is None:
        return False
    await db.delete(vehicle)
    await db.flush()
    return True
