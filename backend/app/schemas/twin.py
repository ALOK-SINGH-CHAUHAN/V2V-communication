from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from app.schemas.telemetry import Position, ReceiverMetadata
from app.schemas.decision import SafetyDecision

class VehicleTwin(BaseModel):
    vehicle_id: str
    seq: int = 1
    last_position: Position
    last_speed_mps: float
    last_heading_deg: float
    last_accel_x: float = 0.0
    last_risk_score: float = 0.0
    last_ttc: float = 999.0
    ttc_trend: str = "STABLE"
    last_decision: Optional[SafetyDecision] = None
    connectivity_status: Literal["LIVE", "STALE", "COMMUNICATION_LOST"] = "LIVE"
    last_seen: int
    receiver_meta: ReceiverMetadata = Field(default_factory=ReceiverMetadata)

class FleetStateResponse(BaseModel):
    vehicles: List[VehicleTwin]
    timestamp: int
    active_count: int
