/**
 * DriveSense AI – API Service
 * ─────────────────────────────
 * All backend communication lives here. An Axios interceptor provides
 * uniform error handling and meaningful user-facing messages.
 */

import axios, { AxiosError } from "axios";
import { Config } from "@/constants/config";
import type { DiagnosticResult, DTCEntry } from "@/store/useDriveStore";

// ── Typed App Error ───────────────────────────────────────────────────────────

export class AppError extends Error {
  /** HTTP status code, if available */
  status?: number;
  /** Whether the root cause was a network / connectivity issue */
  isNetwork: boolean;

  constructor(message: string, status?: number, isNetwork = false) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

/** Returns true if the error originated from a network / timeout problem */
export function isNetworkError(err: unknown): boolean {
  return err instanceof AppError && err.isNetwork;
}

/** Converts any thrown value into a user-friendly AppError */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof AxiosError) {
    if (!err.response) {
      return new AppError(
        "Cannot reach the DriveSense server. Check your connection or make sure the backend is running.",
        undefined,
        true,
      );
    }
    const status = err.response.status;
    const detail =
      (err.response.data as { detail?: string })?.detail ??
      `Server error (${status})`;
    return new AppError(detail, status, false);
  }
  if (err instanceof Error) return new AppError(err.message);
  return new AppError("An unknown error occurred.");
}

// ── Axios Instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: Config.BACKEND_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Response interceptor – convert Axios errors to AppError uniformly
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => Promise.reject(toAppError(err)),
);

// ── Mock / REST Telemetry ─────────────────────────────────────────────────────

export const fetchTelemetrySnapshot = async () => {
  try {
    const { data } = await api.get("/api/v1/mock/telemetry");
    return data;
  } catch (err) {
    throw toAppError(err);
  }
};

export const fetchActiveDTCs = async (): Promise<DTCEntry[]> => {
  try {
    const { data } = await api.get("/api/v1/mock/dtcs");
    return data.dtcs ?? [];
  } catch (err) {
    throw toAppError(err);
  }
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
  try {
    const { data } = await api.post("/api/v1/diagnostics/analyze", {
      dtc_code: dtcCode,
      vehicle,
    });
    return data;
  } catch (err) {
    throw toAppError(err);
  }
};

export const getPreventionTips = async (
  pastDTCs: string[],
  vehicle: VehicleContext,
) => {
  try {
    const { data } = await api.post("/api/v1/diagnostics/prevention-tips", {
      past_dtc_codes: pastDTCs,
      vehicle,
    });
    return data;
  } catch (err) {
    throw toAppError(err);
  }
};

// ── Geofencing ────────────────────────────────────────────────────────────────

export const checkGeofence = async (
  lat: number,
  lng: number,
  speedKmh: number = 0,
) => {
  try {
    const { data } = await api.post("/api/v1/geofences/check", {
      latitude: lat,
      longitude: lng,
      speed_kmh: speedKmh,
    });
    return data;
  } catch (err) {
    throw toAppError(err);
  }
};

export const fetchGeofences = async () => {
  try {
    const { data } = await api.get("/api/v1/geofences");
    return data;
  } catch (err) {
    throw toAppError(err);
  }
};

// ── Nearby Shops ──────────────────────────────────────────────────────────────

/**
 * Fetch nearby auto-repair shops.
 * @param lat      - User latitude
 * @param lng      - User longitude
 * @param radiusM  - Search radius in **metres** (default 10 000 m = 10 km, max 50 000 m)
 */
export const fetchNearbyShops = async (
  lat: number,
  lng: number,
  radiusM: number = 10_000,
) => {
  try {
    const { data } = await api.get("/api/v1/nearby/shops", {
      params: { lat, lng, radius_m: Math.min(radiusM, 50_000) },
    });
    return data;
  } catch (err) {
    throw toAppError(err);
  }
};
