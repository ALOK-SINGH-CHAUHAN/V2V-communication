import math
from typing import Dict, Optional, Tuple
from app.config import settings
from app.schemas.telemetry import TelemetryEvent
from app.schemas.decision import SafetyDecision
from app.intelligence.ttc import calculate_pair_ttc

def evaluate_lane_merge(
    requesting_t: TelemetryEvent,
    all_twins_telemetry: Dict[str, TelemetryEvent]
) -> Tuple[SafetyDecision, Dict]:
    """
    Evaluates Cooperative Lane Merge Assist request.
    Returns (SafetyDecision, merge_state_metadata)
    """
    merge_intent = requesting_t.merge_intent
    target_lane = merge_intent.target_lane_id if merge_intent else "L2"
    requested_gap = merge_intent.requested_gap_m if merge_intent else 15.0

    nearest_trailing_id: Optional[str] = None
    min_trailing_dist = 999.0
    trailing_ttc = 999.0

    req_pos = requesting_t.position

    # Find nearest trailing/adjacent vehicle in the target lane
    for target_id, target_t in all_twins_telemetry.items():
        if target_id == requesting_t.vehicle_id:
            continue
        
        if target_t.lane_id == target_lane:
            dx = target_t.position.x - req_pos.x
            dy = target_t.position.y - req_pos.y
            dist = math.sqrt(dx * dx + dy * dy)

            # Check if this vehicle is trailing or approaching target gap
            ttc, _, _ = calculate_pair_ttc(requesting_t, target_t)
            if dist < min_trailing_dist:
                min_trailing_dist = dist
                trailing_ttc = ttc
                nearest_trailing_id = target_id

    # Negotiation evaluation
    if min_trailing_dist >= requested_gap and trailing_ttc >= settings.MERGE_SAFE_TTC_THRESHOLD:
        status = "MERGE_GRANTED"
        triggering_rule = "RULE_MERGE_GAP_SAFE"
        rationale = f"Merge request granted into {target_lane}. Safe gap ({min_trailing_dist:.1f}m >= {requested_gap:.1f}m) confirmed."
    elif nearest_trailing_id is None:
        status = "MERGE_GRANTED"
        triggering_rule = "RULE_MERGE_LANE_CLEAR"
        rationale = f"Merge request granted into {target_lane}. Target lane clear."
    else:
        status = "MERGE_HOLD"
        triggering_rule = "RULE_MERGE_GAP_INSUFFICIENT"
        rationale = f"Merge held. Gap ({min_trailing_dist:.1f}m < {requested_gap:.1f}m) or TTC ({trailing_ttc:.1f}s < {settings.MERGE_SAFE_TTC_THRESHOLD:.1f}s) insufficient."

    decision = SafetyDecision(
        vehicle_id=requesting_t.vehicle_id,
        target_vehicle_id=nearest_trailing_id,
        timestamp=requesting_t.timestamp,
        decision_type=status,
        priority=2,
        triggering_rule=triggering_rule,
        risk_score=30.0 if status == "MERGE_GRANTED" else 65.0,
        ttc=trailing_ttc,
        rationale=rationale
    )

    merge_metadata = {
        "status": status,
        "requesting_vehicle": requesting_t.vehicle_id,
        "target_lane_id": target_lane,
        "requested_gap_m": requested_gap,
        "nearest_trailing_id": nearest_trailing_id,
        "available_gap_m": min_trailing_dist,
        "trailing_ttc": trailing_ttc,
        "timestamp": requesting_t.timestamp
    }

    return decision, merge_metadata
