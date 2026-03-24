import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";

import { useDriveStore } from "@/store/useDriveStore";
import { fetchActiveDTCs } from "@/services/api";
import { Config } from "@/constants/config";

const { width: SCREEN_W } = Dimensions.get("window");
const GAUGE_SIZE = Math.min(SCREEN_W * 0.35, 140);

// Design Tokens (Home Care App inspired)
const COLORS = {
  background: "#C9D6BC", // Sage green
  primary: "#064E3B",    // Dark Emerald
  accent: "#F59E0B",     // Vibrant Orange
  teal: "#0D9488",
  cardLight: "#FFFFFF",
  cardDark: "#1F2937",
  cardSoft: "#FEF3C7",
  textDark: "#111827",
  textMuted: "#6B7280",
  textLight: "#FFFFFF",
  error: "#DC2626",
};

// ── Shared Flat Gauge (Clean, solid design) ─────────────────────────
function FlatGauge({ value, max, label, unit, color = COLORS.primary }: { value: number; max: number; label: string; unit: string; color?: string; }) {
  const radius = GAUGE_SIZE * 0.38;
  const stroke = 12;
  const circumference = radius * 2 * Math.PI;
  const pct = Math.min(value / max, 1);
  const strokeDashoffset = circumference - pct * circumference * 0.75;
  const cx = GAUGE_SIZE / 2;
  const cy = GAUGE_SIZE / 2;

  return (
    <View style={gaugeS.container}>
      <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={stroke} fill="transparent"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          strokeDashoffset={0} strokeLinecap="round"
          rotation={135} origin={`${cx}, ${cy}`}
        />
        {/* Progress Arc */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={color}
          strokeWidth={stroke} fill="transparent"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          rotation={135} origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={gaugeS.labelBox}>
        <Text style={[gaugeS.value, { color: COLORS.textDark }]}>
          {Math.round(value)}
        </Text>
        <Text style={gaugeS.unit}>{unit}</Text>
        <Text style={gaugeS.label}>{label}</Text>
      </View>
    </View>
  );
}

const gaugeS = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", width: GAUGE_SIZE, height: GAUGE_SIZE },
  labelBox: { position: "absolute", alignItems: "center" },
  value: { fontSize: 28, fontWeight: "800" },
  unit: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", marginTop: -2 },
  label: { fontSize: 10, color: COLORS.textDark, fontWeight: "700", marginTop: 4, letterSpacing: 0.5 },
});

// ── Score Ring (In a clean white card) ──────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= Config.SCORE_TIERS.EXCELLENT ? COLORS.teal
              : score >= Config.SCORE_TIERS.GOOD ? COLORS.accent : COLORS.error;
  const tier = score >= Config.SCORE_TIERS.EXCELLENT ? "EXCELLENT"
             : score >= Config.SCORE_TIERS.GOOD ? "GOOD" : "POOR";

  return (
    <View style={s.scoreBox}>
      <FlatGauge value={score} max={100} label="SCORE" unit={tier} color={color} />
    </View>
  );
}

const EFFICIENCY_TIPS = [
  "Ease off the throttle gradually to save fuel.",
  "High RPMs waste fuel — shift up earlier.",
  "Anticipate stops to avoid hard braking.",
  "Optimal fuel efficiency: 60–90 km/h.",
  "Avoid idling for more than 60 seconds.",
];
function getTip(rpm: number, load: number, speed: number) {
  if (rpm > 3500) return EFFICIENCY_TIPS[1];
  if (load > 80) return EFFICIENCY_TIPS[0];
  if (speed < 20 && load > 30) return EFFICIENCY_TIPS[4];
  if (speed > 100) return EFFICIENCY_TIPS[3];
  return EFFICIENCY_TIPS[Math.floor(Date.now() / 10000) % EFFICIENCY_TIPS.length];
}

// ── Dashboard Screen ──────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const {
    telemetry, driverScore, activeDTCs, isConnected, isAlerting, activeZone,
    setActiveDTCs, isScanning, setIsScanning
  } = useDriveStore();
  const [scanErr, setScanErr] = useState<string|null>(null);

  const tip = telemetry ? getTip(telemetry.rpm, telemetry.engine_load_pct, telemetry.speed_kmh) : "Connect vehicle for insights.";

  const handleScan = useCallback(async () => {
    setScanErr(null); setIsScanning(true);
    try {
      const dtcs = await fetchActiveDTCs();
      setActiveDTCs(dtcs);
      if (dtcs.length === 0) Alert.alert("✅ System Nominal", "No faults detected.");
      else router.push("/(tabs)/diagnostics");
    } catch {
      setScanErr("Could not connect to vehicle. Server unreachable.");
    } finally { setIsScanning(false); }
  }, []);

  return (
    <View style={s.bg}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Top Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>Drive<Text style={{color: COLORS.primary}}>Sense</Text></Text>
            <View style={s.statusRow}>
              <View style={[s.blob, { backgroundColor: isConnected ? COLORS.primary : COLORS.error }]} />
              <Text style={s.subtitle}>{isConnected ? "Connected" : "Offline"}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="person-circle" size={36} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Active Faults Alert (Orange Card) ── */}
        {activeDTCs.length > 0 && (
          <TouchableOpacity style={[s.bentoCard, s.dtcCard]} onPress={() => router.push("/(tabs)/diagnostics")}>
            <Ionicons name="warning" size={28} color="#fff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.dtcTitle}>Requires Attention</Text>
              <Text style={s.dtcSub}>{activeDTCs.length} Active Faults</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ── Primary Action Card (Dark Emerald) ── */}
        <View style={[s.bentoCard, s.primaryCard]}>
          <View style={s.primaryCardHeader}>
            <Text style={s.primaryCardTitle}>Vehicle Telemetry</Text>
            <TouchableOpacity style={s.primaryCardAction} onPress={handleScan} disabled={isScanning}>
              {isScanning ? <ActivityIndicator color={COLORS.primary} size="small" /> : <Ionicons name="scan" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
          </View>

          <View style={s.hudRow}>
            <View style={s.hudItem}>
              <Text style={s.hudVal}>{telemetry?.speed_kmh ?? 0}</Text>
              <Text style={s.hudLbl}>km/h</Text>
            </View>
            <View style={s.hudDivider} />
            <View style={s.hudItem}>
              <Text style={s.hudVal}>{telemetry?.rpm ?? 0}</Text>
              <Text style={s.hudLbl}>rpm</Text>
            </View>
          </View>
        </View>

        {/* ── Center Flex Row (Score & Coach) ── */}
        <View style={s.row}>
          <View style={[s.bentoCard, s.whiteCard, { flex: 1, alignItems: "center", paddingVertical: 20 }]}>
            <ScoreRing score={driverScore} />
          </View>
          <View style={{ flex: 1, gap: 16 }}>
            <View style={[s.bentoCard, s.cardSoft]}>
              <Ionicons name="bulb-outline" size={24} color={COLORS.accent} />
              <Text style={s.coachText} numberOfLines={3}>{tip}</Text>
            </View>
            {isAlerting && activeZone && (
               <View style={[s.bentoCard, s.cardError]}>
                 <Ionicons name="speedometer" size={20} color={COLORS.textLight} />
                 <Text style={[s.coachText, { color: COLORS.textLight, marginTop: 4 }]}>Over Speed Limit</Text>
               </View>
            )}
           </View>
        </View>

        {/* ── Bento Grid Stats ── */}
        <View style={s.grid}>
          {[
            { icon: "flame", val: `${Math.round(telemetry?.engine_load_pct ?? 0)}%`, lbl: "Eng Load" },
            { icon: "thermometer", val: `${Math.round(telemetry?.coolant_temp_c ?? 0)}°C`, lbl: "Coolant" },
            { icon: "water", val: `${Math.round(telemetry?.fuel_level_pct ?? 0)}%`, lbl: "Fuel" },
            { icon: "battery-charging", val: `${telemetry?.battery_voltage?.toFixed(1) ?? "--"}V`, lbl: "Battery" },
          ].map((st, i) => (
            <View key={i} style={[s.bentoCard, s.statCard]}>
              <View style={s.statIconWrap}>
                 <Ionicons name={st.icon as any} size={20} color={COLORS.primary} />
              </View>
              <Text style={s.statVal}>{st.val}</Text>
              <Text style={s.statLbl}>{st.lbl}</Text>
            </View>
          ))}
        </View>
        
        {scanErr && <Text style={s.err}>{scanErr}</Text>}
        <View style={{height: 40}} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  logo: { fontSize: 28, fontWeight: "700", color: COLORS.textDark, letterSpacing: -0.5 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  blob: { width: 8, height: 8, borderRadius: 4 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, fontWeight: "600" },
  iconBtn: { padding: 4 },
  
  bentoCard: { borderRadius: 32, padding: 20, overflow: "hidden" },
  
  dtcCard: { backgroundColor: COLORS.accent, flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dtcTitle: { color: COLORS.textLight, fontSize: 16, fontWeight: "700" },
  dtcSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "500" },
  
  primaryCard: { backgroundColor: COLORS.primary, marginBottom: 16, paddingBottom: 32 },
  primaryCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  primaryCardTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: "600" },
  primaryCardAction: { backgroundColor: "#fff", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  
  hudRow: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center" },
  hudItem: { alignItems: "center" },
  hudVal: { fontSize: 42, fontWeight: "800", color: COLORS.textLight },
  hudLbl: { fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: "500", marginTop: -4 },
  hudDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.2)" },
  
  row: { flexDirection: "row", gap: 16, marginBottom: 16 },
  whiteCard: { backgroundColor: COLORS.cardLight },
  cardSoft: { backgroundColor: COLORS.cardSoft, flex: 1, justifyContent: "center", padding: 16 },
  cardError: { backgroundColor: COLORS.error, padding: 16, borderRadius: 24 },
  coachText: { color: COLORS.textDark, fontSize: 13, fontWeight: "500", marginTop: 8, lineHeight: 18 },
  scoreBox: { alignItems: "center", justifyContent: "center" },
  
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 },
  statCard: { backgroundColor: COLORS.cardLight, width: (SCREEN_W - 56) / 2, padding: 20, borderRadius: 28 },
  statIconWrap: { backgroundColor: COLORS.background, alignSelf: "flex-start", padding: 10, borderRadius: 16, marginBottom: 12 },
  statVal: { color: COLORS.textDark, fontSize: 20, fontWeight: "700" },
  statLbl: { color: COLORS.textMuted, fontSize: 13, fontWeight: "500", marginTop: 2 },
  
  err: { color: COLORS.error, fontSize: 13, textAlign: "center", marginTop: 24, fontWeight: "500" },
});
