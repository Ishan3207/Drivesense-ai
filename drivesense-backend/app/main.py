"""
FastAPI Application Entry Point – DriveSense AI Backend
--------------------------------------------------------
Startup sequence:
  1. Load settings from .env
  2. Register CORS middleware
  3. Mount all routers under /api/v1
  4. Start the OBD-II simulator background loop on app startup
  5. Mount WebSocket route /ws/telemetry

Health check: GET /health
API docs:     GET /docs  (Swagger UI)
              GET /redoc (ReDoc)
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.services.obd_simulator import simulator_loop
from app.routers import telemetry, diagnostics, geofences, nearby, vehicles, dtc_logs, driver_scores

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s – %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle handler."""
    logger.info("🚀 DriveSense AI Backend starting up…")
    # Attempt DB init — non-fatal if PostgreSQL is not available
    try:
        await init_db()
        logger.info("✅ Database tables verified / created.")
    except Exception as exc:
        logger.warning(
            "⚠️  Database unavailable – running in mock-only mode. "
            f"DB endpoints will return 503. Error: {exc}"
        )
    # Start mock OBD-II simulator in the background
    task = asyncio.create_task(simulator_loop())
    logger.info("✅ OBD-II simulator loop started.")
    yield
    # Graceful shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("🛑 DriveSense AI Backend shut down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="DriveSense AI – Backend API",
        description=(
            "Proactive vehicle health & geofenced safety ecosystem.\n\n"
            "**Phase 1** – Mock OBD-II simulator active. No real hardware needed.\n\n"
            "Connect to `WS /ws/telemetry` for live telemetry stream."
        ),
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    origins = [o.strip() for o in settings.cors_origins.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins != ["*"] else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── API Routers ────────────────────────────────────────────────────────────
    app.include_router(telemetry.router, prefix="/api/v1")
    app.include_router(diagnostics.router, prefix="/api/v1/diagnostics")
    app.include_router(geofences.router, prefix="/api/v1/geofences")
    app.include_router(nearby.router, prefix="/api/v1/nearby")
    # ── Database-backed CRUD Routers ───────────────────────────────────────────
    app.include_router(vehicles.router, prefix="/api/v1/vehicles")
    app.include_router(dtc_logs.router, prefix="/api/v1/dtc-logs")
    app.include_router(driver_scores.router, prefix="/api/v1/driver-scores")

    # ── Static Dashboard ───────────────────────────────────────────────────────
    app.mount("/dashboard", StaticFiles(directory="app/static", html=True), name="dashboard")

    # ── Health Check ───────────────────────────────────────────────────────────
    @app.get("/health", tags=["System"])
    async def health():
        return {"status": "ok", "version": "0.1.0", "simulator": "running"}

    return app


app = create_app()
