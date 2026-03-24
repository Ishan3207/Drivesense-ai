"""
OBD-II Mock Simulator Service
──────────────────────────────
Generates realistic ELM327 telemetry data without a physical OBD adapter.
Runs a background async loop emitting WebSocket frames every 500ms.
Also provides a REST snapshot endpoint for polling fallback.

Behaviour:
  - Simulates engine warm-up, cruise, acceleration, and idle states
  - Randomly injects DTCs from a known fault pool (every ~60–120 s)
  - Clears injected DTCs after 90 s to simulate "intermittent" faults
"""

from __future__ import annotations

import asyncio
import math
import random
import time
import logging
from dataclasses import dataclass, field
from typing import Optional

from app.schemas.telemetry import TelemetryFrame, DTCEntry

logger = logging.getLogger(__name__)

# ── DTC fault pool ────────────────────────────────────────────────────────────

FAULT_POOL: list[DTCEntry] = [
    DTCEntry(code="P0300", description="Random/Multiple Cylinder Misfire Detected", severity="high"),
    DTCEntry(code="P0420", description="Catalyst System Efficiency Below Threshold (Bank 1)", severity="medium"),
    DTCEntry(code="P0171", description="System Too Lean (Bank 1)", severity="medium"),
    DTCEntry(code="P0128", description="Coolant Temperature Below Thermostat Regulating Temperature", severity="low"),
    DTCEntry(code="P0401", description="Exhaust Gas Recirculation Flow Insufficient Detected", severity="medium"),
    DTCEntry(code="P0442", description="Evaporative Emission System Leak Detected (Small Leak)", severity="low"),
    DTCEntry(code="P0507", description="Idle Control System RPM High", severity="medium"),
    DTCEntry(code="C0035", description="Right Front Wheel Speed Sensor Circuit", severity="high"),
]

FAULT_SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


# ── Engine state machine ──────────────────────────────────────────────────────

@dataclass
class EngineState:
    """Holds running simulation state between ticks."""
    # Driving state: idle | accelerating | cruising | decelerating
    mode: str = "idle"
    mode_counter: int = 0           # ticks remaining in current mode

    # Current values (smoothly mutated each tick)
    rpm: float = 750.0
    speed_kmh: float = 0.0
    engine_load_pct: float = 12.0
    coolant_temp_c: float = 22.0    # starts cold, warms up
    throttle_pos_pct: float = 5.0
    fuel_level_pct: float = 72.0
    intake_air_temp_c: float = 24.0
    maf_g_per_sec: float = 2.0
    battery_voltage: float = 12.6

    # DTC injection timing
    next_dtc_injection_at: float = field(default_factory=lambda: time.time() + random.uniform(60, 120))
    injected_dtcs: list[DTCEntry] = field(default_factory=list)
    dtc_clear_at: Optional[float] = None

    # Uptime for warm-up simulation
    started_at: float = field(default_factory=time.time)


def _lerp(current: float, target: float, alpha: float = 0.08) -> float:
    """Smooth interpolation step."""
    return current + (target - current) * alpha


def _jitter(value: float, amount: float) -> float:
    """Add tiny realistic sensor noise."""
    return value + random.uniform(-amount, amount)


def tick(state: EngineState) -> TelemetryFrame:
    """
    Advance simulation by one tick (~500ms).
    Returns a fresh TelemetryFrame.
    """
    now = time.time()
    uptime = now - state.started_at

    # ── Warm-up phase (first 120 s) ──────────────────────────────────────────
    warm_target = 90.0
    if uptime < 120:
        warm_ratio = uptime / 120.0
        state.coolant_temp_c = _lerp(state.coolant_temp_c, 22 + (warm_target - 22) * warm_ratio, 0.03)
    else:
        state.coolant_temp_c = _lerp(state.coolant_temp_c, warm_target + 2, 0.01)

    # ── Ambient air (barely changes) ──────────────────────────────────────────
    state.intake_air_temp_c = _jitter(state.intake_air_temp_c, 0.2)

    # ── Mode state machine ────────────────────────────────────────────────────
    state.mode_counter -= 1
    if state.mode_counter <= 0:
        state.mode = random.choices(
            ["idle", "accelerating", "cruising", "decelerating"],
            weights=[20, 30, 35, 15],
        )[0]
        state.mode_counter = random.randint(8, 25)   # 4–12.5 seconds per mode

    if state.mode == "idle":
        target_rpm = random.uniform(700, 850)
        target_speed = 0.0
        target_load = random.uniform(10, 18)
        target_throttle = random.uniform(3, 8)
    elif state.mode == "accelerating":
        target_rpm = random.uniform(2500, 4500)
        target_speed = min(state.speed_kmh + random.uniform(5, 15), 120)
        target_load = random.uniform(65, 95)
        target_throttle = random.uniform(55, 90)
    elif state.mode == "cruising":
        current_cruise = max(state.speed_kmh, 40)
        target_rpm = 1400 + current_cruise * 18
        target_speed = current_cruise + random.uniform(-3, 3)
        target_load = random.uniform(25, 45)
        target_throttle = random.uniform(20, 40)
    else:  # decelerating
        target_rpm = max(state.rpm - random.uniform(200, 500), 750)
        target_speed = max(state.speed_kmh - random.uniform(5, 20), 0)
        target_load = random.uniform(5, 20)
        target_throttle = random.uniform(2, 10)

    state.rpm = _lerp(state.rpm, target_rpm, 0.12)
    state.speed_kmh = max(0, _lerp(state.speed_kmh, target_speed, 0.10))
    state.engine_load_pct = _lerp(state.engine_load_pct, target_load, 0.10)
    state.throttle_pos_pct = _lerp(state.throttle_pos_pct, target_throttle, 0.10)

    # MAF correlates with RPM and load
    state.maf_g_per_sec = _lerp(
        state.maf_g_per_sec,
        (state.rpm / 8000) * (state.engine_load_pct / 100) * 25,
        0.15,
    )

    # Fuel slowly drains
    state.fuel_level_pct = max(0, state.fuel_level_pct - 0.00005)

    # Battery drops a tiny bit during heavy load then recovers at idle
    if state.engine_load_pct > 60:
        state.battery_voltage = _lerp(state.battery_voltage, 13.8, 0.05)
    else:
        state.battery_voltage = _lerp(state.battery_voltage, 14.2, 0.02)

    # ── DTC injection / clearing ──────────────────────────────────────────────
    if now >= state.next_dtc_injection_at and not state.injected_dtcs:
        n = random.randint(1, 2)
        state.injected_dtcs = random.sample(FAULT_POOL, k=n)
        state.dtc_clear_at = now + random.uniform(60, 90)
        state.next_dtc_injection_at = now + random.uniform(60, 120)
        logger.info("🔴 Injected DTCs: %s", [d.code for d in state.injected_dtcs])

    if state.dtc_clear_at and now >= state.dtc_clear_at:
        logger.info("✅ Cleared DTCs: %s", [d.code for d in state.injected_dtcs])
        state.injected_dtcs = []
        state.dtc_clear_at = None

    return TelemetryFrame(
        rpm=round(_jitter(state.rpm, 15), 1),
        speed_kmh=round(max(0, _jitter(state.speed_kmh, 0.5)), 1),
        engine_load_pct=round(min(100, max(0, _jitter(state.engine_load_pct, 0.8))), 1),
        coolant_temp_c=round(_jitter(state.coolant_temp_c, 0.3), 1),
        throttle_pos_pct=round(min(100, max(0, _jitter(state.throttle_pos_pct, 0.5))), 1),
        fuel_level_pct=round(state.fuel_level_pct, 2),
        intake_air_temp_c=round(state.intake_air_temp_c, 1),
        maf_g_per_sec=round(max(0, _jitter(state.maf_g_per_sec, 0.1)), 2),
        battery_voltage=round(_jitter(state.battery_voltage, 0.05), 2),
        active_dtcs=[d.code for d in state.injected_dtcs],
        timestamp=now,
    )


# ── Singleton state + broadcast ───────────────────────────────────────────────

_engine_state = EngineState()
_latest_frame: Optional[TelemetryFrame] = None
_ws_clients: set = set()


def get_latest_frame() -> TelemetryFrame:
    """Return the most recently generated telemetry frame (for REST polling)."""
    global _latest_frame
    if _latest_frame is None:
        _latest_frame = tick(_engine_state)
    return _latest_frame


def get_active_dtcs() -> list[DTCEntry]:
    """Return currently injected DTC entries (for REST /mock/dtcs endpoint)."""
    return _engine_state.injected_dtcs


def register_ws_client(websocket) -> None:
    _ws_clients.add(websocket)


def unregister_ws_client(websocket) -> None:
    _ws_clients.discard(websocket)


async def simulator_loop() -> None:
    """
    Background task: tick the engine state every 500ms,
    cache the result, and broadcast to all connected WebSocket clients.
    """
    global _latest_frame, _ws_clients, _engine_state
    logger.info("🚗 OBD-II simulator started.")
    while True:
        try:
            frame = tick(_engine_state)
            _latest_frame = frame
            payload = frame.model_dump_json()

            dead_clients = set()
            for ws in list(_ws_clients):
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead_clients.add(ws)
            _ws_clients -= dead_clients
        except Exception as exc:
            logger.exception("Simulator tick error: %s", exc)
        await asyncio.sleep(0.5)
