# Using the Telemetry Simulator

The DriveSense AI app relies heavily on its companion backend: the Electronic Control Unit (ECU) Simulator. This guide explains how to operate it, either directly from the Mobile App or manually via API calls.

## Changing Simulation Values via the App
The easiest way to control the simulation is via the **"Simulate"** tab in the mobile app.

1. **Driving Modes**: Tap `IDLE`, `ACCEL`, `CRUISE`, or `BRAKE` to instruct the backend engine. The backend will naturally transition the RPM, speed, and gear according to basic physical models based on the selected mode.
2. **Manual Overrides**: Drag the sliders for `Speed`, `RPM`, or `Throttle`. Upon releasing the slider, the app sends a `POST /api/v1/mock/control` request to the backend. The backend `TelemetryEngine` immediately adopts the new target value and smoothly lerps to it over the next few frames.

## Changing Values via Swagger (API Docs)
You can directly interact with the backend server via its Swagger UI:
1. Ensure the Python backend is running via `npm run dev` or `python main.py`.
2. Open your browser and navigate to: `http://localhost:8000/docs`
3. Expand **POST /api/v1/mock/control**.
4. Click **Try it out** and enter a JSON body:
   ```json
   {
     "speed_kmh": 120,
     "rpm": 3000,
     "mode": "cruising",
     "inject_dtc": "P0301"
   }
   ```
5. Click **Execute**. The Mobile App dashboard will instantly reflect the changes within 100ms.

## Injecting Faults (DTCs)
You can mock an engine light coming on by injecting faults:
1. In the **Simulator** tab in the app, select a code from the "FAULT CODES" list.
2. Tap **INJECT**.
3. The dashboard will immediately show a warning alert, and the **Diagnostics** tab will populate with the new active fault.
4. To clear all mock faults, tap **CLEAR**.
