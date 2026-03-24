import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useDriveStore } from "@/store/useDriveStore";
import { fetchActiveDTCs, analyzeDTC } from "@/services/api";
import type { DTCEntry } from "@/store/useDriveStore";

const SEVERITY_CONFIG = {
  low:      { color: "#00E87B", icon: "checkmark-circle" },
  medium:   { color: "#FFB800", icon: "warning" },
  high:     { color: "#FF6B35", icon: "alert-circle" },
  critical: { color: "#FF4757", icon: "nuclear" },
} as const;

function DTCCard({ dtc, onAnalyze, isAnalyzing }: { dtc: DTCEntry; onAnalyze: (code: string) => void; isAnalyzing: boolean; }) {
  const cfg = SEVERITY_CONFIG[dtc.severity] ?? SEVERITY_CONFIG.medium;
  return (
    <LinearGradient colors={["rgba(255,255,255,0.03)", "rgba(255,255,255,0.01)"]} style={[s.card, { borderLeftColor: cfg.color }]}>
      <View style={s.cardHeader}>
        <Ionicons name={cfg.icon as any} size={24} color={cfg.color} />
        <View style={s.cardTitle}>
          <Text style={[s.dtcCode, { color: cfg.color, textShadowColor: cfg.color, textShadowRadius: 8 }]}>{dtc.code}</Text>
          <View style={[s.severityBadge, { backgroundColor: cfg.color + "22", borderColor: cfg.color + "55", borderWidth: 1 }]}>
            <Text style={[s.severityText, { color: cfg.color }]}>{dtc.severity.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <Text style={s.dtcDesc}>{dtc.description}</Text>
      <TouchableOpacity
        style={[s.analyzeBtn, { backgroundColor: cfg.color + "11", borderColor: cfg.color + "33" }]}
        onPress={() => onAnalyze(dtc.code)} disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <ActivityIndicator size="small" color={cfg.color} />
        ) : (
          <>
            <Ionicons name="sparkles" size={16} color={cfg.color} />
            <Text style={[s.analyzeBtnText, { color: cfg.color }]}>ANALYZE WITH AI MECHANIC</Text>
          </>
        )}
      </TouchableOpacity>
    </LinearGradient>
  );
}

export default function DiagnosticsScreen() {
  const router = useRouter();
  const { activeDTCs, setActiveDTCs, setDiagnosticResult, setSelectedDTC } = useDriveStore();
  const [refreshing, setRefreshing] = useState(false);
  const [analyzingCode, setAnalyzingCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const dtcs = await fetchActiveDTCs();
      setActiveDTCs(dtcs);
    } finally { setRefreshing(false); }
  }, []);

  const handleAnalyze = useCallback(async (code: string) => {
    setAnalyzingCode(code); setSelectedDTC(code);
    try {
      const result = await analyzeDTC(code);
      setDiagnosticResult(code, result);
    } catch {
      // ignore, let detail screen handle empty state
    } finally {
      setAnalyzingCode(null);
      router.push("/diagnostic-detail");
    }
  }, []);

  return (
    <LinearGradient colors={["#05080F", "#0A111F", "#05080F"]} style={s.bg}>
      <View style={s.header}>
        <Text style={s.title}>System Diagnostics</Text>
        <Text style={s.subtitle}>OBD-II FAULT LOGS</Text>
      </View>

      {activeDTCs.length === 0 ? (
        <View style={s.empty}>
          <View style={s.glowCircle}>
            <Ionicons name="checkmark-done" size={80} color="#00E87B" />
          </View>
          <Text style={s.emptyTitle}>SYSTEM NOMINAL</Text>
          <Text style={s.emptyBody}>No active faults detected in the vehicle bus.</Text>
        </View>
      ) : (
        <FlatList
          data={activeDTCs}
          keyExtractor={(item) => item.code}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#00D4FF" />}
          renderItem={({ item }) => (
            <DTCCard dtc={item} onAnalyze={handleAnalyze} isAnalyzing={analyzingCode === item.code} />
          )}
        />
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  subtitle: { fontSize: 11, color: "#00D4FF", fontWeight: "800", marginTop: 4, letterSpacing: 1.5 },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  card: {
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
    borderLeftWidth: 4, padding: 20,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  cardTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  dtcCode: { fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  severityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  severityText: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  dtcDesc: { color: "#A0AEC0", fontSize: 14, lineHeight: 20, marginBottom: 20, fontWeight: "500" },
  analyzeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14,
  },
  analyzeBtnText: { fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  glowCircle: {
    width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(0, 232, 123, 0.05)",
    alignItems: "center", justifyContent: "center", marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(0, 232, 123, 0.2)",
    shadowColor: "#00E87B", shadowOpacity: 0.2, shadowRadius: 30
  },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: "#00E87B", letterSpacing: 2 },
  emptyBody: { fontSize: 13, color: "#7C8FA6", textAlign: "center", marginTop: 10, fontWeight: "600" },
});
