import math
from typing import Dict, List, Optional
from app.config import settings
from app.schemas.telemetry import TelemetryEvent
from app.schemas.decision import SafetyDecision

def check_heading_aligned(h1: float, h2: float, tolerance: float = 45.0) -> bool:
    """Checks if two heading angles (0-360 deg) are aligned within tolerance."""
    diff = abs(h1 - h2) % 360
    if diff > 180:
        diff = 360 - diff
    return diff <= tolerance

def evaluate_emergency_corridor(
    ev_telemetry: TelemetryEvent,
    all_twins_telemetry: Dict[str, TelemetryEvent]
) -> List[SafetyDecision]:
    """
    Evaluates Emergency Vehicle Priority corridor for an active emergency vehicle broadcast.
    Emits YIELD_CLEAR_PATH (Priority 0) decisions for all corridor-aligned vehicles.
    """
    decisions = []
    if ev_telemetry.vehicle_type != "emergency" and ev_telemetry.event_flag != "emergency":
        return decisions

    ev_pos = ev_telemetry.position
    ev_heading = ev_telemetry.heading_deg

    for target_id, target_t in all_twins_telemetry.items():
        if target_id == ev_telemetry.vehicle_id:
            continue

        # Distance calculation
        dx = target_t.position.x - ev_pos.x
        dy = target_t.position.y - ev_pos.y
        dist = math.sqrt(dx * dx + dy * dy)

        if dist <= settings.CORRIDOR_RADIUS_M:
            # Check heading alignment or same/adjacent lane
            aligned = check_heading_aligned(
                ev_heading, 
                target_t.heading_deg, 
                settings.HEADING_ALIGNMENT_TOLERANCE_DEG
            )
            
            if aligned or target_t.lane_id == ev_telemetry.lane_id:
                decisions.append(
                    SafetyDecision(
                        vehicle_id=target_id,
                        target_vehicle_id=ev_telemetry.vehicle_id,
                        timestamp=ev_telemetry.timestamp,
                        decision_type="YIELD_CLEAR_PATH",
                        priority=0,  # Priority 0 override
                        triggering_rule="RULE_EVP_CORRIDOR_OVERRIDE",
                        risk_score=99.0,
                        ttc=max(0.1, dist / max(0.1, ev_telemetry.speed_mps)),
                        rationale=f"Emergency vehicle corridor alert from {ev_telemetry.vehicle_id}. Yield right-of-way immediately."
                    )
                )

    return decisions
