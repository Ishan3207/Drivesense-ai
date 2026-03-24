"""
CRUD operations for DriverScore model.
"""

from __future__ import annotations

import uuid
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DriverScore
from app.schemas.vehicle import DriverScoreCreate, DriverScoreRead


async def record_score(db: AsyncSession, data: DriverScoreCreate) -> DriverScore:
    entry = DriverScore(**data.model_dump())
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def list_scores(
    db: AsyncSession,
    vehicle_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> List[DriverScore]:
    result = await db.execute(
        select(DriverScore)
        .where(DriverScore.vehicle_id == vehicle_id)
        .order_by(DriverScore.recorded_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def latest_score(db: AsyncSession, vehicle_id: uuid.UUID) -> Optional[DriverScore]:
    result = await db.execute(
        select(DriverScore)
        .where(DriverScore.vehicle_id == vehicle_id)
        .order_by(DriverScore.recorded_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
