import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, DropShadow } from "react-native-svg";

import { useDriveStore } from "@/store/useDriveStore";
import { fetchActiveDTCs } from "@/services/api";
import { Config } from "@/constants/config";

const { width: SCREEN_W } = Dimensions.get("window");
const GAUGE_SIZE = Math.min(SCREEN_W * 0.4, 160);

// ── Shared Neon Arc Gauge ──────────────────────────────────────────────────

function NeonGauge({
  value, max, label, unit, color = "#00D4FF", size = GAUGE_SIZE
}: {
  value: number; max: number; label: string; unit: string; color?: string; size?: number;
}) {
  const radius = size * 0.38;
  const stroke = 10;
  const circumference = radius * 2 * Math.PI;
  const pct = Math.min(value / max, 1);
  const strokeDashoffset = circumference - pct * circumference * 0.75; // 270 deg
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={[gaugeS.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={stroke} fill="transparent"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          strokeDashoffset={0} strokeLinecap="round"
          rotation={135} origin={`${cx}, ${cy}`}
        />
        {/* Progress Arc */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={`url(#grad-${label})`}
          strokeWidth={stroke} fill="transparent"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          rotation={135} origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={gaugeS.labelBox}>
        <Text style={[gaugeS.value, { color, textShadowColor: color, textShadowRadius: 8 }]}>
          {Math.round(value)}
        </Text>
        <Text style={gaugeS.unit}>{unit}</Text>
        <Text style={gaugeS.label}>{label}</Text>
      </View>
    </View>
  );
}

const gaugeS = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  labelBox: { position: "absolute", alignItems: "center" },
  value: { fontSize: 28, fontWeight: "900", textShadowOffset: { width: 0, height: 0 } },
  unit: { fontSize: 11, color: "#7C8FA6", fontWeight: "700", marginTop: -4 },
  label: { fontSize: 10, color: "#4A5568", fontWeight: "800", marginTop: 4, letterSpacing: 1 },
});

// ── Score Ring ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= Config.SCORE_TIERS.EXCELLENT ? "#00E87B"
              : score >= Config.SCORE_TIERS.GOOD ? "#FFB800" : "#FF4757";
  const tier = score >= Config.SCORE_TIERS.EXCELLENT ? "EXCELLENT"
             : score >= Config.SCORE_TIERS.GOOD ? "GOOD" : "POOR";

  return (
    <View style={s.scoreBox}>
      <NeonGauge value={score} max={100} label="DRIVER SCORE" unit={tier} color={color} size={150} />
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

// ── Dashboard Screen ────────────────────────────────────────────────────────

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
    <LinearGradient colors={["#05080F", "#0A111F", "#05080F"]} style={s.bg}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Top Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>DriveSense<Text style={{color:"#00D4FF"}}>AI</Text></Text>
            <View style={s.statusRow}>
              <View style={[s.blob, { backgroundColor: isConnected ? "#00E87B" : "#FF4757" }]} />
              <Text style={s.subtitle}>{isConnected ? "LINK ESTABLISHED" : "LINK OFFLINE"}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="apps-outline" size={24} color="#7C8FA6" />
          </TouchableOpacity>
        </View>

        {/* ── Speed Alert ── */}
        {isAlerting && activeZone && (
          <LinearGradient colors={["#FF475733", "#00000000"]} style={s.alertBanner}>
            <Ionicons name="warning" size={24} color="#FF4757" />
            <Text style={s.alertText}>
              SPEED ALERT: {activeZone.name.toUpperCase()}
            </Text>
          </LinearGradient>
        )}

        {/* ── Telemetry HUD ── */}
        <View style={s.hudRow}>
          <NeonGauge value={telemetry?.speed_kmh ?? 0} max={200} label="SPEED" unit="KM/H" color="#00D4FF" />
          <NeonGauge value={telemetry?.rpm ?? 0} max={8000} label="ENGINE" unit="RPM" color="#7B61FF" />
        </View>

        <ScoreRing score={driverScore} />

        {/* ── Glass Stat Grid ── */}
        <View style={s.grid}>
          {[
            { icon: "flame", val: `${Math.round(telemetry?.engine_load_pct ?? 0)}%`, iColor: "#FF6B35" },
            { icon: "thermometer", val: `${Math.round(telemetry?.coolant_temp_c ?? 0)}°C`, iColor: "#FF4757" },
            { icon: "water", val: `${Math.round(telemetry?.fuel_level_pct ?? 0)}%`, iColor: "#FFB800" },
            { icon: "battery-charging", val: `${telemetry?.battery_voltage?.toFixed(1) ?? "--"}V`, iColor: "#00E87B" },
          ].map((st, i) => (
            <View key={i} style={[s.glassCard, { borderLeftColor: st.iColor, borderLeftWidth: 2 }]}>
              <Ionicons name={st.icon as any} size={20} color={st.iColor} />
              <Text style={s.gridVal}>{st.val}</Text>
            </View>
          ))}
        </View>

        {/* ── Active Faults Alert ── */}
        {activeDTCs.length > 0 && (
          <TouchableOpacity style={s.dtcAlert} onPress={() => router.push("/(tabs)/diagnostics")}>
            <LinearGradient colors={["#FF4757", "#8A0000"]} style={s.dtcGrad} start={{x:0,y:0}} end={{x:1,y:1}}>
              <Ionicons name="nuclear" size={24} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={s.dtcTitle}>CRITICAL ALERT</Text>
                <Text style={s.dtcSub}>{activeDTCs.length} FAULT(S) DETECTED</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── AI Coach Tip ── */}
        <View style={s.coachCard}>
          <Ionicons name="pulse" size={20} color="#00D4FF" />
          <Text style={s.coachText}>{tip}</Text>
        </View>

        {/* ── Scan FAB ── */}
        <TouchableOpacity style={s.scanWrap} activeOpacity={0.8} onPress={handleScan} disabled={isScanning}>
          <LinearGradient colors={isScanning ? ["#1A2332", "#1A2332"] : ["#00F0FF", "#0066CC"]} style={s.scanBtn} start={{x:0,y:0}} end={{x:1,y:1}}>
            {isScanning ? <ActivityIndicator color="#fff" /> : <Ionicons name="scan-outline" size={24} color="#fff" />}
            <Text style={s.scanTxt}>{isScanning ? "SYSTEM SCANNING..." : "RUN DIAGNOSTICS"}</Text>
          </LinearGradient>
        </TouchableOpacity>
        {scanErr && <Text style={s.err}>{scanErr}</Text>}

      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  logo: { fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  blob: { width: 8, height: 8, borderRadius: 4, shadowOffset: {width:0,height:0}, shadowOpacity: 1, shadowRadius: 6 },
  subtitle: { fontSize: 10, color: "#7C8FA6", fontWeight: "800", letterSpacing: 1 },
  iconBtn: { backgroundColor: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 12 },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#FF475766", marginBottom: 20 },
  alertText: { color: "#FF4757", fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  hudRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  scoreBox: { alignItems: "center", marginVertical: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginTop: 10 },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.02)", width: (SCREEN_W - 52) / 2, padding: 16,
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
    flexDirection: "row", alignItems: "center", gap: 12
  },
  gridVal: { color: "#fff", fontSize: 18, fontWeight: "800" },
  dtcAlert: { marginTop: 20, borderRadius: 16, overflow: "hidden" },
  dtcGrad: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  dtcTitle: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  dtcSub: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700", marginTop: 2, letterSpacing: 0.5 },
  coachCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(0, 212, 255, 0.05)", padding: 16, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: "rgba(0, 212, 255, 0.15)" },
  coachText: { color: "#00D4FF", fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 18 },
  scanWrap: { marginTop: 30, borderRadius: 100, shadowColor: "#00F0FF", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18, borderRadius: 100 },
  scanTxt: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  err: { color: "#FF4757", fontSize: 12, textAlign: "center", marginTop: 12 },
});
