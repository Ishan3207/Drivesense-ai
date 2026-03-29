// shims/RCTDeviceEventEmitter.js
// Stub for RCTDeviceEventEmitter on web.
// DevLoadingView.js inside react-native-web calls addListener on this emitter.
'use strict';
module.exports = {
  default: {
    addListener: () => ({ remove: () => {} }),
    removeAllListeners: () => {},
    removeSubscription: () => {},
    emit: () => {},
  },
  addListener: () => ({ remove: () => {} }),
  removeAllListeners: () => {},
  emit: () => {},
};
