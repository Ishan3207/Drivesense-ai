import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useDriveStore } from "@/store/useDriveStore";
import { fetchActiveDTCs, analyzeDTC } from "@/services/api";
import type { DTCEntry } from "@/store/useDriveStore";

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

const SEVERITY_CONFIG = {
  low:      { color: COLORS.teal, icon: "checkmark-circle" },
  medium:   { color: COLORS.accent, icon: "warning" },
  high:     { color: "#ea580c", icon: "alert-circle" },
  critical: { color: COLORS.error, icon: "nuclear" },
} as const;

function DTCCard({ dtc, onAnalyze, isAnalyzing }: { dtc: DTCEntry; onAnalyze: (code: string) => void; isAnalyzing: boolean; }) {
  const cfg = SEVERITY_CONFIG[dtc.severity] ?? SEVERITY_CONFIG.medium;
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.iconBg, { backgroundColor: cfg.color + "15" }]}>
          <Ionicons name={cfg.icon as any} size={24} color={cfg.color} />
        </View>
        <View style={s.cardTitle}>
          <Text style={s.dtcCode}>{dtc.code}</Text>
          <View style={[s.severityBadge, { backgroundColor: cfg.color }]}>
            <Text style={s.severityText}>{dtc.severity.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <Text style={s.dtcDesc}>{dtc.description}</Text>
      <TouchableOpacity
        style={[s.analyzeBtn, { backgroundColor: COLORS.primary }]}
        onPress={() => onAnalyze(dtc.code)} disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <ActivityIndicator size="small" color={COLORS.textLight} />
        ) : (
          <>
            <Ionicons name="sparkles" size={16} color={COLORS.textLight} />
            <Text style={s.analyzeBtnText}>Analyze Issue with AI</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
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
    <View style={s.bg}>
      <View style={s.header}>
        <Text style={s.title}>System Diagnostics</Text>
        <Text style={s.subtitle}>OBD-II FAULT LOGS</Text>
      </View>

      {activeDTCs.length === 0 ? (
        <View style={s.empty}>
          <View style={s.glowCircle}>
            <Ionicons name="checkmark-done" size={60} color={COLORS.teal} />
          </View>
          <Text style={s.emptyTitle}>System Nominal</Text>
          <Text style={s.emptyBody}>No active faults detected in the vehicle bus.</Text>
        </View>
      ) : (
        <FlatList
          data={activeDTCs}
          keyExtractor={(item) => item.code}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <DTCCard dtc={item} onAnalyze={handleAnalyze} isAnalyzing={analyzingCode === item.code} />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: Platform.OS === "ios" ? 60 : 40, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: "700", color: COLORS.textDark, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, fontWeight: "600", marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 16 },
  card: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 24, padding: 20,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconBg: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  dtcCode: { fontSize: 20, fontWeight: "800", color: COLORS.textDark },
  severityBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  severityText: { fontSize: 10, fontWeight: "700", color: COLORS.textLight, letterSpacing: 0.5 },
  dtcDesc: { color: COLORS.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 20, fontWeight: "500" },
  analyzeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 100, paddingVertical: 14,
  },
  analyzeBtnText: { fontWeight: "700", color: COLORS.textLight, fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, paddingBottom: 100 },
  glowCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.cardLight,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  emptyTitle: { fontSize: 24, fontWeight: "700", color: COLORS.textDark },
  emptyBody: { fontSize: 15, color: COLORS.textMuted, textAlign: "center", marginTop: 8, fontWeight: "500" },
});
