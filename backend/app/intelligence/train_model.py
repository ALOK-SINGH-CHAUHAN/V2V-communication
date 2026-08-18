import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "rf_model.joblib")

FEATURE_NAMES = [
    "min_distance",
    "max_closing_rate",
    "min_ttc",
    "speed_mps",
    "deceleration",
    "accel_x"
]

def compute_continuous_risk(min_ttc: float, deceleration: float, max_closing_rate: float, min_distance: float) -> float:
    # 1. TTC Continuous Component (0 to 100)
    if min_ttc <= 1.0:
        ttc_score = 100.0
    elif min_ttc <= 2.5:
        ttc_score = 100.0 - (min_ttc - 1.0) * 33.3  # 100 -> 50
    elif min_ttc <= 6.0:
        ttc_score = 50.0 - (min_ttc - 2.5) * 8.55   # 50 -> 20
    elif min_ttc <= 10.0:
        ttc_score = 20.0 - (min_ttc - 6.0) * 5.0    # 20 -> 0
    else:
        ttc_score = 0.0

    # 2. Deceleration Component (0 to 100)
    decel_score = min(100.0, max(0.0, deceleration) * 12.5)  # 8 m/s² deceleration = 100

    # 3. Proximity & Closing Speed Component
    if min_distance > 0 and min_distance < 120.0 and max_closing_rate > 0:
        closing_kmh = max_closing_rate * 3.6
        proximity_score = min(100.0, (closing_kmh * 20.0) / max(3.0, min_distance))
    else:
        proximity_score = 0.0

    # Hybrid dynamic continuous weighting
    total_risk = ttc_score * 0.50 + decel_score * 0.30 + proximity_score * 0.20
    return float(np.clip(total_risk, 0.0, 100.0))

def generate_synthetic_dataset(num_samples: int = 5000):
    np.random.seed(42)
    
    min_distance = np.random.uniform(1.0, 120.0, num_samples)
    max_closing_rate = np.random.uniform(0.0, 35.0, num_samples)
    min_ttc = np.random.uniform(0.2, 15.0, num_samples)
    speed_mps = np.random.uniform(0.0, 40.0, num_samples)
    deceleration = np.random.uniform(0.0, 10.0, num_samples)
    accel_x = np.random.uniform(-10.0, 4.0, num_samples)

    risk_scores = []
    for i in range(num_samples):
        base_risk = compute_continuous_risk(min_ttc[i], deceleration[i], max_closing_rate[i], min_distance[i])
        noise = np.random.normal(0, 1.5)
        risk_scores.append(float(np.clip(base_risk + noise, 0.0, 100.0)))

    df = pd.DataFrame({
        "min_distance": min_distance,
        "max_closing_rate": max_closing_rate,
        "min_ttc": min_ttc,
        "speed_mps": speed_mps,
        "deceleration": deceleration,
        "accel_x": accel_x,
        "risk_score": risk_scores
    })
    return df

def train_and_save_model():
    os.makedirs(MODEL_DIR, exist_ok=True)
    df = generate_synthetic_dataset()
    
    X = df[FEATURE_NAMES]
    y = df["risk_score"]

    rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    rf.fit(X, y)

    artifact = {
        "model": rf,
        "feature_names": FEATURE_NAMES,
        "feature_importances": rf.feature_importances_.tolist(),
        "version": "v2.0-rf-continuous"
    }

    joblib.dump(artifact, MODEL_PATH)
    print(f"✅ Random Forest model trained and saved to {MODEL_PATH}")

if __name__ == "__main__":
    train_and_save_model()
