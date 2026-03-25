import { Tabs as ExpoTabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useEffect } from "react";
import { useDriveStore } from "@/store/useDriveStore";

export default function TabLayout() {
  // Load persisted vehicle profile when the app first mounts
  const loadVehicleProfile = useDriveStore((s) => s.loadVehicleProfile);
  useEffect(() => { loadVehicleProfile(); }, []);

  return (
    <ExpoTabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "rgba(0,0,0,0.05)",
          height: Platform.OS === "ios" ? 85 : 70,
          paddingBottom: Platform.OS === "ios" ? 25 : 12,
          paddingTop: 8,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          position: "absolute",
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 10,
        },
        tabBarActiveTintColor: "#064E3B",
        tabBarInactiveTintColor: "#6B7280",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 4 },
      }}
    >
      <ExpoTabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <ExpoTabs.Screen
        name="simulator"
        options={{
          title: "Simulator",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="hardware-chip" size={size} color={color} />
          ),
        }}
      />
      <ExpoTabs.Screen
        name="diagnostics"
        options={{
          title: "Diagnostics",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="medkit" size={size} color={color} />
          ),
        }}
      />
      <ExpoTabs.Screen
        name="map"
        options={{
          title: "Nearby Fix",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <ExpoTabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <ExpoTabs.Screen
        name="profile"
        options={{
          title: "My Car",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport" size={size} color={color} />
          ),
        }}
      />
    </ExpoTabs>
  );
}
