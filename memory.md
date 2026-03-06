# 🧠 PowerSense AI — Project Memory Base

**Status:** Hackathon Ready (March 2026) 🚀  
**Goal:** Track state, architecture, and UI implementations for team onboarding during the Hackathon.

---

## 🗂️ Core Architecture

Full-stack separated application:
- **Backend (Python / FastAPI):** `simulation.py`, `model.py`, `database.py`, `main.py` — serves REST API at `http://localhost:8000/api`
- **Frontend (React / Vite):** React Three Fiber 3D scene + 2D CSS Grid UI — served at `http://localhost:5174`
- **Real-time Sync:** Frontend polls backend every 3 seconds for `rooms`, `predictions`, `energy-usage`, and `stats`

---

## 🏗️ Backend Module Overview

| File | Purpose |
|------|---------|
| `main.py` | FastAPI routing. Endpoints: `/api/rooms`, `/api/simulate`, `/api/override`, `/api/predictions`, `/api/stats`, `/api/energy-usage` |
| `model.py` | RandomForestClassifier predicting `is_occupied` from `[hour, dow, scheduled_class, past_occupancy, wifi_devices]`. Two exports: `predict()` and `predict_30min_ahead()` |
| `simulation.py` | 15-minute time-step engine. Resets to **Monday 09:00** on reset. Applies AI recommendations → `turn_off_all`, `reduce_power`, `keep_power_on`. Calculates kWh, cost, CO₂ saved |
| `database.py` | 8 rooms across Blocks A–D. Constants: `ENERGY_LIGHTS=0.1kW`, `ENERGY_FANS=0.2kW`, `ENERGY_AC=1.5kW`, `COST_PER_KWH=8.0 ₹`, `CO2_PER_KWH=0.82 kg` |
| `data_processor.py` | Generates synthetic historical training data and runs the model training pipeline |

---

## 🔮 Frontend Architecture

### Layout (CSS Grid — 4 zones)
```
┌─────────────────────────────────────────────────────┐
│  ⚡ PowerSense AI │ Time │ AI Status │ Alerts        │  Header (54px)
├──────────┬──────────────────────────────┬────────────┤
│ Controls │                              │  Sectors   │
│ Play/Step│   3D Campus Digital Twin     │  per room  │
│ Timeline │   CampusMap3D.jsx fills all  │  (A101..)  │
│ Stats    │                              │            │
│ Grid Cap │                              │            │
├──────────┴──────────────────────────────┴────────────┤
│ 📊 Live Energy │ 🤖 AI Forecast │ 🔁 Demand Response │  Bottom (168px)
└─────────────────────────────────────────────────────┘
```

### Key Files
| File | Role |
|------|------|
| `App.jsx` | Orchestrator. CSS grid layout. 3s polling. Demand-response engine. Simulation controls |
| `index.css` | Global design tokens. Glassmorphism + neon theme. Grid + panel styles |
| `CampusMap3D.jsx` | Full 3D campus scene (see below) |
| `EnergyDashboard.jsx` | LED equalizer bars per room — real-time kW visualization |
| `AiForecastPanel.jsx` | Power-down countdown + probability bars from `/api/predictions` |
| `ClassroomCard.jsx` | Per-room card in right panel with override toggle |

---

## 🏫 3D Campus Scene (`CampusMap3D.jsx`)

### Campus Layout
```
[NORTH / BACK]
    CommDish (satellite RX, z=-22)
    BatteryBank (z=-4, x=-9.5)    SolarArray (z=-4, x=9.5)

    Block A  Block B  Block C  Block D  (z=-10, back row)
         ═══ Main Road (z=-1) ═══
    Block A  Block B  Block C  Block D  (z=8, front row)

    Microgrid Controller (z=-1, centre)
    PowerHub / Transformer (x=22, right side)

    Parking (x=20, z=16)        (Benches + Trees scattered)

🚩 Flag    [Gate: POWERSENSE CAMPUS]    🚩 Flag
           (z=24, viewer entrance)
[SOUTH / FRONT — VIEWER SIDE]
```

### Scene Components
| Component | Description |
|-----------|-------------|
| `SkyDome` | Blue day sky (#1a75c8), orange dawn, black night. 320 twinkling stars. Sun arc + halo. Moon |
| `Cloud` | 5 fluffy clouds drifting slowly across daytime sky. Hidden at night |
| `StreetLight` | 29 lamp posts. Auto-ON at simHour < 7 or ≥ 18. Warm amber point light |
| `Building` | 3 floors, realistic windows, HVAC, entrance canopy. Power state drives ALL lighting |
| `PowerHub` | Transformer hub at (22,0,-1). Rotating icosahedron core, energy rings, Bezier streams |
| `EnergyStream` | Bezier particle flow from hub to each building. Speed reflects power state |
| `MicrogridController` | Centre kiosk. Shows live total load + efficiency from real-time data |
| `BatteryStorage` | 3-cell bank. Charge% from `stats.total_energy_saved_kwh` |
| `SolarArray` | 5 panels. Generation kW computed from simHour via sin curve |
| `CommTower` | Compact sat-dish on pedestal. 6 sequential red LED ring. Rotating dish |
| `CampusGate` | Entrance arch with 2 pillars, gold "🎓 POWERSENSE CAMPUS" label, gate bars |
| `FlagPole` | Two waving blue flags flanking the gate |
| `WalkingStudent` | 5 animated tiny figures on looped paths between buildings |
| `Bench` | Park benches at campus centre |
| `TinyCar` | 4 parked cars in the parking lot |
| `CampusGround` | Lush grass green (#1a472a), realistic asphalt roads with golden markings, building pads, 12 trees (some with pink/white flowers) |
| `CampusFence` | Solid stone-grey perimeter walls with decorative stripes, support pillars, and 3D entrance signs: "Gitxtribe" & "Geniusphere" |
| `ZoneLabel` | Floating "BLOCK A/B/C/D" between the two building rows |
| `DRLinks` | Dashed demand-response arc in 3D linking rooms suggested for consolidation |

### Power State Logic (CRITICAL)
isPowered = lights_on                 // Strictly tied to actual power state
isWarn    = status === 'predicted_empty_soon' && !override_active
isOff     = !isPowered && !isWarn
```
*Building visuals (glow, beacon, windows) now react correctly to both Force ON and Force OFF overrides.*

Window colors, edge glow, roof beacon → all driven from `isPowered / isWarn / isOff`

### Real-Time Data Flow
- `rooms` prop → `roomMap[id]` → each Building + PowerHub + MicrogridController
- `preds` → `predMap[id]` → Building warning badge, AI countdown chip
- `stats.total_energy_saved_kwh` → BatteryStorage charge %
- `simHour` → SkyDome sky color, sun/moon position, Cloud visibility, StreetLight ON/OFF, SolarArray generation, EnvCtrl ambient intensity

---

## 🐛 Known Watch-Outs

| Issue | Fix |
|-------|-----|
| Faculty Override must keep building LIT | `isPowered = is_occupied \|\| override_active` in `getPowerState()` |
| Reset must go to Monday not Saturday | `monday = now - timedelta(days=now.weekday())` in `simulation.py` |
| Street lights auto time | `isNight = simHour < 7 \|\| simHour >= 18` in `StreetLight` component |
| Energy dashboard fill in bottom bar | `height: '100%'` + `display: flex; flex-direction: column; min-height: 0` |
| Git push blocked | GitHub account `pavankumarofficial1231` needs to fork `Sathvik-Nagesh/Power-sense-ai` first |

---

## 📝 Day 2 Roadmap

1. ~~CSS Grid Layout (Done ✅)~~
2. ~~Realistic 3D Buildings with power-state lighting (Done ✅)~~
3. ~~Day/Night sky with stars, sun, moon, clouds (Done ✅)~~
4. ~~Street lights auto ON/OFF by time (Done ✅)~~
5. ~~Campus Entrance Gate + Flag Poles (Done ✅)~~
6. ~~Demand Response Engine (Done ✅)~~
7. ~~Reset → Monday 09:00 fix (Done ✅)~~
8. ~~Campus Aesthetics: Solid stone walls, lush grass floor, and flowering trees (Done ✅)~~
9. ~~Faculty Override ON/OFF mechanism with red beacon feedback (Done ✅)~~
10. **Push to GitHub** — Fork repo, then `git push origin feature/rebuilt-campus-ui`
9. **Hardware Integration (Optional):** Connect Arduino ESP8266 to POST real Wi-Fi ping counts to `/api/override` or a new `/api/sensor` endpoint
10. **Mobile Responsive:** Add breakpoints to `index.css` for iPad display at demo booth
