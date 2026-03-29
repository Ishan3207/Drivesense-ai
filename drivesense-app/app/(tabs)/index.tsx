import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";

import { useDriveStore } from "@/store/useDriveStore";
import { fetchActiveDTCs, AppError } from "@/services/api";
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
    setActiveDTCs, isScanning, setIsScanning, vehicleProfile,
  } = useDriveStore();
  const [scanErr, setScanErr] = useState<string|null>(null);
  const [speedPulse, setSpeedPulse] = useState(true);

  const speed = telemetry?.speed_kmh ?? 0;
  const isOverSpeed = speed > 60;

  // Pulse the speed-warning banner
  useEffect(() => {
    if (!isOverSpeed) return;
    const id = setInterval(() => setSpeedPulse(p => !p), 600);
    return () => clearInterval(id);
  }, [isOverSpeed]);

  const tip = telemetry ? getTip(telemetry.rpm, telemetry.engine_load_pct, telemetry.speed_kmh) : "Connect vehicle for insights.";

  const handleScan = useCallback(async () => {
    setScanErr(null); setIsScanning(true);
    try {
      const dtcs = await fetchActiveDTCs();
      setActiveDTCs(dtcs);
      if (dtcs.length === 0) Alert.alert("✅ System Nominal", "No faults detected.");
      else router.push("/(tabs)/diagnostics");
    } catch (err) {
      const msg = err instanceof AppError
        ? (err.isNetwork ? "Cannot reach the vehicle server. Check your connection." : err.message)
        : "Could not connect to vehicle. Server unreachable.";
      Alert.alert(
        "Scan Failed",
        msg,
        [
          { text: "Dismiss", style: "cancel" },
          { text: "Retry", onPress: handleScan },
        ]
      );
    } finally { setIsScanning(false); }
  }, []);

  return (
    <View style={s.bg}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Top Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.logo}>Drive<Text style={{color: COLORS.primary}}>Sense</Text></Text>
            <View style={s.statusRow}>
              <View style={[s.blob, { backgroundColor: isConnected ? COLORS.primary : COLORS.error }]} />
              <Text style={s.subtitle}>{isConnected ? "Connected" : "Offline"}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/(tabs)/profile")}>
            <Ionicons name="person-circle" size={36} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Vehicle Info Banner ── */}
        {vehicleProfile?.make && vehicleProfile?.model ? (
          <TouchableOpacity
            style={s.vehicleBanner}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.8}
          >
            <Ionicons name="car-sport" size={18} color={COLORS.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.vehicleName}>
                {vehicleProfile.make} {vehicleProfile.model}
              </Text>
              <Text style={s.vehicleMeta}>
                {vehicleProfile.year}
                {vehicleProfile.color ? ` · ${vehicleProfile.color}` : ""}
                {vehicleProfile.mileage_km ? ` · ${vehicleProfile.mileage_km.toLocaleString()} km` : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.vehicleBanner, { borderColor: "#D1FAE5", backgroundColor: "#F0FDF4" }]}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={[s.vehicleName, { flex: 1, marginLeft: 10, color: COLORS.primary }]}>
              Set up your car →
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Speed Warning Banner ── */}
        {isOverSpeed && (
          <View style={[s.speedWarn, { opacity: speedPulse ? 1 : 0.55 }]}>
            <Ionicons name="speedometer" size={22} color="#fff" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.speedWarnTitle}>⚠️  Speed Alert – Slow Down!</Text>
              <Text style={s.speedWarnSub}>{Math.round(speed)} km/h · Limit 60 km/h</Text>
            </View>
          </View>
        )}

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
        
        <View style={{height: 40}} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },

  vehicleBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.cardLight, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB",
  },
  vehicleName: { fontSize: 14, fontWeight: "700", color: COLORS.textDark },
  vehicleMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
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

  speedWarn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.error, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 16,
    marginBottom: 16,
  },
  speedWarnTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  speedWarnSub:   { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600", marginTop: 2 },
});
