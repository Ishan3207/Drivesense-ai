"""
CRUD operations for DTCLog model.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DTCLog
from app.schemas.dtc import DTCLogCreate, DTCLogUpdate


async def create_dtc_log(db: AsyncSession, data: DTCLogCreate) -> DTCLog:
    log = DTCLog(**data.model_dump())
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


async def get_dtc_log(db: AsyncSession, log_id: uuid.UUID) -> Optional[DTCLog]:
    result = await db.execute(select(DTCLog).where(DTCLog.id == log_id))
    return result.scalar_one_or_none()


async def list_dtc_logs(
    db: AsyncSession,
    vehicle_id: Optional[uuid.UUID] = None,
    resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[DTCLog]:
    query = select(DTCLog)
    if vehicle_id is not None:
        query = query.where(DTCLog.vehicle_id == vehicle_id)
    if resolved is not None:
        query = query.where(DTCLog.resolved == resolved)
    query = query.order_by(DTCLog.detected_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_dtc_log(
    db: AsyncSession, log_id: uuid.UUID, data: DTCLogUpdate
) -> Optional[DTCLog]:
    log = await get_dtc_log(db, log_id)
    if log is None:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)
    # If marking resolved, stamp the timestamp
    if update_data.get("resolved") is True and log.resolved_at is None:
        log.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(log)
    return log


async def delete_dtc_log(db: AsyncSession, log_id: uuid.UUID) -> bool:
    log = await get_dtc_log(db, log_id)
    if log is None:
        return False
    await db.delete(log)
    await db.flush()
    return True
