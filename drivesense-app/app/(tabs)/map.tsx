/**
 * DriveSense AI – Nearby Fix (Map Screen)
 * ───────────────────────────────────────
 * Shows the user's real GPS location on a MapView, lets them choose
 * a search radius (1–50 km), and displays nearby auto-repair shops
 * as map markers + a scrollable card list below.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Linking, ActivityIndicator, Platform, Alert, Dimensions,
} from "react-native";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { fetchNearbyShops, AppError } from "@/services/api";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopResult {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  user_ratings_total?: number;
  distance_km?: number;
  open_now?: boolean;
  maps_url: string;
  latitude?: number;
  longitude?: number;
}

interface Coords {
  latitude: number;
  longitude: number;
}

// ── Shop Card ─────────────────────────────────────────────────────────────────

function ShopCard({ shop, onPress }: { shop: ShopResult; onPress?: () => void }) {
  const openMaps = () => {
    Linking.openURL(shop.maps_url).catch(() =>
      Alert.alert("Error", "Could not open Maps. Please try again.")
    );
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
        {shop.open_now !== undefined && (
          <View style={[styles.badge, { backgroundColor: shop.open_now ? "#00E87B22" : "#FF475722" }]}>
            <Text style={[styles.badgeText, { color: shop.open_now ? "#00E87B" : "#FF4757" }]}>
              {shop.open_now ? "Open" : "Closed"}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.address} numberOfLines={2}>{shop.address}</Text>
      <View style={styles.metaRow}>
        {!!shop.rating && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#FFB800" />
            <Text style={styles.ratingText}>{shop.rating.toFixed(1)}</Text>
            {!!shop.user_ratings_total && (
              <Text style={styles.ratingCount}>({shop.user_ratings_total})</Text>
            )}
          </View>
        )}
        {!!shop.distance_km && (
          <Text style={styles.distance}>{shop.distance_km.toFixed(1)} km away</Text>
        )}
      </View>
      <TouchableOpacity style={styles.mapsBtn} onPress={openMaps}>
        <Ionicons name="navigate" size={14} color="#00D4FF" />
        <Text style={styles.mapsBtnText}>Open in Maps</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const DEFAULT_RADIUS_KM = 10;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);

  const [location, setLocation] = useState<Coords | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [sliderValue, setSliderValue] = useState(DEFAULT_RADIUS_KM);
  const [shops, setShops] = useState<ShopResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Location permission & GPS ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationDenied(true);
          // Use a fallback location so the map still shows something
          setLocation({ latitude: 37.7749, longitude: -122.4194 });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch (err) {
        console.warn("[MapScreen] Location error:", err);
        setLocationDenied(true);
        setLocation({ latitude: 37.7749, longitude: -122.4194 });
      }
    })();
  }, []);

  // ── Fetch shops whenever location or radius changes ──────────────────────
  const loadShops = useCallback(async (coords: Coords, km: number) => {
    setError(null);
    setLoading(true);
    try {
      const results = await fetchNearbyShops(
        coords.latitude,
        coords.longitude,
        km * 1000,
      );
      setShops(results ?? []);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.isNetwork
          ? "Cannot reach server. Showing cached results if available."
          : err.message
        );
      } else {
        setError("Could not load nearby shops. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!location) return;
    loadShops(location, radiusKm);
  }, [location, radiusKm, loadShops]);

  // Debounce slider → only trigger fetch 600 ms after user stops sliding
  const onSliderChange = (val: number) => {
    setSliderValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRadiusKm(Math.round(val));
    }, 600);
  };

  // Fly map to selected marker
  const handleCardPress = (shop: ShopResult) => {
    if (!shop.latitude || !shop.longitude) return;
    setSelectedShopId(shop.place_id);
    mapRef.current?.animateToRegion({
      latitude: shop.latitude,
      longitude: shop.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  };

  const region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: radiusKm * 0.018,
        longitudeDelta: radiusKm * 0.018,
      }
    : undefined;

  return (
    <View style={styles.bg}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Fix</Text>
        <Text style={styles.subtitle}>
          {locationDenied
            ? "Location unavailable – showing demo area"
            : "Auto repair shops near you"}
        </Text>
      </View>

      {/* ── Map ── */}
      <View style={styles.mapContainer}>
        {region && (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            initialRegion={region}
            showsUserLocation={!locationDenied}
            showsMyLocationButton={false}
          >
            {/* Radius circle */}
            {location && (
              <Circle
                center={location}
                radius={radiusKm * 1000}
                strokeColor="rgba(6,78,59,0.4)"
                fillColor="rgba(6,78,59,0.08)"
                strokeWidth={1.5}
              />
            )}

            {/* Shop markers */}
            {shops.map((shop) =>
              shop.latitude && shop.longitude ? (
                <Marker
                  key={shop.place_id}
                  coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
                  title={shop.name}
                  description={shop.address}
                  pinColor={selectedShopId === shop.place_id ? "#F59E0B" : "#064E3B"}
                />
              ) : null
            )}
          </MapView>
        )}

        {/* Loading overlay on map */}
        {loading && !location && (
          <View style={styles.mapLoading}>
            <ActivityIndicator color="#064E3B" />
          </View>
        )}
      </View>

      {/* ── Radius Control ── */}
      <View style={styles.radiusCard}>
        <View style={styles.radiusHeader}>
          <Ionicons name="radio-button-on" size={16} color="#064E3B" />
          <Text style={styles.radiusLabel}>Search Radius</Text>
          <Text style={styles.radiusValue}>{Math.round(sliderValue)} km</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={50}
          value={sliderValue}
          onValueChange={onSliderChange}
          minimumTrackTintColor="#064E3B"
          maximumTrackTintColor="#CBD5E1"
          thumbTintColor="#064E3B"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderEdge}>1 km</Text>
          <Text style={styles.sliderEdge}>50 km</Text>
        </View>
      </View>

      {/* ── List ── */}
      {loading && (
        <View style={styles.centred}>
          <ActivityIndicator color="#064E3B" />
          <Text style={styles.loadingText}>Finding shops nearby…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline" size={24} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => location && loadShops(location, radiusKm)}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={shops}
          keyExtractor={(s) => s.place_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centred}>
              <Ionicons name="search" size={36} color="#CBD5E1" />
              <Text style={styles.emptyText}>No shops found in this area.</Text>
              <Text style={styles.emptyHint}>Try increasing the radius.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ShopCard shop={item} onPress={() => handleCardPress(item)} />
          )}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#F0F4F1" },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },

  mapContainer: { height: SCREEN_W * 0.55, backgroundColor: "#E2E8F0" },
  map: { flex: 1 },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },

  radiusCard: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  radiusHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  radiusLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#374151" },
  radiusValue: { fontSize: 14, fontWeight: "700", color: "#064E3B" },
  slider: { width: "100%", height: 36 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between" },
  sliderEdge: { fontSize: 11, color: "#9CA3AF" },

  list: { padding: 16, gap: 12, paddingBottom: 100 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shopName: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1, marginRight: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  address: { color: "#6B7280", fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: "#D97706", fontWeight: "700", fontSize: 13 },
  ratingCount: { color: "#9CA3AF", fontSize: 12 },
  distance: { color: "#6B7280", fontSize: 12 },
  mapsBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "#00D4FF44",
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    alignSelf: "flex-start", backgroundColor: "#0A1628",
  },
  mapsBtnText: { color: "#00D4FF", fontSize: 13, fontWeight: "600" },

  centred: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  loadingText: { color: "#6B7280", fontSize: 13, marginTop: 8 },
  emptyText: { color: "#374151", fontSize: 16, fontWeight: "600" },
  emptyHint: { color: "#9CA3AF", fontSize: 13 },

  errorBox: {
    margin: 20, padding: 20, backgroundColor: "#FEF2F2",
    borderRadius: 16, alignItems: "center", gap: 10,
  },
  errorText: { color: "#DC2626", fontSize: 14, textAlign: "center" },
  retryBtn: {
    backgroundColor: "#064E3B", paddingHorizontal: 24,
    paddingVertical: 10, borderRadius: 10,
  },
  retryBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
