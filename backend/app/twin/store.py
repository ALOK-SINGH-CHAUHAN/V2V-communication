import time
from typing import Dict, List, Optional
from app.schemas.telemetry import TelemetryEvent
from app.schemas.decision import SafetyDecision
from app.schemas.twin import VehicleTwin

class DigitalTwinStore:
    def __init__(self):
        self.twins: Dict[str, VehicleTwin] = {}
        self.telemetry_history: Dict[str, TelemetryEvent] = {}

    def update_twin(
        self, 
        event: TelemetryEvent, 
        decision: SafetyDecision
    ) -> VehicleTwin:
        v = event.vehicle
        self.telemetry_history[v.vehicle_id] = event

        twin = VehicleTwin(
            vehicle_id=v.vehicle_id,
            seq=v.seq,
            last_position=v.position,
            last_speed_mps=v.speed_mps,
            last_heading_deg=v.heading_deg,
            last_accel_x=v.accel.x,
            last_risk_score=decision.risk_score,
            last_ttc=decision.ttc,
            ttc_trend=decision.ttc_trend,
            last_decision=decision,
            connectivity_status="LIVE",
            last_seen=v.timestamp,
            receiver_meta=event.receiver
        )
        self.twins[v.vehicle_id] = twin
        return twin

    def update_staleness(self, current_time_ms: int):
        """
        Scans all twins and updates connectivity status:
        < 1.0s => LIVE (🟢)
        1.0s - 2.0s => STALE (🟡)
        > 2.0s => COMMUNICATION_LOST (🔴)
        """
        for v_id, twin in self.twins.items():
            elapsed_s = (current_time_ms - twin.last_seen) / 1000.0
            if elapsed_s > 2.0:
                twin.connectivity_status = "COMMUNICATION_LOST"
                if twin.last_decision:
                    twin.last_decision.decision_type = "COMMUNICATION_LOST"
                    twin.last_decision.rationale = "Vehicle state cannot be reliably assessed because telemetry packet link is lost."
                    twin.last_decision.reasons = ["🔴 TELEMETRY LINK LOST (> 2.0s timeout)"]
            elif elapsed_s > 1.0:
                twin.connectivity_status = "STALE"

    def get_all_twins(self) -> List[VehicleTwin]:
        return list(self.twins.values())

    def get_twin(self, vehicle_id: str) -> Optional[VehicleTwin]:
        return self.twins.get(vehicle_id)

    def get_latest_telemetry_map(self) -> Dict[str, TelemetryEvent]:
        return dict(self.telemetry_history)

twin_store = DigitalTwinStore()
