"""
OBD-II Mock Simulator Service  –  Physics-Based Edition
──────────────────────────────────────────────────────
Generates realistic ELM327 telemetry with proper automotive physics:
  • Gear selection (1–6) via RPM and speed coupling
  • Oil temperature warm-up curve (slower than coolant)
  • Turbo boost proportional to throttle × RPM
  • Gear-shift lag: brief RPM drop/spike on shift
  • Speed ↔ RPM coupling: RPM = speed × gear_ratio / wheel_circumference

Interactive control via `apply_control()` called by the REST endpoint.
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

FAULT_POOL: dict[str, DTCEntry] = {
    "P0300": DTCEntry(code="P0300", description="Random/Multiple Cylinder Misfire Detected", severity="high"),
    "P0420": DTCEntry(code="P0420", description="Catalyst System Efficiency Below Threshold (Bank 1)", severity="medium"),
    "P0171": DTCEntry(code="P0171", description="System Too Lean (Bank 1)", severity="medium"),
    "P0128": DTCEntry(code="P0128", description="Coolant Temperature Below Thermostat Regulating Temperature", severity="low"),
    "P0401": DTCEntry(code="P0401", description="Exhaust Gas Recirculation Flow Insufficient Detected", severity="medium"),
    "P0442": DTCEntry(code="P0442", description="Evaporative Emission System Leak Detected (Small Leak)", severity="low"),
    "P0507": DTCEntry(code="P0507", description="Idle Control System RPM High", severity="medium"),
    "C0035": DTCEntry(code="C0035", description="Right Front Wheel Speed Sensor Circuit", severity="high"),
}

# ── Gear ratios (approximating a 6-speed manual, including final drive) ───────
# Value = effective RPM per km/h – higher = more RPM per unit speed (low gear)
GEAR_RPM_PER_KMH = [0, 110, 70, 45, 32, 24, 19]   # index 0 = neutral/unused


def _ideal_gear(speed_kmh: float, rpm: float) -> int:
    """Pick the ideal gear so RPM stays in the 1500–3200 comfortable cruise band."""
    if speed_kmh < 5:
        return 1
    for gear in range(6, 0, -1):
        predicted_rpm = speed_kmh * GEAR_RPM_PER_KMH[gear]
        if predicted_rpm >= 1400:
            return gear
    return 1


def _gear_rpm(speed_kmh: float, gear: int) -> float:
    """Expected RPM for a given speed + gear."""
    return max(800, speed_kmh * GEAR_RPM_PER_KMH[max(1, gear)])


# ── Smooth helpers ────────────────────────────────────────────────────────────

def _lerp(current: float, target: float, alpha: float = 0.08) -> float:
    return current + (target - current) * alpha


def _jitter(value: float, amount: float) -> float:
    return value + random.uniform(-amount, amount)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# ── Engine state machine ──────────────────────────────────────────────────────

@dataclass
class EngineState:
    mode: str = "idle"
    mode_counter: int = 0

    rpm: float = 780.0
    speed_kmh: float = 0.0
    engine_load_pct: float = 12.0
    coolant_temp_c: float = 22.0
    throttle_pos_pct: float = 5.0
    fuel_level_pct: float = 72.0
    intake_air_temp_c: float = 24.0
    maf_g_per_sec: float = 2.0
    battery_voltage: float = 12.6

    # New physics fields
    gear: int = 1
    oil_temp_c: float = 20.0        # Oil warms slower than coolant
    turbo_boost_psi: float = 0.0

    # Gear shift state
    shifting: bool = False
    shift_ticks_left: int = 0
    target_gear: int = 1

    # DTC
    next_dtc_injection_at: float = field(default_factory=lambda: time.time() + random.uniform(60, 120))
    injected_dtcs: dict[str, DTCEntry] = field(default_factory=dict)
    dtc_clear_at: Optional[float] = None

    started_at: float = field(default_factory=time.time)

    # Manual control overrides (applied once per tick then cleared unless sticky=True)
    _override_mode: Optional[str] = None
    _override_speed: Optional[float] = None
    _override_rpm: Optional[float] = None
    _override_throttle: Optional[float] = None
    _override_fuel: Optional[float] = None
    _override_sticky: bool = False   # if True, overrides persist; if False, applied once


def tick(state: EngineState) -> TelemetryFrame:
    now = time.time()
    uptime = now - state.started_at

    # ── Apply manual overrides ────────────────────────────────────────────────
    if state._override_mode is not None:
        state.mode = state._override_mode
        state.mode_counter = 999   # hold mode indefinitely until next control call
        if not state._override_sticky:
            state._override_mode = None

    if state._override_throttle is not None:
        state.throttle_pos_pct = state._override_throttle
        if not state._override_sticky:
            state._override_throttle = None

    if state._override_fuel is not None:
        state.fuel_level_pct = state._override_fuel
        state._override_fuel = None

    # Speed override sets a hard target; RPM is derived from gear
    if state._override_speed is not None:
        state.speed_kmh = _lerp(state.speed_kmh, state._override_speed, 0.25)
        if not state._override_sticky:
            state._override_speed = None

    if state._override_rpm is not None:
        state.rpm = _lerp(state.rpm, state._override_rpm, 0.25)
        if not state._override_sticky:
            state._override_rpm = None

    # ── Thermal warm-up ───────────────────────────────────────────────────────
    # Coolant: reaches 90°C within ~120 s
    warm_ratio = min(uptime / 120.0, 1.0)
    coolant_target = 22 + (90 - 22) * warm_ratio + random.uniform(-0.5, 0.5)
    state.coolant_temp_c = _lerp(state.coolant_temp_c, coolant_target, 0.04)

    # Oil: lags coolant by ~30 s (slower mass, different circuit)
    oil_warm_ratio = min(uptime / 160.0, 1.0)
    oil_target = 20 + (100 - 20) * oil_warm_ratio   # oil runs hotter than coolant
    state.oil_temp_c = _lerp(state.oil_temp_c, oil_target, 0.02)

    state.intake_air_temp_c = _jitter(state.intake_air_temp_c, 0.2)

    # ── Mode state machine ────────────────────────────────────────────────────
    state.mode_counter -= 1
    if state.mode_counter <= 0 and state._override_mode is None:
        state.mode = random.choices(
            ["idle", "accelerating", "cruising", "decelerating"],
            weights=[20, 30, 35, 15],
        )[0]
        state.mode_counter = random.randint(10, 30)

    if state.mode == "idle":
        t_speed = 0.0
        t_throttle = random.uniform(3, 8)
        t_load = random.uniform(10, 18)
    elif state.mode == "accelerating":
        t_speed = min(state.speed_kmh + random.uniform(3, 12), 220)
        t_throttle = random.uniform(55, 95)
        t_load = random.uniform(65, 95)
    elif state.mode == "cruising":
        base = max(state.speed_kmh, 40)
        t_speed = base + random.uniform(-2, 2)
        t_throttle = random.uniform(18, 38)
        t_load = random.uniform(25, 45)
    else:  # decelerating
        t_speed = max(state.speed_kmh - random.uniform(4, 18), 0)
        t_throttle = random.uniform(1, 8)
        t_load = random.uniform(5, 18)

    if state._override_speed is None:
        state.speed_kmh = _clamp(_lerp(state.speed_kmh, t_speed, 0.10), 0, 250)
    if state._override_throttle is None:
        state.throttle_pos_pct = _lerp(state.throttle_pos_pct, t_throttle, 0.10)
    state.engine_load_pct = _lerp(state.engine_load_pct, t_load, 0.10)

    # ── Gear physics ─────────────────────────────────────────────────────────
    ideal = _ideal_gear(state.speed_kmh, state.rpm)
    if ideal != state.gear and not state.shifting:
        # Trigger a gear shift
        state.shifting = True
        state.shift_ticks_left = random.randint(2, 4)  # ~1–2 s
        state.target_gear = ideal

    if state.shifting:
        state.shift_ticks_left -= 1
        # RPM dips during shift (clutch disengaged)
        state.rpm = _lerp(state.rpm, max(900, state.rpm * 0.70), 0.4)
        if state.shift_ticks_left <= 0:
            state.gear = state.target_gear
            state.shifting = False
    else:
        if state._override_rpm is None:
            # RPM coupled to speed+gear with throttle influence
            base_rpm = _gear_rpm(state.speed_kmh, state.gear)
            throttle_bonus = (state.throttle_pos_pct / 100) * 600
            target_rpm = base_rpm + throttle_bonus
            if state.mode == "idle":
                target_rpm = random.uniform(700, 870)
            state.rpm = _clamp(_lerp(state.rpm, target_rpm, 0.12), 650, 8000)

    # ── Turbo boost (only when RPM > 2000 and throttle > 30%) ────────────────
    if state.rpm > 2000 and state.throttle_pos_pct > 30:
        boost_target = ((state.rpm - 2000) / 6000) * (state.throttle_pos_pct / 100) * 18.0
    else:
        boost_target = 0.0
    state.turbo_boost_psi = _lerp(state.turbo_boost_psi, boost_target, 0.15)

    # ── MAF (mass air flow) ───────────────────────────────────────────────────
    state.maf_g_per_sec = _lerp(
        state.maf_g_per_sec,
        (state.rpm / 8000) * (state.engine_load_pct / 100) * 25,
        0.15,
    )

    # ── Fuel drain ───────────────────────────────────────────────────────────
    # Higher load = more fuel consumption
    drain = 0.00004 + (state.engine_load_pct / 100) * 0.00008
    state.fuel_level_pct = max(0, state.fuel_level_pct - drain)

    # ── Battery voltage ──────────────────────────────────────────────────────
    state.battery_voltage = _lerp(
        state.battery_voltage,
        13.8 if state.engine_load_pct > 60 else 14.2,
        0.02,
    )

    # ── DTC injection / clearing ──────────────────────────────────────────────
    if now >= state.next_dtc_injection_at and not state.injected_dtcs:
        codes = random.sample(list(FAULT_POOL.keys()), k=random.randint(1, 2))
        state.injected_dtcs = {c: FAULT_POOL[c] for c in codes}
        state.dtc_clear_at = now + random.uniform(60, 90)
        state.next_dtc_injection_at = now + random.uniform(60, 120)
        logger.info("🔴 Injected DTCs: %s", codes)

    if state.dtc_clear_at and now >= state.dtc_clear_at:
        logger.info("✅ Cleared DTCs: %s", list(state.injected_dtcs.keys()))
        state.injected_dtcs = {}
        state.dtc_clear_at = None

    return TelemetryFrame(
        rpm=round(_jitter(state.rpm, 15), 1),
        speed_kmh=round(max(0, _jitter(state.speed_kmh, 0.4)), 1),
        engine_load_pct=round(_clamp(_jitter(state.engine_load_pct, 0.8), 0, 100), 1),
        coolant_temp_c=round(_jitter(state.coolant_temp_c, 0.3), 1),
        throttle_pos_pct=round(_clamp(_jitter(state.throttle_pos_pct, 0.5), 0, 100), 1),
        fuel_level_pct=round(state.fuel_level_pct, 2),
        intake_air_temp_c=round(state.intake_air_temp_c, 1),
        maf_g_per_sec=round(max(0, _jitter(state.maf_g_per_sec, 0.1)), 2),
        battery_voltage=round(_jitter(state.battery_voltage, 0.05), 2),
        active_dtcs=list(state.injected_dtcs.keys()),
        gear=state.gear,
        oil_temp_c=round(_jitter(state.oil_temp_c, 0.2), 1),
        turbo_boost_psi=round(max(0, _jitter(state.turbo_boost_psi, 0.1)), 2),
        timestamp=now,
    )


# ── Singleton state + broadcast ───────────────────────────────────────────────

_engine_state = EngineState()
_latest_frame: Optional[TelemetryFrame] = None
_ws_clients: set = set()


def get_latest_frame() -> TelemetryFrame:
    global _latest_frame
    if _latest_frame is None:
        _latest_frame = tick(_engine_state)
    return _latest_frame


def get_active_dtcs() -> list[DTCEntry]:
    return list(_engine_state.injected_dtcs.values())


def apply_control(
    mode: Optional[str] = None,
    speed_kmh: Optional[float] = None,
    rpm: Optional[float] = None,
    throttle_pos_pct: Optional[float] = None,
    fuel_level_pct: Optional[float] = None,
    inject_dtc: Optional[str] = None,
    clear_dtcs: bool = False,
    reset: bool = False,
) -> dict:
    """Apply interactive control commands from the REST endpoint."""
    global _engine_state

    if reset:
        _engine_state = EngineState()
        logger.info("🔄 Simulator reset.")
        return {"status": "ok", "action": "reset"}

    _engine_state._override_sticky = True   # hold overrides until new command

    if mode is not None:
        _engine_state._override_mode = mode
        _engine_state.mode_counter = 9999
        logger.info("🎮 Mode set to: %s", mode)

    if speed_kmh is not None:
        _engine_state._override_speed = speed_kmh
        logger.info("🎮 Speed override: %.1f km/h", speed_kmh)

    if rpm is not None:
        _engine_state._override_rpm = rpm
        logger.info("🎮 RPM override: %.0f", rpm)

    if throttle_pos_pct is not None:
        _engine_state._override_throttle = throttle_pos_pct

    if fuel_level_pct is not None:
        _engine_state._override_fuel = fuel_level_pct

    if clear_dtcs:
        _engine_state.injected_dtcs = {}
        _engine_state.dtc_clear_at = None
        logger.info("✅ DTCs cleared via control.")

    if inject_dtc:
        code = inject_dtc.upper()
        entry = FAULT_POOL.get(code, DTCEntry(code=code, description="Manually injected fault", severity="medium"))
        _engine_state.injected_dtcs[code] = entry
        logger.info("🔴 Injected DTC via control: %s", code)

    return {"status": "ok", "mode": _engine_state.mode, "gear": _engine_state.gear}


def get_fault_pool() -> list[dict]:
    """Return the list of available DTC codes for the UI."""
    return [{"code": k, "description": v.description, "severity": v.severity} for k, v in FAULT_POOL.items()]


def register_ws_client(websocket) -> None:
    _ws_clients.add(websocket)


def unregister_ws_client(websocket) -> None:
    _ws_clients.discard(websocket)


async def simulator_loop() -> None:
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
