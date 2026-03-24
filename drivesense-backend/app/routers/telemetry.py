"""
Telemetry Router
────────────────
Provides:
  GET  /api/v1/mock/telemetry   – REST snapshot of current simulated data
  GET  /api/v1/mock/dtcs        – Active DTC list (REST)
  WS   /ws/telemetry            – Real-time WebSocket stream (500ms frames)
"""

from __future__ import annotations

import time
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.obd_simulator import (
    get_latest_frame,
    get_active_dtcs,
    apply_control,
    get_fault_pool,
    register_ws_client,
    unregister_ws_client,
)
from app.schemas.telemetry import TelemetryFrame, MockDTCResponse, SimulatorControlRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/mock/telemetry", response_model=TelemetryFrame, tags=["Mock Simulator"])
async def rest_telemetry_snapshot():
    """
    REST polling fallback: returns the latest simulated OBD-II telemetry frame.
    Use this if WebSocket is unavailable on the client.
    """
    return get_latest_frame()


@router.get("/mock/dtcs", response_model=MockDTCResponse, tags=["Mock Simulator"])
async def rest_active_dtcs():
    """Returns currently active injected DTC fault codes."""
    return MockDTCResponse(
        dtcs=get_active_dtcs(),
        scan_timestamp=time.time(),
    )
@router.get("/mock/fault-pool", tags=["Mock Simulator"])
async def rest_fault_pool():
    """Returns the list of available DTC codes that can be injected."""
    return {"fault_pool": get_fault_pool()}


@router.post("/mock/control", tags=["Mock Simulator"])
async def rest_simulator_control(body: SimulatorControlRequest):
    """
    Interactive simulator control panel.

    Examples:
    - `{"mode": "accelerating"}` — floor the throttle
    - `{"speed_kmh": 80}` — hold speed at 80 km/h
    - `{"inject_dtc": "P0300"}` — inject a fault code
    - `{"clear_dtcs": true}` — clear all faults
    - `{"reset": true}` — restart the simulation from cold idle
    """
    result = apply_control(
        mode=body.mode,
        speed_kmh=body.speed_kmh,
        rpm=body.rpm,
        throttle_pos_pct=body.throttle_pos_pct,
        fuel_level_pct=body.fuel_level_pct,
        inject_dtc=body.inject_dtc,
        clear_dtcs=body.clear_dtcs or False,
        reset=body.reset or False,
    )
    return result


@router.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    """
    WebSocket endpoint: streams a TelemetryFrame JSON object every 500ms.
    The simulator loop handles broadcasting; this just registers/unregisters the socket.
    """
    await websocket.accept()
    register_ws_client(websocket)
    logger.info("WS client connected. Total: %d", 1)
    try:
        # Keep connection alive — simulator loop sends data
        while True:
            # We await receive to detect client disconnection
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WS client disconnected.")
    finally:
        unregister_ws_client(websocket)
