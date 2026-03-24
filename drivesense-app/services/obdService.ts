/**
 * OBD WebSocket Service
 * ─────────────────────
 * Connects to the backend WebSocket /ws/telemetry and dispatches
 * TelemetryFrames into the Zustand store.
 *
 * Falls back to REST polling if WebSocket is unavailable.
 * Controlled by Config.USE_REAL_BLE — if true, this service is bypassed
 * in favour of bleService.ts.
 */

import { Config } from "@/constants/config";
import { useDriveStore } from "@/store/useDriveStore";
import { fetchTelemetrySnapshot } from "@/services/api";
import type { TelemetryFrame } from "@/store/useDriveStore";

let socket: WebSocket | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

const { setTelemetry, setIsConnected, setActiveDTCs } = useDriveStore.getState();

function handleFrame(raw: string) {
  try {
    const frame: TelemetryFrame = JSON.parse(raw);
    setTelemetry(frame);

    // Sync active DTC codes → convert to DTCEntry stubs
    if (frame.active_dtcs.length > 0) {
      setActiveDTCs(
        frame.active_dtcs.map((code) => ({
          code,
          description: "Detected via OBD-II scanner",
          severity: "medium",
        })),
      );
    } else {
      setActiveDTCs([]);
    }
  } catch {
    // Malformed frame – ignore
  }
}

function connectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }

  socket = new WebSocket(Config.WS_TELEMETRY_URL);

  socket.onopen = () => {
    console.log("[OBD] WebSocket connected");
    setIsConnected(true);
    // Stop REST poll if WS succeeds
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  socket.onmessage = (event) => handleFrame(event.data as string);

  socket.onerror = () => {
    console.warn("[OBD] WebSocket error – switching to REST poll fallback");
    setIsConnected(false);
    startRestPoll();
  };

  socket.onclose = () => {
    console.warn("[OBD] WebSocket closed");
    setIsConnected(false);
    if (isRunning) {
      // Auto-reconnect after 3 s
      reconnectTimer = setTimeout(connectWebSocket, 3_000);
    }
  };
}

function startRestPoll() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const frame = await fetchTelemetrySnapshot();
      handleFrame(JSON.stringify(frame));
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }, Config.POLL_INTERVAL_MS);
}

export function startOBDService() {
  if (Config.USE_REAL_BLE) {
    console.log("[OBD] Real BLE mode enabled – OBD WS service not started.");
    return;
  }
  isRunning = true;
  connectWebSocket();
}

export function stopOBDService() {
  isRunning = false;
  if (socket) {
    socket.close();
    socket = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  setIsConnected(false);
}
