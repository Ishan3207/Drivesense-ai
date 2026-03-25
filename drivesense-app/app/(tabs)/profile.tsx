/**
 * DriveSense AI – My Car (Vehicle Profile Screen)
 * ─────────────────────────────────────────────────
 * Lets the user enter their vehicle details (Make, Model, Year, Mileage, Colour).
 * Data is persisted to AsyncStorage via the Zustand store.
 */

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, Platform, Alert, KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDriveStore, VehicleProfile } from "@/store/useDriveStore";

// ── Design tokens (matches dashboard) ────────────────────────────────────────

const C = {
  background: "#C9D6BC",
  primary: "#064E3B",
  accent: "#F59E0B",
  card: "#FFFFFF",
  textDark: "#111827",
  textMuted: "#6B7280",
  textLight: "#FFFFFF",
  border: "#E5E7EB",
  inputBg: "#F9FAFB",
  error: "#DC2626",
};

// ── Field component ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  icon: string;
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  maxLength?: number;
}

function Field({
  label, icon, value, placeholder, onChangeText, keyboardType = "default", maxLength,
}: FieldProps) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputRow}>
        <Ionicons name={icon as any} size={18} color={C.primary} style={s.inputIcon} />
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { vehicleProfile, setVehicleProfile, loadVehicleProfile } = useDriveStore();
  const [saving, setSaving] = useState(false);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [color, setColor] = useState("");

  // Populate form from persisted profile
  useEffect(() => {
    loadVehicleProfile().then(() => {
      const p = useDriveStore.getState().vehicleProfile;
      if (p) {
        setMake(p.make ?? "");
        setModel(p.model ?? "");
        setYear(p.year ? String(p.year) : "");
        setMileage(p.mileage_km ? String(p.mileage_km) : "");
        setColor(p.color ?? "");
      }
    });
  }, []);

  const handleSave = async () => {
    const trimMake = make.trim();
    const trimModel = model.trim();
    const trimYear = year.trim();

    if (!trimMake || !trimModel || !trimYear) {
      Alert.alert("Missing Info", "Please enter at least Make, Model, and Year.");
      return;
    }

    const parsedYear = parseInt(trimYear, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > currentYear + 1) {
      Alert.alert("Invalid Year", `Year must be between 1900 and ${currentYear + 1}.`);
      return;
    }

    const parsedMileage = mileage.trim() ? parseInt(mileage.trim(), 10) : undefined;
    if (parsedMileage !== undefined && (isNaN(parsedMileage) || parsedMileage < 0)) {
      Alert.alert("Invalid Mileage", "Please enter a valid mileage value.");
      return;
    }

    setSaving(true);
    try {
      const profile: VehicleProfile = {
        make: trimMake,
        model: trimModel,
        year: parsedYear,
        mileage_km: parsedMileage,
        color: color.trim() || undefined,
      };
      await setVehicleProfile(profile);
      Alert.alert("✅ Saved", `${trimMake} ${trimModel} (${parsedYear}) saved successfully!`);
    } catch {
      Alert.alert("Error", "Could not save vehicle profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      "Clear Profile",
      "Remove all vehicle details?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setMake(""); setModel(""); setYear(""); setMileage(""); setColor("");
            await setVehicleProfile({ make: "", model: "", year: 0 });
          },
        },
      ]
    );
  };

  const hasProfile = vehicleProfile?.make && vehicleProfile?.model;

  return (
    <KeyboardAvoidingView
      style={s.bg}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.logo}>
            My<Text style={{ color: C.primary }}>Car</Text>
          </Text>
          <Text style={s.subtitle}>
            {hasProfile
              ? `${vehicleProfile!.make} ${vehicleProfile!.model} · ${vehicleProfile!.year}`
              : "No vehicle configured"}
          </Text>
        </View>

        {/* ── Car Summary Card (if profile set) ── */}
        {hasProfile && (
          <View style={[s.card, s.summaryCard]}>
            <View style={s.summaryIconWrap}>
              <Ionicons name="car-sport" size={28} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryTitle}>
                {vehicleProfile!.make} {vehicleProfile!.model}
              </Text>
              <Text style={s.summaryMeta}>
                {vehicleProfile!.year}
                {vehicleProfile!.color ? ` · ${vehicleProfile!.color}` : ""}
                {vehicleProfile!.mileage_km
                  ? ` · ${vehicleProfile!.mileage_km.toLocaleString()} km`
                  : ""}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={C.primary} />
          </View>
        )}

        {/* ── Form Card ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Vehicle Details</Text>

          <Field
            label="Make"
            icon="business"
            value={make}
            placeholder="e.g. Toyota"
            onChangeText={setMake}
            maxLength={40}
          />
          <Field
            label="Model"
            icon="car"
            value={model}
            placeholder="e.g. Camry"
            onChangeText={setModel}
            maxLength={40}
          />
          <Field
            label="Year"
            icon="calendar"
            value={year}
            placeholder="e.g. 2023"
            onChangeText={setYear}
            keyboardType="numeric"
            maxLength={4}
          />
          <Field
            label="Mileage (km)"
            icon="speedometer"
            value={mileage}
            placeholder="e.g. 45000"
            onChangeText={setMileage}
            keyboardType="numeric"
            maxLength={7}
          />
          <Field
            label="Colour"
            icon="color-palette"
            value={color}
            placeholder="e.g. Midnight Blue"
            onChangeText={setColor}
            maxLength={30}
          />

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color={C.textLight} />
              : (
                <>
                  <Ionicons name="save" size={18} color={C.textLight} />
                  <Text style={s.saveBtnText}>Save Vehicle</Text>
                </>
              )
            }
          </TouchableOpacity>

          {hasProfile && (
            <TouchableOpacity style={s.clearBtn} onPress={handleClear}>
              <Text style={s.clearBtnText}>Clear profile</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.background },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 50 },

  header: { marginBottom: 20 },
  logo: { fontSize: 28, fontWeight: "700", color: C.textDark, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 4, fontWeight: "600" },

  card: {
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  summaryIconWrap: {
    backgroundColor: "#DCFCE7",
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: { fontSize: 17, fontWeight: "700", color: C.textDark },
  summaryMeta: { fontSize: 13, color: C.textMuted, marginTop: 2 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textDark,
    marginBottom: 16,
    letterSpacing: 0.2,
  },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.textMuted, marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: C.textDark, fontWeight: "500" },

  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  saveBtnText: { color: C.textLight, fontSize: 16, fontWeight: "700" },

  clearBtn: { alignItems: "center", paddingVertical: 14 },
  clearBtnText: { color: C.error, fontSize: 13, fontWeight: "600" },
});
