import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";

import { startOBDService, stopOBDService } from "@/services/obdService";
import { startGeofenceMonitoring } from "@/services/geofenceService";
import { requestNotificationPermissions } from "@/services/notificationService";
import { Config } from "@/constants/config";

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      await requestNotificationPermissions();
      await startGeofenceMonitoring();
      if (!Config.USE_REAL_BLE) {
        startOBDService();
      } else {
        // Phase 5: BLE is started from a dedicated connect screen
        const { startBLEService } = await import("@/services/bleService");
        startBLEService().catch(console.error);
      }
    })();

    return () => {
      stopOBDService();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="diagnostic-detail"
          options={{
            headerShown: true,
            title: "AI Mechanic Report",
            headerStyle: { backgroundColor: "#0D1117" },
            headerTintColor: "#00D4FF",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
