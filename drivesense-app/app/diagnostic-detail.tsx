import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";

import { useDriveStore } from "@/store/useDriveStore";

const URGENCY_CONFIG = {
  monitor:   { color: "#00E87B", label: "MONITOR", icon: "eye" },
  soon:      { color: "#FFB800", label: "FIX SOON", icon: "time" },
  urgent:    { color: "#FF6B35", label: "URGENT", icon: "alert" },
  immediate: { color: "#FF4757", label: "DO NOT DRIVE", icon: "nuclear" },
} as const;

const DIFFICULTY_CONFIG = {
  Easy:   { color: "#00E87B", icon: "construct" },
  Medium: { color: "#FFB800", icon: "hammer" },
  Hard:   { color: "#FF6B35", icon: "settings" },
  Expert: { color: "#FF4757", icon: "car-sport" },
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.secHeaderRow}>
        <View style={s.secLine} />
        <Text style={s.secTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function CollapsibleSteps({ steps }: { steps: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? steps : steps.slice(0, 3);
  return (
    <View style={s.stepsList}>
      {shown.map((step, i) => (
        <View key={i} style={s.stepRow}>
          <View style={s.stepNumber}>
            <Text style={s.stepNum}>{i + 1}</Text>
          </View>
          <Text style={s.stepText}>{step}</Text>
        </View>
      ))}
      {steps.length > 3 && (
        <TouchableOpacity style={s.showMore} onPress={() => setExpanded(!expanded)}>
          <Text style={s.showMoreText}>{expanded ? "SHOW LESS" : `SHOW ${steps.length - 3} MORE STEPS`}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#00D4FF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function DiagnosticDetailScreen() {
  const router = useRouter();
  const { selectedDTC, diagnosticCache } = useDriveStore();
  const result = selectedDTC ? diagnosticCache[selectedDTC] : null;

  if (!result) {
    return (
      <LinearGradient colors={["#05080F", "#0A111F"]} style={s.bg}>
        <View style={s.noResult}>
          <ActivityIndicator color="#00D4FF" size="large" />
          <Text style={s.noResultText}>AI MECHANIC ANALYZING…</Text>
        </View>
      </LinearGradient>
    );
  }

  const urgency = URGENCY_CONFIG[result.urgency as keyof typeof URGENCY_CONFIG] ?? URGENCY_CONFIG.monitor;
  const difficulty = DIFFICULTY_CONFIG[result.diy_difficulty as keyof typeof DIFFICULTY_CONFIG] ?? DIFFICULTY_CONFIG.Medium;
  const confidencePct = Math.round(result.ai_confidence * 100);

  return (
    <LinearGradient colors={["#05080F", "#0A111F", "#05080F"]} style={s.bg}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero Banner ── */}
        <View style={s.hero}>
          <LinearGradient colors={["rgba(0,212,255,0.05)", "transparent"]} style={StyleSheet.absoluteFillObject} />
          <View style={s.heroLeft}>
            <Text style={[s.dtcCode, { textShadowColor: "#00D4FF", textShadowRadius: 10 }]}>{result.dtc_code}</Text>
            <Text style={s.translation}>{result.translation}</Text>
          </View>
          <View style={s.confBadge}>
            <Svg height={60} width={60} style={{ position: "absolute" }}>
              <Circle cx={30} cy={30} r={26} stroke="rgba(0, 232, 123, 0.2)" strokeWidth={4} fill="transparent" />
              <Circle
                cx={30} cy={30} r={26} stroke="#00E87B" strokeWidth={4} fill="transparent"
                strokeDasharray={`${26 * 2 * Math.PI}`}
                strokeDashoffset={(26 * 2 * Math.PI) * (1 - result.ai_confidence)}
                strokeLinecap="round" rotation={-90} origin="30, 30"
              />
            </Svg>
            <Text style={s.confVal}>{confidencePct}</Text>
          </View>
        </View>

        {/* ── Urgency pill ── */}
        <View style={[s.urgencyPill, { borderLeftColor: urgency.color }]}>
          <Ionicons name={urgency.icon as any} size={20} color={urgency.color} />
          <Text style={[s.urgencyText, { color: urgency.color, textShadowColor: urgency.color, textShadowRadius: 8 }]}>
            {urgency.label}
          </Text>
        </View>

        {/* ── Root Causes ── */}
        <Section title="ROOT CAUSES">
          {result.root_causes.map((cause, i) => (
            <View key={i} style={s.causeRow}>
              <View style={s.causeDot} />
              <Text style={s.causeText}>{cause}</Text>
            </View>
          ))}
        </Section>

        {/* ── Repair Steps ── */}
        <Section title="REPAIR PROTOCOL">
          <CollapsibleSteps steps={result.repair_steps} />
        </Section>

        {/* ── Cost Estimate ── */}
        <Section title="ESTIMATED COST">
          <View style={s.costRow}>
            <LinearGradient colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0.01)"]} style={s.costCard}>
              <Text style={s.costType}>PARTS</Text>
              <Text style={s.costRange}>
                {result.cost_estimate_parts.currency.replace("USD","$ ")}{result.cost_estimate_parts.low} - {result.cost_estimate_parts.high}
              </Text>
            </LinearGradient>
            <LinearGradient colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0.01)"]} style={s.costCard}>
              <Text style={s.costType}>LABOUR</Text>
              <Text style={s.costRange}>
                {result.cost_estimate_labor.currency.replace("USD","$ ")}{result.cost_estimate_labor.low} - {result.cost_estimate_labor.high}
              </Text>
            </LinearGradient>
          </View>
        </Section>

        {/* ── DIY Difficulty ── */}
        <Section title="DIY DIFFICULTY">
           <View style={[s.diffBdg, { borderColor: difficulty.color + "55", backgroundColor: difficulty.color + "11" }]}>
             <Ionicons name={difficulty.icon as any} size={22} color={difficulty.color} />
             <Text style={[s.diffTxt, { color: difficulty.color, textShadowColor: difficulty.color, textShadowRadius: 6 }]}>
               {result.diy_difficulty.toUpperCase()}
             </Text>
           </View>
        </Section>

        {/* ── CTA: Find Nearby Shop ── */}
        <TouchableOpacity style={s.ctaBtn} onPress={() => router.push("/(tabs)") /* Navigate home */} activeOpacity={0.8}>
          <LinearGradient colors={["#00F0FF", "#0066CC"]} style={s.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="location" size={24} color="#fff" />
            <Text style={s.ctaText}>LOCATE NEARBY MECHANICS</Text>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 60 },
  hero: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 24, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(0, 212, 255, 0.2)", overflow: "hidden"
  },
  heroLeft: { flex: 1, marginRight: 16 },
  dtcCode: { fontSize: 36, fontWeight: "900", color: "#00D4FF", letterSpacing: 2 },
  translation: { fontSize: 15, fontWeight: "700", color: "#E8F0FE", marginTop: 6, lineHeight: 22, letterSpacing: 0.5 },
  confBadge: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  confVal: { fontSize: 18, fontWeight: "900", color: "#00E87B", textShadowColor: "#00E87B", textShadowRadius: 8 },
  urgencyPill: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)", borderLeftWidth: 4,
    borderRadius: 8, padding: 16, marginBottom: 24,
  },
  urgencyText: { fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  section: { marginBottom: 30 },
  secHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  secLine: { width: 24, height: 2, backgroundColor: "#00D4FF", shadowColor: "#00D4FF", shadowOpacity: 1, shadowRadius: 4 },
  secTitle: { fontSize: 14, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  causeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  causeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#00D4FF", marginTop: 6, shadowColor: "#00D4FF", shadowOpacity: 0.8, shadowRadius: 6 },
  causeText: { color: "#A0AEC0", fontSize: 15, flex: 1, lineHeight: 22, fontWeight: "500" },
  stepsList: { gap: 16 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0, 212, 255, 0.1)", borderWidth: 1, borderColor: "rgba(0, 212, 255, 0.3)", alignItems: "center", justifyContent: "center" },
  stepNum: { color: "#00D4FF", fontWeight: "900", fontSize: 14 },
  stepText: { color: "#E8F0FE", fontSize: 15, flex: 1, lineHeight: 24, fontWeight: "500" },
  showMore: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, alignSelf: "flex-start", padding: 8, backgroundColor: "rgba(0, 212, 255, 0.05)", borderRadius: 8 },
  showMoreText: { color: "#00D4FF", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  costRow: { flexDirection: "row", gap: 12 },
  costCard: {
    flex: 1, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", alignItems: "center",
  },
  costType: { fontSize: 11, color: "#7C8FA6", fontWeight: "900", marginBottom: 8, letterSpacing: 1.5 },
  costRange: { fontSize: 22, fontWeight: "900", color: "#00E87B", textShadowColor: "#00E87B", textShadowRadius: 8 },
  diffBdg: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignSelf: "flex-start" },
  diffTxt: { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  ctaBtn: { marginTop: 10, borderRadius: 100, shadowColor: "#00F0FF", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  ctaGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, borderRadius: 100 },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1.5 },
  noResult: { flex: 1, alignItems: "center", justifyContent: "center" },
  noResultText: { fontSize: 14, fontWeight: "900", color: "#00D4FF", marginTop: 24, letterSpacing: 2 },
});
