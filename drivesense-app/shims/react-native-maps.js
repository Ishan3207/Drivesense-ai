// shims/react-native-maps.js
// Web stub for react-native-maps — returns no-op components so the Map tab
// doesn't crash the bundler or runtime on web (UIManager doesn't exist on web).

import React from 'react';
import { View, Text } from 'react-native';

const Stub = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#6B7280' }}>Map unavailable on web</Text>
  </View>
);

export default Stub;
export const Marker = Stub;
export const Callout = Stub;
export const Circle = Stub;
export const Polygon = Stub;
export const Polyline = Stub;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;
