import math
from typing import Tuple, List, Dict, Optional
from app.schemas.telemetry import TelemetryEvent

# History buffer of recent TTC values per vehicle pair
_ttc_history_buffer: Dict[str, List[float]] = {}

def calculate_vehicle_velocity(speed_mps: float, heading_deg: float) -> Tuple[float, float]:
    rad = math.radians(heading_deg)
    return speed_mps * math.cos(rad), speed_mps * math.sin(rad)

def calculate_pair_ttc(t1: TelemetryEvent, t2: TelemetryEvent) -> Tuple[float, float, float]:
    """
    Computes (TTC, distance, closing_speed) between two telemetry events.
    TTC is 999.0 (infinity) if closing_speed <= 0 (not approaching).
    """
    v1 = t1.vehicle
    v2 = t2.vehicle

    dx = v2.position.x - v1.position.x
    dy = v2.position.y - v1.position.y
    distance = math.sqrt(dx * dx + dy * dy)
    
    if distance < 0.001:
        return 0.0, 0.0, 0.0
    
    v1x, v1y = calculate_vehicle_velocity(v1.speed_mps, v1.heading_deg)
    v2x, v2y = calculate_vehicle_velocity(v2.speed_mps, v2.heading_deg)
    
    # Relative velocity (v1 approaching v2)
    v_rel_x = v1x - v2x
    v_rel_y = v1y - v2y
    
    # Closing speed projection onto relative displacement vector
    closing_speed = (dx * v_rel_x + dy * v_rel_y) / distance
    
    # CRITICAL AUTOMOTIVE PRINCIPLE: If closing_speed <= 0, vehicles are not closing -> TTC is Infinite
    if closing_speed <= 0.001:
        return 999.0, distance, closing_speed
    
    ttc = distance / closing_speed
    return max(0.0, ttc), distance, closing_speed

def calculate_obstacle_ttc(t: TelemetryEvent) -> float:
    v = t.vehicle
    if v.distance_to_obstacle_m >= 900.0 or v.speed_mps <= 0.01:
        return 999.0
    return max(0.0, v.distance_to_obstacle_m / v.speed_mps)

def compute_ttc_trend(vehicle_id: str, current_ttc: float) -> str:
    """Tracks TTC history and computes trend rate."""
    if vehicle_id not in _ttc_history_buffer:
        _ttc_history_buffer[vehicle_id] = []
    
    buf = _ttc_history_buffer[vehicle_id]
    buf.append(current_ttc)
    if len(buf) > 10:
        buf.pop(0)

    if len(buf) < 3:
        return "STABLE"

    recent = [val for val in buf[-4:] if val < 900.0]
    if len(recent) < 3:
        return "STABLE"

    # Check if TTC is consistently decreasing
    diffs = [recent[i] - recent[i - 1] for i in range(1, len(recent))]
    avg_diff = sum(diffs) / len(diffs)

    if avg_diff < -0.8:
        return "RISK_INCREASING_RAPIDLY"
    elif avg_diff < -0.2:
        return "CLOSING_SLOWLY"
    else:
        return "STABLE"
