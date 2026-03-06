# 🧠 PowerSense AI — Project Memory Base

**Status:** Hackathon Ready (March 2026) 🚀
**Goal:** Track state, architecture, and UI implementations for team onboarding during the Hackathon.

## 🗂️ Core Architecture

The system is a separated full-stack application.
- **Backend (Python / FastAPI):** Handles the database (`hospitality_db.sqlite`), simulation engine (`simulation.py`), and machine learning model (`model.py`).
- **Frontend (React / Vite):** Handles the massive interactive UI (`react-three-fiber` + `three.js`), calling the backend API every tick based on simulation speed.

---

## 🏗️ Backend Module Overview

1. `main.py`
   - FastAPI server instance and API routing.
   - Hosts endpoints that read simulation states (`GET`) or control simulation time blocks (`POST`).
   
2. `model.py`
   - Scikit-Learn RandomForest implementation.
   - **Trained on Dataset:** Uses `campus_energy_data.csv` (historical energy/occupancy logs) to fit the model so it learns real-world student behaviors.
   - Features: `[hour, day_of_week, scheduled_class, past_occupancy, wifi_devices]`.
   - Has two main functions: `predict()` and `predict_30min_ahead()`.
   
3. `simulation.py`
   - Central state manager simulating the passage of time over a 15-minute resolution timeline.
   - Applies the AI's recommendations (`Keep Power On`, `Reduce Power`, `Turn Off All`) and dynamically calculates kWh saved based on fixed constants (`ENERGY_AC=1.5kW`, `ENERGY_LIGHTS=0.4kW`).

4. `database.py`
   - SQLite table definitions and fake initial seed data representing campus classrooms.

---

## 🔮 Frontend Visualization Overview

The frontend was massively overhauled into an Iron Man style **Holographic 3D Command Area**.

**Core Files:**
- `App.jsx`
  - The orchestrator. Contains the `Canvas` background wrapper (`.canvas-wrapper`) and floating UI flex overlay (`.ui-overlay`). 
  - Manages fetching API data, controlling simulation (`set_time`, `speed`), and tracking hover/click events for UI interaction on the 3D map.
- `index.css`
  - Deep dark UI tokens with extensive CSS variables for neon glassmorphism effects (`--bg-base`, `--bg-card`, `--glow-cyan`).
  - Contains `.bolo-tag` popups, `.ui-left` absolute layout constraints, and the custom `.scrubber-track` for timeline jumping.
- `components/CampusMap3D.jsx`
  - A React Three Fiber (`R3F`) 3D Scene.
  - Generates the mesh building blocks, glowing energy floor mesh, pulsating Power Core globe, and the animated energy lines.
  - Uses `@react-three/drei`'s `<Html />` component for anchored 2D popups overlaid inside 3D space.
- `components/EnergyDashboard.jsx`
  - React/CSS-based custom LED equalizer UI component visualising power consumption per grid room dynamically via neon blocks.
- `components/EnergyHeatmap.jsx`
  - Two modes: Live **Efficiency Heatmap** (which accurately calculates UI efficiency as `% power saved versus maximum possible draw`) and a **Busy Time** schedule block overview.
- `components/ClassroomCard.jsx`
  - Complex dynamic cards found in the right-side grid overlay (Campus Sectors list).
  - Conditionally renders inner UI elements like `<WifiSignal />` mini-bars, toggleable `Manual Overrides`, and live multi-colored recommendation tags.

---

## 🪲 Known Hacks / Watch-Outs

- **Faculty Overrides in R3F (`CampusMap3D.jsx`):** 
  Energy streams initially checked `status === 'occupied'`, but now explicitly check `room?.override_active`. If adding new statuses (e.g., `maintenance_mode`), update the boolean check there.
- **Layout Overlaps (`index.css`):**
  Initially, `.ui-header` and `.ui-charts` were absolutely grouped in corners, causing overlaps on short screens. They are now placed relative within a `pointer-events: none` `.ui-left` flex container with `justify-content: space-between` to always prevent grid crashes. Both are assigned `pointer-events: auto` explicitly. 
- **Time Sync (`Simulate API`):**
  When dragging the timeline scrubber in `App.jsx`, a `set_time` POST action sends the current `{"hour": 14}` to the backend `simulation.py` clock manually, allowing instant frontend/backend timeline scrubbing without timezone bugs.

---

## 📝 Roadmap for Day 2 Team

1. ~~**Interactive Scrubber** (Built!)~~
2. ~~**Better Chart** (Replaced standard D3 solid bars with CSS LED glow Equalizers!)~~
3. ~~**Floating Tags** (Built via R3F Drei tags inside `CampusMap3D`!)~~
4. **Hardware Integrations (Optional):** We can connect an Arduino ESP8266 or similar to POST actual Wi-Fi ping counts to the backend rather than simulating `wifi_devices`, dramatically stepping this up for the judges!
5. **Dashboard Animations:** Trigger GSAP transitions linking the room sector clicks to the React Three Fiber Camera coordinates (Camera smooth-fly action).
