/**
 * DriveSense AI – Configuration
 * ──────────────────────────────
 * Update BACKEND_URL to your machine's local IP when testing on a
 * physical device (e.g., "http://192.168.1.42:8000").
 * Use "http://localhost:8000" for iOS simulator.
 */

export const Config = {
  /** REST + WebSocket base URL */
  BACKEND_URL: "http://localhost:8000",

  /** WebSocket telemetry endpoint */
  WS_TELEMETRY_URL: "ws://localhost:8000/ws/telemetry",

  /**
   * Set to true to use the real react-native-ble-plx BLE service.
   * Requires a physical device + an ELM327 adapter plugged into the car.
   * Phases 1–4: keep false.
   */
  USE_REAL_BLE: false,

  /** Telemetry polling interval (ms) – used as fallback if WS fails */
  POLL_INTERVAL_MS: 1000,

  /** Score thresholds */
  SCORE_TIERS: {
    EXCELLENT: 80,
    GOOD: 60,
    POOR: 0,
  },
} as const;
