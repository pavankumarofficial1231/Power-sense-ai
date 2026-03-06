"""
PowerSense AI — ML Model
RandomForest occupancy prediction with 30-minute lookahead.
"""

import os
import numpy as np
from numpy import ndarray
from typing import cast
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from database import get_connection

MODEL_PATH = os.path.join(os.path.dirname(__file__), "occupancy_model.joblib")
FEATURES = ["hour", "day_of_week", "scheduled_class", "past_occupancy", "wifi_devices"]


def load_training_data():
    """Load processed classroom data from SQLite."""
    conn = get_connection()
    df = pd.read_sql_query(
        "SELECT hour, day_of_week, scheduled_class, past_occupancy, wifi_devices, is_occupied FROM readings",
        conn,
    )
    conn.close()
    print(f"Loaded {len(df)} training samples")
    return df


def train_model():
    """Train RandomForest classifier for occupancy prediction."""
    df = load_training_data()

    X = df[FEATURES]
    y = df["is_occupied"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    print("Training RandomForest model...")
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nModel Accuracy: {accuracy:.2%}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Empty", "Occupied"]))

    # Feature importance
    importances = dict(zip(FEATURES, model.feature_importances_))
    print("\nFeature Importances:")
    for feat, imp in sorted(importances.items(), key=lambda x: -x[1]):
        print(f"  {feat}: {imp:.4f}")

    # Save model
    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved to {MODEL_PATH}")

    return model, accuracy


def load_model():
    """Load trained model from disk."""
    if not os.path.exists(MODEL_PATH):
        print("No saved model found. Training new model...")
        model, _ = train_model()
        return model
    return joblib.load(MODEL_PATH)


def predict(hour, day_of_week, scheduled_class, past_occupancy, wifi_devices):
    """Predict occupancy probability for given features."""
    model = load_model()
    features = np.array([[hour, day_of_week, scheduled_class, past_occupancy, wifi_devices]])
    probability = model.predict_proba(features)[0][1]  # Probability of occupied
    return float(probability)


def predict_batch(features_list):
    """Predict occupancy for multiple sets of features at once."""
    model = load_model()
    features = np.array(features_list)
    probabilities: ndarray = cast(ndarray, model.predict_proba(features))[:, 1]
    return probabilities.tolist()


def predict_30min_ahead(hour, day_of_week, scheduled_class, past_occupancy, wifi_devices):
    """Predict occupancy 30 minutes ahead by shifting the hour."""
    future_hour = hour + 0.5
    if future_hour >= 24:
        future_hour -= 24
    # Reduce wifi devices slightly for future prediction (uncertainty)
    future_wifi = max(0, int(wifi_devices * 0.7))
    return predict(int(future_hour), day_of_week, scheduled_class, past_occupancy, future_wifi)


if __name__ == "__main__":
    model, accuracy = train_model()
    print(f"\n--- Test Predictions ---")
    test_cases = [
        (10, 1, 1, 0.8, 25, "Tuesday 10am, class scheduled, high WiFi"),
        (14, 3, 1, 0.6, 15, "Thursday 2pm, class scheduled, medium WiFi"),
        (22, 5, 0, 0.1, 2, "Saturday 10pm, no class, low WiFi"),
        (8, 0, 1, 0.0, 30, "Monday 8am, class scheduled, high WiFi"),
        (20, 6, 0, 0.0, 0, "Sunday 8pm, no class, no WiFi"),
    ]
    for hour, dow, sched, past, wifi, desc in test_cases:
        prob = predict(hour, dow, sched, past, wifi)
        prob_30 = predict_30min_ahead(hour, dow, sched, past, wifi)
        print(f"  {desc}: {prob:.2%} (30min: {prob_30:.2%})")
