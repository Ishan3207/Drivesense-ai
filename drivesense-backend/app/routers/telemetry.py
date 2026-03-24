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
    register_ws_client,
    unregister_ws_client,
)
from app.schemas.telemetry import TelemetryFrame, MockDTCResponse

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
