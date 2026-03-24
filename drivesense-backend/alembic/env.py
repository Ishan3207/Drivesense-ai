"""
Alembic Environment Configuration for DriveSense AI Backend
-------------------------------------------------------------
Reads DATABASE_URL from app settings (respects .env file).
Uses asyncpg driver for async-aware migrations.
"""

from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Import all models so Alembic can detect them in metadata
from app.models.models import Base  # noqa: F401  – registers all table metadata

# ── Alembic Config ─────────────────────────────────────────────────────────────
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_database_url() -> str:
    """Resolve the DB URL from env var or app settings."""
    url = os.getenv("DATABASE_URL")
    if url:
        # Ensure asyncpg driver
        return url.replace("postgresql://", "postgresql+asyncpg://")
    # Fall back to pydantic-settings
    from app.config import get_settings
    return get_settings().database_url


# ── Offline mode ───────────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """Run migrations without a live DB connection.
    Emits SQL to stdout for review. Useful in CI/CD pipelines."""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode ────────────────────────────────────────────────────────────────

def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create async engine and run migrations through a sync shim."""
    url = get_database_url()
    connectable = create_async_engine(url, echo=False)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ── Entry point ────────────────────────────────────────────────────────────────

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
