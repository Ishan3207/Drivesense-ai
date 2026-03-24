# System Architecture: DriveSense AI

## Overview
DriveSense AI is a full-stack telemetry and diagnostic simulation platform designed to mimic real-world interactions between an automotive Electronic Control Unit (ECU) and a client application (such as a dashboard display or a mechanic's diagnostic tool).

The application is split into two primary components:

1. **The Backend ECU Simulator (Python/FastAPI)**
2. **The Frontend Mobile Dashboard (React Native/Expo)**

---

## 1. Backend Simulator (`drivesense-backend`)
The backend is a lightweight HTTP and WebSocket server built with FastAPI. It maintains the simulated state of a vehicle's ECU.

- **Technology Stack:** Python 3.12, FastAPI, Uvicorn, WebSockets.
- **State Engine:** The `TelemetryEngine` (`engine.py`) runs an asynchronous simulation loop that updates vehicle parameters (Speed, RPM, Throttle, Fuel, Temperatures) based on a configured "Driving Mode" (e.g., accelerating, braking, cruising, idling).
- **REST API (`/api/v1/mock/control`)**: The frontend uses this endpoint to manually override simulation values, change driving modes, inject specific OBD-II Diagnostic Trouble Codes (DTCs), or clear the fault memory.
- **WebSocket Server (`/ws/telemetry`)**: Broadcasts the live vehicle state to all connected clients at 10Hz (every 100ms), ensuring high-fidelity real-time dashboard updates.

---

## 2. Frontend Dashboard (`drivesense-app`)
The frontend is a React Native mobile application, stylized with a modern "Bento Box" Sage Green design system. It visualizes the telemetry data and provides an interface to control the simulation and analyze faults.

- **Technology Stack:** React Native, Expo Router, Zustand (State Management), React Native Reanimated (Animations).
- **State Management (`useDriveStore.ts`)**: Zustand handles real-time telemetry ingestion from the WebSocket connection, managing the global application state and caching diagnostic reports.
- **WebSocket Client:** Connects to the backend simulation on mount and continuously updates the global store.
- **AI Diagnostics (`api.ts`)**: Integrates with a mock (or live) AI agent to analyze active DTCs, returning consumer-friendly explanations, severity assessments, and DIY repair difficulty ratings based on the current context.

---

## Data Flow
1. User adjusts simulation parameters on the **Simulator Screen** via REST `POST`.
2. The Backend acknowledges the change and updates the `TelemetryEngine` state.
3. The `TelemetryEngine`'s tick loop generates new realistic values based on the input.
4. The WebSocket server broadcasts the new state.
5. `useDriveStore` receives the WebSocket message and updates the UI instantly across all screens.
