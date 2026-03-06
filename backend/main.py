"""
PowerSense AI — FastAPI Backend Server
REST API for campus energy optimization system.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os

from database import ROOMS, init_db, COST_PER_KWH, CO2_PER_KWH
from simulation import simulation

# Ensure DB exists
if not os.path.exists(os.path.join(os.path.dirname(__file__), "powersense.db")):
    init_db()

# Ensure model exists — train if needed
model_path = os.path.join(os.path.dirname(__file__), "occupancy_model.joblib")
if not os.path.exists(model_path):
    print("Model not found — running data processor and training...")
    from data_processor import process_all
    process_all()
    from model import train_model
    train_model()

app = FastAPI(
    title="PowerSense AI",
    description="Campus electricity optimization using AI occupancy prediction",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize simulation with first step
simulation.step()


# --- Pydantic Models ---

class OverrideRequest(BaseModel):
    room_id: str
    active: bool
    override_by: Optional[str] = "Faculty"


class SimulationControl(BaseModel):
    action: str  # "play", "pause", "step", "reset", "set_time"
    speed: Optional[int] = 1
    time_iso: Optional[str] = None
    hour: Optional[int] = None


# --- API Endpoints ---

@app.get("/api/rooms")
def get_rooms():
    """Get all rooms with current status."""
    state = simulation.get_state()
    rooms = []
    for room in ROOMS:
        rid = room["id"]
        rs = state["rooms"][rid]
        rooms.append({
            "id": room["id"],
            "name": room["name"],
            "building": room["building"],
            "floor": room["floor"],
            "capacity": room["capacity"],
            "base_consumption": room["base_consumption"],
            "is_occupied": rs["is_occupied"],
            "occupancy_pct": rs["occupancy_pct"],
            "status": rs["status"],
            "student_count": rs["student_count"],
            "lights_on": rs["lights_on"],
            "ac_on": rs["ac_on"],
            "fans_on": rs["fans_on"],
            "override_active": rs["override_active"],
            "override_by": rs["override_by"],
            "current_power_kw": rs["current_power_kw"],
        })
    return {"rooms": rooms, "current_time": state["current_time"]}


@app.get("/api/predictions")
def get_predictions():
    """Get occupancy predictions for all rooms."""
    return {
        "predictions": simulation.get_predictions(),
        "current_time": simulation.current_time.isoformat(),
    }


@app.get("/api/energy-usage")
def get_energy_usage():
    """Get per-room energy consumption and savings."""
    return {
        "energy_usage": simulation.get_energy_usage(),
        "current_time": simulation.current_time.isoformat(),
    }


@app.get("/api/stats")
def get_stats():
    """Get aggregate energy savings statistics."""
    state = simulation.get_state()
    return {
        "stats": state["stats"],
        "current_time": state["current_time"],
    }


@app.post("/api/simulate")
def simulate_step(control: Optional[SimulationControl] = None):
    """Advance simulation or control playback."""
    if control:
        # Apply speed first so subsequent step() uses new multiplier
        if control.speed:
            simulation.speed = control.speed

        if control.action == "step":
            simulation.step()
        elif control.action == "play":
            simulation.is_running = True
            simulation.step()
        elif control.action == "pause":
            simulation.is_running = False
        elif control.action == "reset":
            simulation.__init__()
        elif control.action == "set_time":
            old_speed = simulation.speed
            simulation.speed = 1  # scrub exactly 1 step worth
            if control.hour is not None:
                simulation.current_time = simulation.current_time.replace(hour=control.hour, minute=0, second=0)
            elif control.time_iso:
                from datetime import datetime
                simulation.current_time = datetime.fromisoformat(control.time_iso)
            simulation.step()
            simulation.speed = old_speed  # restore
    else:
        simulation.step()

    return simulation.get_state()


@app.get("/api/simulation-state")
def get_simulation_state():
    """Get current simulation state (for polling)."""
    return simulation.get_state()


@app.post("/api/override")
def set_override(req: OverrideRequest):
    """Set manual faculty override for a room."""
    success = simulation.set_override(req.room_id, req.active, req.override_by)
    if not success:
        raise HTTPException(status_code=404, detail=f"Room {req.room_id} not found")
    return {
        "success": True,
        "room_id": req.room_id,
        "override_active": req.active,
        "override_by": req.override_by if req.active else None,
    }


@app.get("/api/model-info")
def get_model_info():
    """Get information about the AI model."""
    return {
        "model_type": "RandomForestClassifier",
        "features": ["hour", "day_of_week", "scheduled_class", "past_occupancy", "wifi_devices"],
        "target": "is_occupied",
        "n_estimators": 100,
        "max_depth": 12,
        "energy_model": {
            "lights_kw": 0.1,
            "fans_kw": 0.2,
            "ac_kw": 1.5,
            "cost_per_kwh": COST_PER_KWH,
            "co2_per_kwh": CO2_PER_KWH,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
