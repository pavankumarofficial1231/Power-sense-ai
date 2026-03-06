"""
PowerSense AI — Simulation Engine
Manages time-accelerated occupancy simulation with realistic patterns.
"""

import random
import math
from datetime import datetime, timedelta
from database import get_connection, ROOMS, ENERGY_LIGHTS, ENERGY_FANS, ENERGY_AC, COST_PER_KWH, CO2_PER_KWH
from model import predict, predict_30min_ahead
from typing import cast, Optional


class SimulationEngine:
    def __init__(self):
        # Always simulate a weekday (Monday 9am) so campus is busy for demos
        now = datetime.now()
        # Find most recent Monday (weekday 0), or keep today if Mon-Fri
        days_since_monday = now.weekday() if now.weekday() < 5 else 0
        monday = now - timedelta(days=days_since_monday)
        self.current_time = monday.replace(hour=9, minute=0, second=0, microsecond=0)
        self.is_running = False
        self.speed = 1  # 1x, 2x, 4x
        self.step_minutes = 15
        self.total_energy_saved = 0.0
        self.total_cost_saved = 0.0
        self.total_co2_reduced = 0.0
        self.room_states = {}
        self._initialize_states()

    def _initialize_states(self):
        """Initialize room states."""
        for room in ROOMS:
            self.room_states[room["id"]] = {
                "is_occupied": False,
                "occupancy_pct": 0.0,
                "predicted_occupancy": 0.0,
                "predicted_30min": 0.0,
                "status": "empty",
                "lights_on": True,
                "ac_on": True,
                "fans_on": True,
                "override_active": False,
                "override_by": None,
                "current_power_kw": room["base_consumption"],
                "wifi_devices": 0,
                "scheduled_class": False,
                "student_count": 0,
                "energy_saved_kwh": 0.0,
            }

    def step(self):
        """Advance simulation by one step, respecting speed multiplier."""
        self.current_time += timedelta(minutes=self.step_minutes * self.speed)

        # Wrap around to next day if past midnight
        if self.current_time.hour == 0 and self.current_time.minute == 0:
            pass  # natural progression

        hour = self.current_time.hour
        dow = self.current_time.weekday()

        for room in ROOMS:
            rid = room["id"]
            state = self.room_states[rid]

            # Generate realistic occupancy based on time
            scheduled = self._is_class_scheduled(rid, hour, dow)
            state["scheduled_class"] = scheduled

            # Simulate WiFi devices
            if scheduled and 8 <= hour <= 18 and dow < 5:
                wifi = random.randint(int(room["capacity"] * 0.4), int(room["capacity"] * 0.85))
            elif 8 <= hour <= 18 and dow < 5:
                wifi = random.randint(0, int(room["capacity"] * 0.3))
            else:
                wifi = random.randint(0, 3)

            state["wifi_devices"] = wifi

            # Past occupancy from previous state
            past_occ = state["occupancy_pct"]

            # Get AI predictions
            pred_now = predict(hour, dow, int(scheduled), past_occ, wifi)
            pred_30 = predict_30min_ahead(hour, dow, int(scheduled), past_occ, wifi)

            state["predicted_occupancy"] = round(pred_now, 3)
            state["predicted_30min"] = round(pred_30, 3)

            # Determine actual occupancy (simulation truth)
            is_occ = pred_now > 0.5  # use prediction as ground truth for simulation
            state["is_occupied"] = is_occ
            state["occupancy_pct"] = round(pred_now, 2)
            state["student_count"] = int(room["capacity"] * pred_now) if is_occ else random.randint(0, 2)

            # Determine status color
            if is_occ:
                if pred_30 < 0.3:
                    state["status"] = "predicted_empty_soon"  # yellow
                else:
                    state["status"] = "occupied"  # green
            else:
                state["status"] = "empty"  # red

            # Energy optimization (unless override is active)
            if not state["override_active"]:
                if pred_now < 0.2:
                    # Low occupancy → turn off everything
                    self._apply_savings(state, room, lights=False, ac=False, fans=False)
                elif pred_now < 0.5:
                    # Medium → keep lights, turn off AC
                    self._apply_savings(state, room, lights=True, ac=False, fans=True)
                else:
                    # Occupied → everything on
                    state["lights_on"] = True
                    state["ac_on"] = True
                    state["fans_on"] = True
                    state["current_power_kw"] = round(
                        room["base_consumption"] + ENERGY_LIGHTS + ENERGY_FANS + ENERGY_AC, 2
                    )
            else:
                # Override is active — keep everything on
                state["lights_on"] = True
                state["ac_on"] = True
                state["fans_on"] = True
                state["current_power_kw"] = round(
                    room["base_consumption"] + ENERGY_LIGHTS + ENERGY_FANS + ENERGY_AC, 2
                )

            # Calculate energy recommendation
            recommendation = self._get_recommendation(state)
            state["recommendation"] = recommendation

    def _apply_savings(self, state, room, lights, ac, fans):
        """Apply energy optimization and calculate savings."""
        prev_power = room["base_consumption"] + ENERGY_LIGHTS + ENERGY_FANS + ENERGY_AC
        new_power = room["base_consumption"]

        state["lights_on"] = lights
        state["ac_on"] = ac
        state["fans_on"] = fans

        if lights:
            new_power += ENERGY_LIGHTS
        if ac:
            new_power += ENERGY_AC
        if fans:
            new_power += ENERGY_FANS

        state["current_power_kw"] = round(new_power, 2)

        # Calculate savings for this timestep (kWh for 15-min interval)
        saved_kw = prev_power - new_power
        saved_kwh = saved_kw * (self.step_minutes / 60.0)

        if saved_kwh > 0:
            state["energy_saved_kwh"] = round(state.get("energy_saved_kwh", 0) + saved_kwh, 3)
            self.total_energy_saved += saved_kwh
            self.total_cost_saved += saved_kwh * COST_PER_KWH
            self.total_co2_reduced += saved_kwh * CO2_PER_KWH

    def _is_class_scheduled(self, room_id, hour, dow):
        """Simulate class schedule — deterministic per room."""
        schedules = {
            "A101": [(8, 10), (11, 13), (14, 16)],
            "A202": [(9, 11), (13, 15)],
            "B101": [(8, 10), (10, 12), (14, 17)],
            "B203": [(10, 12), (15, 17)],
            "C101": [(9, 12), (14, 16)],
            "C202": [(8, 10), (13, 16)],
            "D101": [(9, 11), (11, 13), (15, 17)],
            "D302": [(10, 12), (14, 16)],
        }

        if dow >= 5:  # Weekend
            return False

        room_sched = schedules.get(room_id, [])
        return any(start <= hour < end for start, end in room_sched)

    def _get_recommendation(self, state):
        """Get energy recommendation string."""
        if state["override_active"]:
            return "manual_override"
        if state["predicted_occupancy"] < 0.2:
            return "turn_off_all"
        elif state["predicted_occupancy"] < 0.5:
            return "reduce_power"
        else:
            return "keep_power_on"

    def set_override(self, room_id: str, active: bool, override_by: Optional[str] = "Faculty") -> bool:
        """Set manual override for a room."""
        if room_id in self.room_states:
            self.room_states[room_id]["override_active"] = active
            self.room_states[room_id]["override_by"] = override_by if active else None
            if active:
                self.room_states[room_id]["lights_on"] = True
                self.room_states[room_id]["ac_on"] = True
                self.room_states[room_id]["fans_on"] = True
            return True
        return False

    def get_state(self):
        """Get complete simulation state."""
        return {
            "current_time": self.current_time.isoformat(),
            "is_running": self.is_running,
            "speed": self.speed,
            "rooms": {rid: {**state} for rid, state in self.room_states.items()},
            "stats": {
                "total_energy_saved_kwh": round(self.total_energy_saved, 2),
                "total_cost_saved": round(self.total_cost_saved, 2),
                "total_co2_reduced_kg": round(self.total_co2_reduced, 2),
                "rooms_optimized": sum(
                    1 for s in self.room_states.values()
                    if s["status"] == "empty" and not s["override_active"]
                ),
                "total_rooms": len(ROOMS),
            },
        }

    def get_predictions(self):
        """Get predictions in the requested format."""
        predictions = []
        for room in ROOMS:
            rid = room["id"]
            state = self.room_states[rid]

            # Derive how many minutes until predicted empty.
            # If currently occupied and 30-min pred drops below 0.3 → ~30 min away.
            # If currently occupied and now pred already low → ~10 min away.
            # Otherwise no upcoming power-down expected.
            raw_pred_now = state.get("predicted_occupancy", 0.0)
            pred_now = float(cast(float, raw_pred_now))
            
            raw_pred_30 = state.get("predicted_30min", 0.0)
            pred_30 = float(cast(float, raw_pred_30))
            
            is_occ = bool(cast(bool, state.get("is_occupied", False)))

            if is_occ and pred_30 < 0.3 and pred_now >= 0.3:
                # Interpolate: how far between "now" and "30 min" does it cross 0.3?
                # Linear interpolation gives minutes to crossing
                frac = (pred_now - 0.3) / max(pred_now - pred_30, 0.01)
                predicted_empty_minutes = round(frac * 30)
                prediction_probability = round(float(1.0 - pred_30), 2)
            elif is_occ and pred_now < 0.3:
                predicted_empty_minutes = 5   # already almost there
                prediction_probability = round(float(1.0 - pred_now), 2)
            else:
                predicted_empty_minutes = None
                prediction_probability = round(float(pred_now), 2)

            predictions.append({
                "room": rid,
                "room_name": room["name"],
                "predicted_occupancy": pred_now,
                "predicted_occupancy_30min": pred_30,
                "status": state["status"],
                "recommendation": state.get("recommendation", "keep_power_on"),
                "student_count": state["student_count"],
                "wifi_devices": state["wifi_devices"],
                "predicted_empty_minutes": predicted_empty_minutes,
                "prediction_probability": prediction_probability,
            })
        return predictions

    def get_energy_usage(self):
        """Get energy usage per room."""
        usage = []
        for room in ROOMS:
            rid = room["id"]
            state = self.room_states[rid]
            full_power = room["base_consumption"] + ENERGY_LIGHTS + ENERGY_FANS + ENERGY_AC
            usage.append({
                "room": rid,
                "room_name": room["name"],
                "current_power_kw": state["current_power_kw"],
                "max_power_kw": round(full_power, 2),
                "efficiency_pct": round((1 - state["current_power_kw"] / full_power) * 100, 1)
                    if full_power > 0 else 0,
                "lights_on": state["lights_on"],
                "ac_on": state["ac_on"],
                "fans_on": state["fans_on"],
                "energy_saved_kwh": state["energy_saved_kwh"],
                "override_active": state["override_active"],
            })
        return usage


# Global simulation instance
simulation = SimulationEngine()
