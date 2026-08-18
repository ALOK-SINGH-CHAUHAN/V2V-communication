from collections import deque
import numpy as np
from typing import Dict, List
from app.schemas.telemetry import TelemetryEvent
from app.intelligence.ttc import calculate_pair_ttc, calculate_obstacle_ttc

class FeatureExtractor:
    def __init__(self, history_size: int = 10):
        self.history_size = history_size
        self.history: Dict[str, deque] = {}

    def push(self, event: TelemetryEvent):
        vid = event.vehicle.vehicle_id
        if vid not in self.history:
            self.history[vid] = deque(maxlen=self.history_size)
        self.history[vid].append(event)

    def extract_features(
        self, 
        event: TelemetryEvent, 
        all_latest_events: Dict[str, TelemetryEvent]
    ) -> Dict[str, float]:
        v = event.vehicle
        self.push(event)
        v_history = list(self.history[v.vehicle_id])
        
        # 1. Kinematic features
        if len(v_history) >= 2:
            dt = (v_history[-1].vehicle.timestamp - v_history[-2].vehicle.timestamp) / 1000.0
            if dt <= 0.001:
                dt = 0.1
            speed_diff = v_history[-1].vehicle.speed_mps - v_history[-2].vehicle.speed_mps
            deceleration = max(0.0, -speed_diff / dt)
            jerk = (v_history[-1].vehicle.accel.x - v_history[-2].vehicle.accel.x) / dt
        else:
            deceleration = max(0.0, -v.accel.x)
            jerk = 0.0

        # 2. Multi-vehicle interaction features
        min_ttc = calculate_obstacle_ttc(event)
        min_distance = v.distance_to_obstacle_m
        max_closing_rate = 0.0

        for other_id, other_event in all_latest_events.items():
            if other_id == v.vehicle_id:
                continue
            ttc, dist, closing_sp = calculate_pair_ttc(event, other_event)
            if dist < min_distance:
                min_distance = dist
            if closing_sp > max_closing_rate:
                max_closing_rate = closing_sp
            if ttc < min_ttc:
                min_ttc = ttc

        return {
            "min_ttc": float(min_ttc),
            "min_distance": float(min_distance),
            "max_closing_rate": float(max_closing_rate),
            "deceleration": float(deceleration),
            "jerk": float(jerk),
            "obstacle_distance": float(v.distance_to_obstacle_m),
            "speed_mps": float(v.speed_mps),
            "accel_x": float(v.accel.x)
        }

feature_extractor = FeatureExtractor()
