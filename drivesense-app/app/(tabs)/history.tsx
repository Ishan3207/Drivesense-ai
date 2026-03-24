import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useDriveStore } from "@/store/useDriveStore";

const SEVERITY_COLOR = {
  low: "#00E87B",
  medium: "#FFB800",
  high: "#FF6B35",
  critical: "#FF4757",
};

export default function HistoryScreen() {
  const router = useRouter();
  const { activeDTCs, diagnosticCache, setSelectedDTC } = useDriveStore();

  const allCodes = Object.keys(diagnosticCache);

  const handleViewResult = (code: string) => {
    setSelectedDTC(code);
    router.push("/diagnostic-detail");
  };

  return (
    <LinearGradient colors={["#0D1117", "#0A1628", "#0D1117"]} style={styles.bg}>
      <View style={styles.header}>
        <Text style={styles.title}>DTC History</Text>
        <Text style={styles.subtitle}>Analyzed fault codes from this session</Text>
      </View>

      {allCodes.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={56} color="#2D3748" />
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptyBody}>
            Analyze a DTC code from the Diagnostics tab to see your full AI Mechanic reports here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={allCodes}
          keyExtractor={(code) => code}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: code }) => {
            const result = diagnosticCache[code];
            const severityColor = { monitor: "#00E87B", soon: "#FFB800", urgent: "#FF6B35", immediate: "#FF4757" }[result.urgency] ?? "#7C8FA6";
            return (
              <TouchableOpacity style={styles.row} onPress={() => handleViewResult(code)} activeOpacity={0.7}>
                <View style={[styles.codeTag, { borderColor: severityColor + "55", backgroundColor: severityColor + "11" }]}>
                  <Text style={[styles.codeText, { color: severityColor }]}>{code}</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.translation} numberOfLines={1}>{result.translation}</Text>
                  <Text style={styles.difficulty}>DIY: {result.diy_difficulty} · Confidence: {(result.ai_confidence * 100).toFixed(0)}%</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#4A5568" />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#E8F0FE" },
  subtitle: { fontSize: 13, color: "#7C8FA6", marginTop: 2 },
  list: { padding: 20, gap: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#0F1923", borderRadius: 16, borderWidth: 1,
    borderColor: "#1A2332", padding: 16,
  },
  codeTag: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minWidth: 70, alignItems: "center" },
  codeText: { fontSize: 13, fontWeight: "800" },
  rowContent: { flex: 1, gap: 3 },
  translation: { fontSize: 14, fontWeight: "600", color: "#E8F0FE" },
  difficulty: { fontSize: 11, color: "#7C8FA6" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#E8F0FE" },
  emptyBody: { fontSize: 14, color: "#7C8FA6", textAlign: "center", lineHeight: 20 },
});
