import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Linking, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { fetchNearbyShops } from "@/services/api";

interface ShopResult {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  user_ratings_total?: number;
  distance_km?: number;
  open_now?: boolean;
  maps_url: string;
}

function ShopCard({ shop }: { shop: ShopResult }) {
  const openMaps = () => Linking.openURL(shop.maps_url);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.shopName}>{shop.name}</Text>
        {shop.open_now !== undefined && (
          <View style={[styles.statusBadge, { backgroundColor: shop.open_now ? "#00E87B22" : "#FF475722" }]}>
            <Text style={[styles.statusText, { color: shop.open_now ? "#00E87B" : "#FF4757" }]}>
              {shop.open_now ? "Open" : "Closed"}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.address}>{shop.address}</Text>
      <View style={styles.metaRow}>
        {shop.rating && (
          <View style={styles.rating}>
            <Ionicons name="star" size={13} color="#FFB800" />
            <Text style={styles.ratingText}>{shop.rating.toFixed(1)}</Text>
            {shop.user_ratings_total && (
              <Text style={styles.ratingCount}>({shop.user_ratings_total})</Text>
            )}
          </View>
        )}
        {shop.distance_km && (
          <Text style={styles.distance}>{shop.distance_km.toFixed(1)} km away</Text>
        )}
      </View>
      <TouchableOpacity style={styles.mapsBtn} onPress={openMaps}>
        <Ionicons name="navigate" size={14} color="#00D4FF" />
        <Text style={styles.mapsBtnText}>Open in Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MapScreen() {
  const [shops, setShops] = useState<ShopResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Use mock coordinates (San Francisco) for demonstration
    fetchNearbyShops(37.7749, -122.4194)
      .then(setShops)
      .catch(() => setError("Could not fetch nearby shops"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <LinearGradient colors={["#0D1117", "#0A1628", "#0D1117"]} style={styles.bg}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Fix</Text>
        <Text style={styles.subtitle}>Top-rated auto repair shops near you</Text>
      </View>

      {loading && <ActivityIndicator color="#00D4FF" style={{ marginTop: 40 }} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && !error && (
        <FlatList
          data={shops}
          keyExtractor={(s) => s.place_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ShopCard shop={item} />}
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
  list: { padding: 20, gap: 12 },
  card: { backgroundColor: "#0F1923", borderRadius: 18, borderWidth: 1, borderColor: "#1A2332", padding: 18, gap: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shopName: { fontSize: 16, fontWeight: "700", color: "#E8F0FE", flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  address: { color: "#7C8FA6", fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: "#FFB800", fontWeight: "700", fontSize: 13 },
  ratingCount: { color: "#4A5568", fontSize: 12 },
  distance: { color: "#7C8FA6", fontSize: 12 },
  mapsBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#00D4FF33", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "flex-start" },
  mapsBtnText: { color: "#00D4FF", fontSize: 13, fontWeight: "600" },
  errorText: { color: "#FF4757", textAlign: "center", marginTop: 40, fontSize: 14 },
});
