// shims/react-native-gesture-handler.js
// Minimal web stub for react-native-gesture-handler.
// The library's native module tries to use DeviceEventEmitter which doesn't exist on web.

'use strict';

const React = require('react');
const { View, ScrollView, FlatList, TouchableOpacity,
        TouchableHighlight, TouchableWithoutFeedback } = require('react-native');

// Passthrough wrapper that just renders its children
const Passthrough = ({ children, style, ...rest }) =>
  React.createElement(View, { style, ...rest }, children);

module.exports = {
  GestureHandlerRootView: ({ children, style }) =>
    React.createElement(View, { style: [{ flex: 1 }, style] }, children),
  PanGestureHandler: Passthrough,
  TapGestureHandler: Passthrough,
  LongPressGestureHandler: Passthrough,
  PinchGestureHandler: Passthrough,
  RotationGestureHandler: Passthrough,
  FlingGestureHandler: Passthrough,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  RawButton: TouchableOpacity,
  BaseButton: TouchableOpacity,
  RectButton: TouchableOpacity,
  BorderlessButton: TouchableOpacity,
  Swipeable: Passthrough,
  DrawerLayout: Passthrough,
  State: {
    UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3,
    ACTIVE: 4, END: 5,
  },
  Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
  gestureHandlerRootHOC: (Component) => Component,
  Gesture: {
    Pan: () => ({ onUpdate: () => ({}), onEnd: () => ({}) }),
    Tap: () => ({ onEnd: () => ({}) }),
    Simultaneous: () => ({}),
  },
  GestureDetector: Passthrough,
};
