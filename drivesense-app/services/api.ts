import axios from "axios";
import { Config } from "@/constants/config";
import type { DiagnosticResult, DTCEntry } from "@/store/useDriveStore";

const api = axios.create({
  baseURL: Config.BACKEND_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ── Mock / REST Telemetry ─────────────────────────────────────────────────────

export const fetchTelemetrySnapshot = async () => {
  const { data } = await api.get("/api/v1/mock/telemetry");
  return data;
};

export const fetchActiveDTCs = async (): Promise<DTCEntry[]> => {
  const { data } = await api.get("/api/v1/mock/dtcs");
  return data.dtcs ?? [];
};

// ── AI Mechanic ───────────────────────────────────────────────────────────────

export interface VehicleContext {
  make: string;
  model: string;
  year: number;
  mileage_km?: number;
}

export const analyzeDTC = async (
  dtcCode: string,
  vehicle: VehicleContext = { make: "Toyota", model: "Camry", year: 2019 },
): Promise<DiagnosticResult> => {
  const { data } = await api.post("/api/v1/diagnostics/analyze", {
    dtc_code: dtcCode,
    vehicle,
  });
  return data;
};

export const getPreventionTips = async (
  pastDTCs: string[],
  vehicle: VehicleContext,
) => {
  const { data } = await api.post("/api/v1/diagnostics/prevention-tips", {
    past_dtc_codes: pastDTCs,
    vehicle,
  });
  return data;
};

// ── Geofencing ────────────────────────────────────────────────────────────────

export const checkGeofence = async (
  lat: number,
  lng: number,
  speedKmh: number = 0,
) => {
  const { data } = await api.post("/api/v1/geofences/check", {
    latitude: lat,
    longitude: lng,
    speed_kmh: speedKmh,
  });
  return data;
};

export const fetchGeofences = async () => {
  const { data } = await api.get("/api/v1/geofences");
  return data;
};

// ── Nearby Shops ──────────────────────────────────────────────────────────────

export const fetchNearbyShops = async (lat: number, lng: number) => {
  const { data } = await api.get("/api/v1/nearby/shops", {
    params: { lat, lng },
  });
  return data;
};
