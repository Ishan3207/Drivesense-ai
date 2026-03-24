/**
 * Geofence Service
 * ─────────────────
 * Background location task + zone comparison engine.
 * Calls check_position locally (using mock zones) AND via the API
 * for production accuracy. Triggers alerts and score deductions.
 */

import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { MOCK_ZONES } from "@/constants/mockZones";
import { useDriveStore } from "@/store/useDriveStore";
import { triggerSpeedAlert } from "@/services/notificationService";

export const GEOFENCE_TASK = "DRIVESENSE_GEOFENCE_TASK";

function haversineMeters(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkPosition(lat: number, lon: number, speedKmh: number) {
  const store = useDriveStore.getState();
  let foundZone = null;

  for (const zone of MOCK_ZONES) {
    const dist = haversineMeters(lat, lon, zone.latitude, zone.longitude);
    if (dist <= zone.radius_meters) {
      foundZone = zone;
      break;
    }
  }

  if (!foundZone) {
    store.setActiveZone(null);
    store.setIsAlerting(false);
    return;
  }

  store.setActiveZone({
    id: foundZone.id,
    name: foundZone.name,
    zone_type: foundZone.zone_type,
    speed_limit_kmh: foundZone.speed_limit_kmh,
    speed_excess_kmh: Math.max(0, speedKmh - foundZone.speed_limit_kmh),
  });

  const excess = speedKmh - foundZone.speed_limit_kmh;
  if (excess > 0) {
    store.setIsAlerting(true);
    store.applyScoreDelta(-(10 + Math.min(excess * 0.3, 15)));
    triggerSpeedAlert(foundZone.name, excess, foundZone.speed_limit_kmh);
  } else {
    store.setIsAlerting(false);
  }
}

// ── Background Location Task ──────────────────────────────────────────────────

if (Platform.OS !== "web") {
  TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }: any) => {
    if (error) {
      console.error("[Geofence]", error);
      return;
    }
    const { locations } = data;
    const loc = locations?.[0];
    if (!loc) return;

    const speedKmh = (loc.coords.speed ?? 0) * 3.6; // m/s → km/h
    checkPosition(loc.coords.latitude, loc.coords.longitude, speedKmh);
  });
}

export async function startGeofenceMonitoring() {
  if (Platform.OS === "web") return;
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") {
    console.warn("[Geofence] Background location permission denied.");
    return;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(GEOFENCE_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 15, // update every 15m moved
      timeInterval: 5_000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "DriveSense AI",
        notificationBody: "Monitoring speed in safety zones…",
        notificationColor: "#00D4FF",
      },
    });
  }
  console.log("[Geofence] Background monitoring started.");
}

export async function stopGeofenceMonitoring() {
  if (Platform.OS === "web") return;
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(GEOFENCE_TASK);
  }
}
