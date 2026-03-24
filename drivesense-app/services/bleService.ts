/**
 * BLE Service – Phase 5 (Real ELM327 Integration)
 * ─────────────────────────────────────────────────
 * Boilerplate to swap mock WebSocket data for real OBD-II BLE data.
 *
 * USAGE:
 *   1. Set Config.USE_REAL_BLE = true in constants/config.ts
 *   2. Connect your ELM327 adapter to the OBD-II port and pair via phone Settings
 *   3. Call startBLEService() from your app root
 *
 * ELM327 AT Commands Reference:
 *   ATZ    – Reset adapter
 *   ATE0   – Echo off
 *   ATH0   – Headers off
 *   ATSP0  – Auto-detect OBD protocol
 *   010C   – PID 0C: Engine RPM (×4 factor)
 *   010D   – PID 0D: Vehicle Speed (km/h)
 *   0104   – PID 04: Engine Load (×100/255 factor)
 *   0105   – PID 05: Coolant Temperature (+40 offset, -40 base)
 *   0111   – PID 11: Throttle Position
 *   012F   – PID 2F: Fuel Level
 *   03     – Mode 03: Request stored DTCs
 *   04     – Mode 04: Clear DTCs (DO NOT USE – READ-ONLY POLICY)
 *
 * NOTE: This service is READ-ONLY. No write commands that affect engine
 * operation are used. Only AT configuration and Mode 01/03 PIDs.
 */

import { BleManager, Device, Characteristic, State } from "react-native-ble-plx";
import { Buffer } from "buffer";
import { useDriveStore } from "@/store/useDriveStore";
import type { TelemetryFrame } from "@/store/useDriveStore";

// Most ELM327 BLE adapters expose a custom UART-over-BLE service
const ELM327_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const ELM327_WRITE_CHAR = "0000fff2-0000-1000-8000-00805f9b34fb";
const ELM327_NOTIFY_CHAR = "0000fff1-0000-1000-8000-00805f9b34fb";

// Common ELM327 adapter BLE device names
const KNOWN_DEVICE_NAMES = ["OBDII", "OBD2", "V-Link", "ELM327", "OBD-II BLE", "Viecar"];

let manager: BleManager | null = null;
let connectedDevice: Device | null = null;
let responseBuffer = "";

const { setTelemetry, setIsConnected } = useDriveStore.getState();

// ── Hex parsing helpers ───────────────────────────────────────────────────────

function parseRPM(hexA: string, hexB: string): number {
  return (parseInt(hexA, 16) * 256 + parseInt(hexB, 16)) / 4;
}

function parseSpeed(hexA: string): number {
  return parseInt(hexA, 16);
}

function parseLoad(hexA: string): number {
  return (parseInt(hexA, 16) * 100) / 255;
}

function parseCoolantTemp(hexA: string): number {
  return parseInt(hexA, 16) - 40;
}

function parseThrottle(hexA: string): number {
  return (parseInt(hexA, 16) * 100) / 255;
}

function parseFuelLevel(hexA: string): number {
  return (parseInt(hexA, 16) * 100) / 255;
}

function parseDTCResponse(raw: string): string[] {
  // Mode 03 response: "43 01 P0300 ..." – parse DTC codes
  const codes: string[] = [];
  const bytes = raw.replace(/\s/g, "").match(/.{1,4}/g) ?? [];
  for (let i = 1; i < bytes.length; i += 2) {
    const byte1 = parseInt(bytes[i], 16);
    const byte2 = parseInt(bytes[i + 1] ?? "00", 16);
    if (byte1 === 0 && byte2 === 0) break;

    const prefix = ["P0", "P1", "P2", "P3", "C0", "C1", "B0", "B1"][
      (byte1 & 0xc0) >> 6
    ] ?? "P0";
    const code = prefix + ((byte1 & 0x3f).toString(16).padStart(1, "0") + byte2.toString(16).padStart(2, "0")).toUpperCase();
    codes.push(code);
  }
  return codes;
}

// ── AT Command sender ─────────────────────────────────────────────────────────

async function sendATCommand(command: string): Promise<string> {
  if (!connectedDevice) throw new Error("No device connected");

  const encoded = Buffer.from(command + "\r").toString("base64");
  await connectedDevice.writeCharacteristicWithResponseForService(
    ELM327_SERVICE_UUID,
    ELM327_WRITE_CHAR,
    encoded,
  );

  // Wait for response (max 2 s)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(responseBuffer.trim()), 2000);
    const unsub = connectedDevice!.monitorCharacteristicForService(
      ELM327_SERVICE_UUID,
      ELM327_NOTIFY_CHAR,
      (error, char) => {
        if (error) return;
        const decoded = Buffer.from(char!.value ?? "", "base64").toString();
        responseBuffer += decoded;
        if (responseBuffer.includes(">")) {
          clearTimeout(timer);
          const result = responseBuffer.trim();
          responseBuffer = "";
          unsub.remove();
          resolve(result);
        }
      },
    );
  });
}

// ── Init & polling loop ───────────────────────────────────────────────────────

async function initELM327() {
  await sendATCommand("ATZ");   // Reset
  await sendATCommand("ATE0");  // Echo off
  await sendATCommand("ATH0");  // Headers off
  await sendATCommand("ATL0");  // Line feeds off
  await sendATCommand("ATSP0"); // Auto protocol
  console.log("[BLE] ELM327 initialized.");
}

async function pollPIDs() {
  const telemetry: Partial<TelemetryFrame> = {
    timestamp: Date.now() / 1000,
    active_dtcs: [],
  };

  try {
    const rpmRaw = await sendATCommand("010C");
    const rpmBytes = rpmRaw.replace("410C", "").trim().split(" ");
    telemetry.rpm = parseRPM(rpmBytes[0], rpmBytes[1]);

    const speedRaw = await sendATCommand("010D");
    const speedBytes = speedRaw.replace("410D", "").trim().split(" ");
    telemetry.speed_kmh = parseSpeed(speedBytes[0]);

    const loadRaw = await sendATCommand("0104");
    const loadBytes = loadRaw.replace("4104", "").trim().split(" ");
    telemetry.engine_load_pct = parseLoad(loadBytes[0]);

    const coolantRaw = await sendATCommand("0105");
    const coolantBytes = coolantRaw.replace("4105", "").trim().split(" ");
    telemetry.coolant_temp_c = parseCoolantTemp(coolantBytes[0]);

    const throttleRaw = await sendATCommand("0111");
    const throttleBytes = throttleRaw.replace("4111", "").trim().split(" ");
    telemetry.throttle_pos_pct = parseThrottle(throttleBytes[0]);

    const fuelRaw = await sendATCommand("012F");
    const fuelBytes = fuelRaw.replace("412F", "").trim().split(" ");
    telemetry.fuel_level_pct = parseFuelLevel(fuelBytes[0]);

    // Poll DTCs every ~10 s (avoid flooding the adapter)
    if (Math.floor(Date.now() / 1000) % 10 === 0) {
      const dtcRaw = await sendATCommand("03");
      telemetry.active_dtcs = parseDTCResponse(dtcRaw);
    }

    setTelemetry(telemetry as TelemetryFrame);
  } catch (err) {
    console.warn("[BLE] PID poll error:", err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startBLEService() {
  manager = new BleManager();

  return new Promise<void>((resolve, reject) => {
    const subscription = manager!.onStateChange(async (state) => {
      if (state === State.PoweredOn) {
        subscription.remove();
        console.log("[BLE] Bluetooth powered on. Scanning…");

        manager!.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
          if (error) {
            console.error("[BLE] Scan error:", error);
            reject(error);
            return;
          }

          if (device?.name && KNOWN_DEVICE_NAMES.some((n) => device.name!.includes(n))) {
            manager!.stopDeviceScan();
            console.log("[BLE] Found device:", device.name);

            try {
              connectedDevice = await device.connect();
              await connectedDevice.discoverAllServicesAndCharacteristics();
              setIsConnected(true);
              await initELM327();

              // Poll every 500ms
              setInterval(pollPIDs, 500);
              resolve();
            } catch (connErr) {
              console.error("[BLE] Connection failed:", connErr);
              setIsConnected(false);
              reject(connErr);
            }
          }
        });
      }
    }, true);
  });
}

export async function stopBLEService() {
  if (connectedDevice) {
    await connectedDevice.cancelConnection();
    connectedDevice = null;
  }
  manager?.destroy();
  manager = null;
  setIsConnected(false);
}
