/**
 * Mock geofence zones for local development.
 * These mirror the backend seed data so the frontend can
 * check zones without a network call during testing.
 */

export interface MockZone {
  id: string;
  name: string;
  zone_type: "school" | "hospital" | "residential" | "custom";
  latitude: number;
  longitude: number;
  radius_meters: number;
  speed_limit_kmh: number;
}

export const MOCK_ZONES: MockZone[] = [
  {
    id: "zone-001",
    name: "Lincoln Elementary School",
    zone_type: "school",
    latitude: 37.7749,
    longitude: -122.4194,
    radius_meters: 300,
    speed_limit_kmh: 25,
  },
  {
    id: "zone-002",
    name: "St. Mary's Hospital",
    zone_type: "hospital",
    latitude: 37.7765,
    longitude: -122.4172,
    radius_meters: 250,
    speed_limit_kmh: 30,
  },
  {
    id: "zone-003",
    name: "Sunrise Residential Area",
    zone_type: "residential",
    latitude: 37.7735,
    longitude: -122.4210,
    radius_meters: 500,
    speed_limit_kmh: 40,
  },
];
