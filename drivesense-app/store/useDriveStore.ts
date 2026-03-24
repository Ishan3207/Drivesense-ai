import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TelemetryFrame {
  rpm: number;
  speed_kmh: number;
  engine_load_pct: number;
  coolant_temp_c: number;
  throttle_pos_pct: number;
  fuel_level_pct: number;
  intake_air_temp_c: number;
  maf_g_per_sec: number;
  battery_voltage: number;
  active_dtcs: string[];
  gear: number;
  oil_temp_c: number;
  turbo_boost_psi: number;
  timestamp: number;
}

export interface DTCEntry {
  code: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface DiagnosticResult {
  dtc_code: string;
  translation: string;
  root_causes: string[];
  repair_steps: string[];
  cost_estimate_parts: { low: number; high: number; currency: string };
  cost_estimate_labor: { low: number; high: number; currency: string };
  diy_difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  ai_confidence: number;
  urgency: "monitor" | "soon" | "urgent" | "immediate";
}

export interface ActiveZone {
  id: string;
  name: string;
  zone_type: string;
  speed_limit_kmh: number;
  speed_excess_kmh: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface DriveState {
  // Telemetry
  telemetry: TelemetryFrame | null;
  setTelemetry: (frame: TelemetryFrame) => void;

  // DTCs
  activeDTCs: DTCEntry[];
  setActiveDTCs: (dtcs: DTCEntry[]) => void;

  // Diagnostics (LLM result cache, keyed by DTC code)
  diagnosticCache: Record<string, DiagnosticResult>;
  setDiagnosticResult: (code: string, result: DiagnosticResult) => void;

  // Current DTC being viewed
  selectedDTC: string | null;
  setSelectedDTC: (code: string | null) => void;

  // Driver score
  driverScore: number;
  setDriverScore: (score: number) => void;
  applyScoreDelta: (delta: number) => void;

  // Geofencing
  activeZone: ActiveZone | null;
  setActiveZone: (zone: ActiveZone | null) => void;
  isAlerting: boolean;
  setIsAlerting: (alerting: boolean) => void;

  // Connection status
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;

  // UI state
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  // Telemetry
  telemetry: null,
  setTelemetry: (frame) => set({ telemetry: frame }),

  // DTCs
  activeDTCs: [],
  setActiveDTCs: (dtcs) => set({ activeDTCs: dtcs }),

  // Diagnostics cache
  diagnosticCache: {},
  setDiagnosticResult: (code, result) =>
    set((state) => ({
      diagnosticCache: { ...state.diagnosticCache, [code]: result },
    })),

  selectedDTC: null,
  setSelectedDTC: (code) => set({ selectedDTC: code }),

  // Driver score (starts at 100)
  driverScore: 100,
  setDriverScore: (score) => set({ driverScore: Math.max(0, Math.min(100, score)) }),
  applyScoreDelta: (delta) =>
    set((state) => ({
      driverScore: Math.max(0, Math.min(100, state.driverScore + delta)),
    })),

  // Geofencing
  activeZone: null,
  setActiveZone: (zone) => set({ activeZone: zone }),
  isAlerting: false,
  setIsAlerting: (alerting) => set({ isAlerting: alerting }),

  // Connection
  isConnected: false,
  setIsConnected: (connected) => set({ isConnected: connected }),

  // UI
  isScanning: false,
  setIsScanning: (scanning) => set({ isScanning: scanning }),
}));
