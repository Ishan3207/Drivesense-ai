// metro.config.js
// Fixes "Unable to resolve" cascade errors when Expo web bundles react-native 0.74.
// Stubs out native-only packages that crash the browser at import/runtime.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const RN_PKG = path.join("node_modules", "react-native");

const PLATFORM_WEB = path.resolve(
  __dirname,
  "node_modules/react-native-web/dist/exports/Platform/index.js"
);
const EMPTY_SHIM = path.resolve(__dirname, "shims/empty.js");
const RN_MAPS_STUB = path.resolve(__dirname, "shims/react-native-maps.js");
const GESTURE_STUB = path.resolve(__dirname, "shims/react-native-gesture-handler.js");

const originalResolver = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    // ── Package-level stubs ───────────────────────────────────────────────────

    if (moduleName === "react-native-maps" || moduleName.startsWith("react-native-maps/")) {
      return { filePath: RN_MAPS_STUB, type: "sourceFile" };
    }

    if (moduleName === "react-native-gesture-handler" || moduleName.startsWith("react-native-gesture-handler/")) {
      return { filePath: GESTURE_STUB, type: "sourceFile" };
    }

    // Native-only Expo packages: crash on web at import time
    if (
      moduleName === "expo-task-manager" || moduleName.startsWith("expo-task-manager/") ||
      moduleName === "expo-notifications"  || moduleName.startsWith("expo-notifications/") ||
      moduleName === "expo-location"       || moduleName.startsWith("expo-location/")
    ) {
      return { filePath: EMPTY_SHIM, type: "sourceFile" };
    }

    // Stub RCTDeviceEventEmitter — used by DevLoadingView.js at init time
    if (moduleName.includes("RCTDeviceEventEmitter") || moduleName.includes("DeviceEventEmitter")) {
      return {
        filePath: path.resolve(__dirname, "shims/RCTDeviceEventEmitter.js"),
        type: "sourceFile",
      };
    }

    // ── react-native internals: fix native-only relative imports ─────────────

    if (context.originModulePath.includes(RN_PKG)) {
      // Platform shim (any depth)
      if (
        moduleName === "./Platform" ||
        moduleName.includes("/Utilities/Platform") ||
        moduleName.includes("Utilities/Platform")
      ) {
        return { filePath: PLATFORM_WEB, type: "sourceFile" };
      }

      // Native bridge stubs: RCT*, NativeModule*, NativeComponent*, legacySend*
      if (
        /[./]RCT[A-Z]/.test(moduleName) ||
        /legacySend/.test(moduleName)         ||
        /NativeModule/.test(moduleName)       ||
        /NativeComponent/.test(moduleName)    ||
        /NativeExceptionsManager/.test(moduleName)
      ) {
        return { filePath: EMPTY_SHIM, type: "sourceFile" };
      }
    }
  }

  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
