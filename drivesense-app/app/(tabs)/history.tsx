import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useDriveStore } from "@/store/useDriveStore";

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

export default function HistoryScreen() {
  const router = useRouter();
  const { diagnosticCache, setSelectedDTC } = useDriveStore();

  const allCodes = Object.keys(diagnosticCache);

  const handleViewResult = (code: string) => {
    setSelectedDTC(code);
    router.push("/diagnostic-detail");
  };

  return (
    <View style={s.bg}>
      <View style={s.header}>
        <Text style={s.title}>DTC History</Text>
        <Text style={s.subtitle}>Analyzed fault codes from this session</Text>
      </View>

      {allCodes.length === 0 ? (
        <View style={s.empty}>
          <View style={s.iconBg}>
            <Ionicons name="document-text" size={48} color={COLORS.textMuted} />
          </View>
          <Text style={s.emptyTitle}>No History Yet</Text>
          <Text style={s.emptyBody}>
            Analyze a DTC code from the Diagnostics tab to see your AI Mechanic reports here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={allCodes}
          keyExtractor={(code) => code}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: code }) => {
            const result = diagnosticCache[code];
            const severityColor = { monitor: COLORS.teal, soon: COLORS.accent, urgent: "#ea580c", immediate: COLORS.error }[result.urgency] ?? COLORS.textMuted;
            return (
              <TouchableOpacity style={s.row} onPress={() => handleViewResult(code)} activeOpacity={0.7}>
                <View style={[s.codeTag, { backgroundColor: severityColor + "15" }]}>
                  <Text style={[s.codeText, { color: severityColor }]}>{code}</Text>
                </View>
                <View style={s.rowContent}>
                  <Text style={s.translation} numberOfLines={1}>{result.translation}</Text>
                  <Text style={s.difficulty}>DIY: {result.diy_difficulty} · Confidence: {(result.ai_confidence * 100).toFixed(0)}%</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: Platform.OS === "ios" ? 60 : 40, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 32, fontWeight: "700", color: COLORS.textDark, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, fontWeight: "500" },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: COLORS.cardLight, borderRadius: 24, padding: 16,
  },
  codeTag: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 70, alignItems: "center" },
  codeText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  rowContent: { flex: 1, gap: 4 },
  translation: { fontSize: 16, fontWeight: "700", color: COLORS.textDark },
  difficulty: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, paddingBottom: 100 },
  iconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.cardLight, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: COLORS.textDark },
  emptyBody: { fontSize: 15, color: COLORS.textMuted, textAlign: "center", marginTop: 8, fontWeight: "500", lineHeight: 22 },
});
