// shims/ReactNativePrivateStub.js
// Web-compatible shim for ReactNativePrivateInterface.js
// Used by metro.config.js to prevent broken native-only relative imports
// from crashing the web bundler.

'use strict';

// Re-export Platform from react-native-web
const { Platform } = require('react-native-web/dist/index');

module.exports = {
  Platform,
  // Stub out everything else used by React Native renderer internals
  ReactNativePrivateInterface: {},
};
