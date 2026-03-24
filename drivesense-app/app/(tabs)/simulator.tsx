import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Pressable, Platform
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useDriveStore } from "@/store/useDriveStore";
import { Config } from "@/constants/config";

const { width: W } = Dimensions.get("window");

const COLORS = {
  background: "#C9D6BC",
  primary: "#064E3B",
  accent: "#F59E0B",
  teal: "#0D9488",
  cardLight: "#FFFFFF",
  cardDark: "#1F2937",
  cardSoft: "#FEF3C7",
  textDark: "#111827",
  textMuted: "#6B7280",
  textLight: "#FFFFFF",
  error: "#DC2626",
};

type DrivingMode = "idle" | "accelerating" | "cruising" | "decelerating";

interface FaultEntry {
  code: string;
  description: string;
  severity: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function sendControl(body: Record<string, unknown>) {
  const res = await fetch(`${Config.BACKEND_URL}/api/v1/mock/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function fetchFaultPool(): Promise<FaultEntry[]> {
  const res = await fetch(`${Config.BACKEND_URL}/api/v1/mock/fault-pool`);
  const json = await res.json();
  return json.fault_pool ?? [];
}

// ── LiveStat component ────────────────────────────────────────────────────────
function LiveStat({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color: string;
}) {
  return (
    <View style={ls.card}>
      <View style={[ls.iconDot, { backgroundColor: color }]} />
      <Text style={ls.value}>{value}<Text style={ls.unit}> {unit}</Text></Text>
      <Text style={ls.label}>{label}</Text>
    </View>
  );
}

const ls = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardLight, borderRadius: 24,
    padding: 16, width: (W - 56) / 2, alignItems: "flex-start",
  },
  iconDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  value: { fontSize: 24, fontWeight: "800", color: COLORS.textDark },
  unit: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  label: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", marginTop: 2 },
});

// ── ModeButton ────────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<DrivingMode, { icon: string; color: string; label: string }> = {
  idle:         { icon: "pause",        color: COLORS.textMuted, label: "IDLE" },
  accelerating: { icon: "flash",        color: COLORS.accent,    label: "ACCEL" },
  cruising:     { icon: "speedometer",  color: COLORS.teal,      label: "CRUISE" },
  decelerating: { icon: "arrow-down",   color: COLORS.error,     label: "BRAKE" },
};

function ModeButton({
  mode, active, onPress,
}: { mode: DrivingMode; active: boolean; onPress: () => void }) {
  const cfg = MODE_CONFIG[mode];
  return (
    <Pressable
      onPress={onPress}
      style={[mb.btn, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
    >
      <Ionicons name={cfg.icon as any} size={24} color={active ? COLORS.textLight : cfg.color} />
      <Text style={[mb.label, { color: active ? COLORS.textLight : COLORS.textDark }]}>{cfg.label}</Text>
    </Pressable>
  );
}

const mb = StyleSheet.create({
  btn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 20, borderWidth: 1.5,
    borderColor: "transparent", gap: 6,
    backgroundColor: COLORS.cardLight,
  },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
});

// ── ControlSlider ─────────────────────────────────────────────────────────────
function ControlSlider({
  label, value, min, max, step = 1, color, unit, onSlidingComplete,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; color: string; unit: string; onSlidingComplete: (v: number) => void;
}) {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => { setLocalVal(value); }, [value]);

  return (
    <View style={cs.wrap}>
      <View style={cs.row}>
        <Text style={cs.label}>{label}</Text>
        <Text style={[cs.current, { color }]}>{Math.round(localVal)} {unit}</Text>
      </View>
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={min} maximumValue={max} step={step}
        value={localVal}
        minimumTrackTintColor={color}
        maximumTrackTintColor={`${COLORS.textMuted}33`}
        thumbTintColor={color}
        onValueChange={setLocalVal}
        onSlidingComplete={onSlidingComplete}
      />
      <View style={cs.ends}>
        <Text style={cs.end}>{min}{unit}</Text>
        <Text style={cs.end}>{max}{unit}</Text>
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  wrap: { backgroundColor: COLORS.cardLight, borderRadius: 24, padding: 20, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  label: { color: COLORS.textDark, fontSize: 14, fontWeight: "600" },
  current: { fontSize: 18, fontWeight: "800" },
  ends: { flexDirection: "row", justifyContent: "space-between", marginTop: -4 },
  end: { color: COLORS.textMuted, fontSize: 11, fontWeight: "500" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SimulatorScreen() {
  const telemetry = useDriveStore((s) => s.telemetry);
  const activeDTCs = useDriveStore((s) => s.activeDTCs);

  const [activeMode, setActiveMode] = useState<DrivingMode>("idle");
  const [faultPool, setFaultPool] = useState<FaultEntry[]>([]);
  const [selectedFault, setSelectedFault] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState<string>("");

  useEffect(() => {
    fetchFaultPool().then((pool) => {
      setFaultPool(pool);
      if (pool.length > 0) setSelectedFault(pool[0].code);
    }).catch(() => {});
  }, []);

  const doControl = useCallback(async (body: Record<string, unknown>, label: string) => {
    setBusy(true);
    try {
      await sendControl(body);
      setLastAction(`✓ ${label}`);
    } catch {
      setLastAction("✗ Failed – is backend running?");
    } finally { setBusy(false); }
  }, []);

  const handleMode = (mode: DrivingMode) => {
    setActiveMode(mode);
    doControl({ mode }, `Mode → ${mode}`);
  };

  const handleReset = () => {
    setActiveMode("idle");
    doControl({ reset: true }, "Simulation reset");
  };

  const handleInjectDTC = () => {
    if (!selectedFault) return;
    doControl({ inject_dtc: selectedFault }, `Injected ${selectedFault}`);
  };

  const handleClearDTCs = () => {
    doControl({ clear_dtcs: true }, "DTCs cleared");
  };

  const severityColor = (s: string) => s === "high" || s === "critical" ? COLORS.error : s === "medium" ? COLORS.accent : COLORS.teal;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={scr.scroll} showsVerticalScrollIndicator={false}>

        <View style={scr.header}>
          <View>
            <Text style={scr.title}>Simulate</Text>
            <Text style={scr.sub}>Live Hardware Emulation</Text>
          </View>
          <TouchableOpacity style={scr.resetBtn} onPress={handleReset} disabled={busy}>
            <Ionicons name="refresh" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        {!!lastAction && (
          <View style={scr.feedbackRow}>
            <Text style={{ color: lastAction.startsWith("✓") ? COLORS.primary : COLORS.error, fontSize: 13, fontWeight: "600" }}>
              {lastAction}
            </Text>
            {busy && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
          </View>
        )}

        <Text style={scr.sectionTitle}>LIVE TELEMETRY</Text>
        <View style={scr.statGrid}>
          <LiveStat label="SPEED"    value={String(Math.round(telemetry?.speed_kmh ?? 0))}       unit="km/h"  color={COLORS.teal} />
          <LiveStat label="RPM"      value={String(Math.round(telemetry?.rpm ?? 0))}              unit="rpm"   color={COLORS.primary} />
          <LiveStat label="GEAR"     value={String(telemetry?.gear ?? 1)}                         unit=""      color={COLORS.accent} />
          <LiveStat label="THROTTLE" value={String(Math.round(telemetry?.throttle_pos_pct ?? 0))} unit="%"     color={COLORS.error} />
        </View>

        <Text style={scr.sectionTitle}>DRIVING MODE</Text>
        <View style={scr.modeRow}>
          {(Object.keys(MODE_CONFIG) as DrivingMode[]).map((m) => (
            <ModeButton key={m} mode={m} active={activeMode === m} onPress={() => handleMode(m)} />
          ))}
        </View>

        <Text style={scr.sectionTitle}>MANUAL OVERRIDES</Text>
        <ControlSlider
          label="Target Speed" value={telemetry?.speed_kmh ?? 0}
          min={0} max={220} unit=" km/h" color={COLORS.teal}
          onSlidingComplete={(v) => doControl({ speed_kmh: v }, `Speed → ${Math.round(v)} km/h`)}
        />
        <ControlSlider
          label="Target RPM" value={telemetry?.rpm ?? 800}
          min={650} max={8000} step={50} unit=" rpm" color={COLORS.primary}
          onSlidingComplete={(v) => doControl({ rpm: v }, `RPM → ${Math.round(v)}`)}
        />
        <ControlSlider
          label="Throttle Position" value={telemetry?.throttle_pos_pct ?? 5}
          min={0} max={100} unit="%" color={COLORS.accent}
          onSlidingComplete={(v) => doControl({ throttle_pos_pct: v }, `Throttle → ${Math.round(v)}%`)}
        />

        <Text style={scr.sectionTitle}>FAULT CODES</Text>
        <View style={scr.faultBox}>
          {faultPool.map((f) => (
            <Pressable
              key={f.code}
              style={[scr.faultChip, selectedFault === f.code && { backgroundColor: severityColor(f.severity) }]}
              onPress={() => setSelectedFault(f.code)}
            >
              <Text style={[scr.chipCode, { color: selectedFault === f.code ? COLORS.textLight : COLORS.textDark }]}>
                {f.code}
              </Text>
            </Pressable>
          ))}
        </View>
        
        {selectedFault && (
          <View style={scr.selectedFault}>
            <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: "500" }}>
              {faultPool.find((f) => f.code === selectedFault)?.description}
            </Text>
          </View>
        )}

        <View style={scr.dtcBtnRow}>
          <TouchableOpacity
            style={[scr.dtcBtn, { backgroundColor: COLORS.error }]}
            onPress={handleInjectDTC} disabled={busy || !selectedFault}
          >
            <Text style={[scr.dtcBtnTxt, { color: COLORS.textLight }]}>INJECT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[scr.dtcBtn, { backgroundColor: COLORS.teal }]}
            onPress={handleClearDTCs} disabled={busy}
          >
            <Text style={[scr.dtcBtnTxt, { color: COLORS.textLight }]}>CLEAR ({activeDTCs.length})</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const scr = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 32, fontWeight: "700", color: COLORS.textDark, letterSpacing: -0.5 },
  sub: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600", marginTop: 4 },
  resetBtn: { backgroundColor: COLORS.cardLight, borderRadius: 20, padding: 12, alignItems: "center", justifyContent: "center" },
  feedbackRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, paddingHorizontal: 4 },
  sectionTitle: { color: COLORS.textDark, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 12, marginTop: 24 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  modeRow: { flexDirection: "row", gap: 12 },
  faultBox: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  faultChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.cardLight },
  chipCode: { fontSize: 13, fontWeight: "700" },
  selectedFault: { backgroundColor: COLORS.cardLight, borderRadius: 20, padding: 16, marginTop: 12 },
  dtcBtnRow: { flexDirection: "row", gap: 16, marginTop: 16 },
  dtcBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 18, borderRadius: 100 },
  dtcBtnTxt: { fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
});
