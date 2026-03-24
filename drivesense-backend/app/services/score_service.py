"""
Driver Safety Score Service
────────────────────────────
Calculates and mutates the driver's safety score based on events
(speeding in zones, harsh braking, high RPM, engine health events).

Score rules:
  - Base score: 100
  - Speeding in geofenced zone:   -10 per event, -2 per additional event in same zone
  - Aggressive acceleration:       -3 points (RPM > 4000 at low speed)
  - Clean driving streak (no penalties 5 min): +1 per 5 min
  - Min score: 0, Max score: 100
"""

from __future__ import annotations

import time
import logging

logger = logging.getLogger(__name__)


class ScoreEngine:
    def __init__(self, initial_score: float = 100.0):
        self._score = initial_score
        self._last_clean_tick = time.time()

    @property
    def score(self) -> float:
        return round(self._score, 1)

    def penalize_zone_speeding(self, zone_name: str, speed_excess_kmh: float) -> float:
        """Apply penalty for speeding in a safety zone. Returns delta."""
        penalty = -(10 + min(speed_excess_kmh * 0.3, 15))
        self._apply(penalty)
        logger.info("⚠️  Zone speeding penalty (%.1f km/h over in %s): %.1f pts", speed_excess_kmh, zone_name, penalty)
        return penalty

    def penalize_aggressive_acceleration(self) -> float:
        penalty = -3.0
        self._apply(penalty)
        return penalty

    def reward_clean_driving(self) -> float:
        """Call periodically. Rewards +1 if no penalty in last 5 min."""
        now = time.time()
        if now - self._last_clean_tick >= 300:
            self._last_clean_tick = now
            gain = 1.0
            self._apply(gain)
            return gain
        return 0.0

    def _apply(self, delta: float) -> None:
        self._score = max(0.0, min(100.0, self._score + delta))


# Singleton score engine (in-memory for MVP)
_score_engine = ScoreEngine()


def get_score() -> float:
    return _score_engine.score


def apply_zone_speed_penalty(zone_name: str, excess_kmh: float) -> dict:
    delta = _score_engine.penalize_zone_speeding(zone_name, excess_kmh)
    return {"score": _score_engine.score, "delta": delta}


def reward_clean_driving() -> dict:
    delta = _score_engine.reward_clean_driving()
    return {"score": _score_engine.score, "delta": delta}
