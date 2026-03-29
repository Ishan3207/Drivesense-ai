/**
 * Notification & Alert Service
 * ─────────────────────────────
 * Handles local push notifications and audio alerts for geofence
 * speed violations. Uses expo-notifications + expo-av.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications appear when app is foregrounded
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions() {
  if (Platform.OS === "web") return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.warn("[Notifications] Permission not granted.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("geofence_alerts", {
      name: "Geofence Speed Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 100, 300],
      lightColor: "#FF0000",
      sound: "default",
    });
  }
}

let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 8_000; // Don't spam alerts faster than every 8s

export async function triggerSpeedAlert(
  zoneName: string,
  excessKmh: number,
  limitKmh: number,
) {
  if (Platform.OS === "web") return;
  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;
  lastAlertTime = now;

  const body = `⚠️ You are ${excessKmh.toFixed(0)} km/h over the ${limitKmh} km/h limit in ${zoneName}. Driver score reduced.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🚨 SPEED ALERT – Safety Zone",
      body,
      sound: "default",
      data: { type: "speed_alert", zone: zoneName },
    },
    trigger: null, // fire immediately
  });
}

export async function clearAllAlertNotifications() {
  if (Platform.OS === "web") return;
  await Notifications.dismissAllNotificationsAsync();
}
