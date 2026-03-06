"""
PowerSense AI — Data Processor
Transforms UCI Household Power dataset into per-classroom energy profiles
with synthetic occupancy labels derived from power patterns.
"""

import pandas as pd
import numpy as np
import os
import sqlite3
from database import init_db, get_connection, ROOMS, DB_PATH
DATA_PATH = "/Users/pavankumars/Downloads/Hackathon/Data_set/household_power_consumption.txt"


def load_raw_data(max_rows=50000):
    """Load and clean the UCI power consumption dataset."""
    print("Loading raw dataset...")
    df = pd.read_csv(
        DATA_PATH,
        sep=";",
        nrows=max_rows,
        na_values=["?"],
        low_memory=False,
    )
    df.columns = [c.strip() for c in df.columns]
    df = df.dropna()

    # Parse datetime
    df["datetime"] = pd.to_datetime(df["Date"] + " " + df["Time"], format="%d/%m/%Y %H:%M:%S")
    df["hour"] = df["datetime"].dt.hour
    df["day_of_week"] = df["datetime"].dt.dayofweek  # 0=Monday, 6=Sunday

    # Convert numeric columns
    for col in ["Global_active_power", "Global_reactive_power", "Voltage", "Global_intensity",
                "Sub_metering_1", "Sub_metering_2", "Sub_metering_3"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna()
    print(f"Loaded {len(df)} rows")
    return df


def generate_classroom_data(df, room):
    """Generate realistic classroom energy profile from raw data."""
    room_id = room["id"]
    base = room["base_consumption"]
    capacity = room["capacity"]

    # Sample a subset for this room
    n_samples = min(5000, len(df))
    indices = np.random.choice(len(df), n_samples, replace=False)
    room_df = df.iloc[indices].copy().reset_index(drop=True)

    # Derive occupancy: during class hours (8-18, weekdays) with high power = occupied
    is_class_hour = (room_df["hour"] >= 8) & (room_df["hour"] <= 18)
    is_weekday = room_df["day_of_week"] < 5

    # Higher power during class hours on weekdays likely means occupied
    power_threshold = room_df["Global_active_power"].quantile(0.4)
    high_power = room_df["Global_active_power"] > power_threshold

    # Probability of occupancy based on conditions
    occ_prob = np.where(is_class_hour & is_weekday & high_power, 0.85,
              np.where(is_class_hour & is_weekday, 0.5,
              np.where(is_class_hour, 0.2, 0.05)))

    room_df["is_occupied"] = (np.random.random(n_samples) < occ_prob).astype(int)

    # Simulate scheduled classes (repeating weekly pattern)
    schedule_hours = np.random.choice(range(8, 18), size=np.random.randint(3, 7), replace=False)
    schedule_days = np.random.choice(range(0, 5), size=np.random.randint(3, 5), replace=False)
    room_df["scheduled_class"] = (
        room_df["hour"].isin(schedule_hours) & room_df["day_of_week"].isin(schedule_days)
    ).astype(int)

    # Simulate WiFi devices (correlated with occupancy)
    room_df["wifi_devices"] = np.where(
        room_df["is_occupied"] == 1,
        np.random.randint(int(capacity * 0.3), int(capacity * 0.9), n_samples),
        np.random.randint(0, 5, n_samples),
    )

    # Past occupancy (rolling average simulation)
    room_df["past_occupancy"] = (
        room_df["is_occupied"]
        .rolling(window=5, min_periods=1)
        .mean()
        .shift(1)
        .fillna(0.0)
    )

    # Calculate realistic power: base + (occupied appliances)
    room_df["calculated_power"] = base + np.where(
        room_df["is_occupied"] == 1,
        0.1 + 0.2 + 1.5 + np.random.uniform(-0.1, 0.3, n_samples),  # lights + fans + AC + noise
        np.random.uniform(-0.05, 0.1, n_samples),  # just base noise
    )

    room_df["room_id"] = room_id
    return room_df


def insert_readings(conn, room_df):
    """Insert classroom readings into database."""
    cursor = conn.cursor()
    for _, row in room_df.iterrows():
        cursor.execute("""
            INSERT INTO readings (room_id, timestamp, hour, day_of_week,
                global_active_power, voltage, intensity,
                sub_metering_1, sub_metering_2, sub_metering_3,
                is_occupied, wifi_devices, scheduled_class, past_occupancy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["room_id"],
            str(row["datetime"]),
            int(row["hour"]),
            int(row["day_of_week"]),
            float(row["calculated_power"]),
            float(row["Voltage"]),
            float(row["Global_intensity"]),
            float(row["Sub_metering_1"]),
            float(row["Sub_metering_2"]),
            float(row["Sub_metering_3"]),
            int(row["is_occupied"]),
            int(row["wifi_devices"]),
            int(row["scheduled_class"]),
            float(row["past_occupancy"]),
        ))
    conn.commit()


def process_all():
    """Main data processing pipeline."""
    # Initialize database
    init_db()

    # Load raw data
    df = load_raw_data(max_rows=50000)

    conn = get_connection()

    # Clear existing readings
    conn.execute("DELETE FROM readings")
    conn.commit()

    # Process each room
    for room in ROOMS:
        print(f"Processing {room['id']} - {room['name']}...")
        room_df = generate_classroom_data(df, room)
        insert_readings(conn, room_df)
        print(f"  Inserted {len(room_df)} readings for {room['id']}")

    conn.close()
    print(f"\nData processing complete! Database at: {DB_PATH}")
    print(f"Total rooms: {len(ROOMS)}")


if __name__ == "__main__":
    np.random.seed(42)
    process_all()
