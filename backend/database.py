"""
PowerSense AI — Database module
SQLite database for rooms, readings, predictions, and energy savings.
"""

import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "powersense.db")

ROOMS = [
    {"id": "A101", "name": "Lecture Hall A101", "building": "Block A", "floor": 1, "capacity": 60, "base_consumption": 0.35},
    {"id": "A202", "name": "Lab A202", "building": "Block A", "floor": 2, "capacity": 40, "base_consumption": 0.45},
    {"id": "B101", "name": "Lecture Hall B101", "building": "Block B", "floor": 1, "capacity": 80, "base_consumption": 0.30},
    {"id": "B203", "name": "Seminar B203", "building": "Block B", "floor": 2, "capacity": 30, "base_consumption": 0.25},
    {"id": "C101", "name": "Auditorium C101", "building": "Block C", "floor": 1, "capacity": 120, "base_consumption": 0.50},
    {"id": "C202", "name": "Lab C202", "building": "Block C", "floor": 2, "capacity": 35, "base_consumption": 0.40},
    {"id": "D101", "name": "Classroom D101", "building": "Block D", "floor": 1, "capacity": 50, "base_consumption": 0.28},
    {"id": "D302", "name": "Smart Room D302", "building": "Block D", "floor": 3, "capacity": 25, "base_consumption": 0.22},
]

# Energy model constants (kW)
ENERGY_LIGHTS = 0.1
ENERGY_FANS = 0.2
ENERGY_AC = 1.5
COST_PER_KWH = 8.0  # ₹ per kWh
CO2_PER_KWH = 0.82  # kg CO2 per kWh


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            building TEXT NOT NULL,
            floor INTEGER NOT NULL,
            capacity INTEGER NOT NULL,
            base_consumption REAL NOT NULL,
            is_occupied INTEGER DEFAULT 0,
            current_occupancy REAL DEFAULT 0.0,
            lights_on INTEGER DEFAULT 1,
            ac_on INTEGER DEFAULT 1,
            fans_on INTEGER DEFAULT 1,
            override_active INTEGER DEFAULT 0,
            override_by TEXT DEFAULT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            hour INTEGER NOT NULL,
            day_of_week INTEGER NOT NULL,
            global_active_power REAL,
            voltage REAL,
            intensity REAL,
            sub_metering_1 REAL,
            sub_metering_2 REAL,
            sub_metering_3 REAL,
            is_occupied INTEGER NOT NULL,
            wifi_devices INTEGER DEFAULT 0,
            scheduled_class INTEGER DEFAULT 0,
            past_occupancy REAL DEFAULT 0.0,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            predicted_occupancy REAL NOT NULL,
            predicted_occupancy_30min REAL NOT NULL,
            status TEXT NOT NULL,
            recommendation TEXT NOT NULL,
            energy_saving_kwh REAL DEFAULT 0.0,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS energy_savings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            kwh_saved REAL NOT NULL,
            cost_saved REAL NOT NULL,
            co2_reduced REAL NOT NULL,
            action_taken TEXT NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
    """)

    # Insert rooms if not exists
    for room in ROOMS:
        cursor.execute(
            "INSERT OR IGNORE INTO rooms (id, name, building, floor, capacity, base_consumption) VALUES (?, ?, ?, ?, ?, ?)",
            (room["id"], room["name"], room["building"], room["floor"], room["capacity"], room["base_consumption"]),
        )

    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")


if __name__ == "__main__":
    init_db()
