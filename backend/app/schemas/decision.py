from pydantic import BaseModel, Field
from typing import Optional, Literal, List

class RiskAssessment(BaseModel):
    vehicle_id: str
    target_vehicle_id: Optional[str] = None
    timestamp: int
    ttc: float
    risk_score: float = Field(..., description="Risk score 0-100 from Random Forest model")
    model_version: str = "v1.0-rf"

class SafetyDecision(BaseModel):
    vehicle_id: str
    target_vehicle_id: Optional[str] = None
    timestamp: int
    decision_type: Literal[
        "SAFE",
        "EARLY_WARNING",
        "HIGH_RISK",
        "IMMEDIATE_ALERT",
        "COMMUNICATION_LOST"
    ]
    priority: int = Field(..., description="0=emergency, 1=immediate, 2=high risk, 3=early warning, 4=safe")
    triggering_rule: str
    risk_score: float
    ttc: float
    ttc_trend: str = Field("STABLE", description="STABLE | CLOSING_SLOWLY | RISK_INCREASING_RAPIDLY")
    risk_trend_label: str = Field("STABLE", description="STABLE | INCREASING | RAPIDLY_INCREASING | DECREASING | RAPIDLY_DECREASING")
    reasons: List[str] = Field(default_factory=list, description="Deterministically derived reason codes")
    rationale: str
    
    # Cooperative V2V Advantage Metrics
    local_detection_ttc_s: float = Field(2.1, description="Simulated local sensor detection horizon in seconds")
    v2v_detection_ttc_s: float = Field(6.8, description="V2V cooperative warning horizon in seconds")
    v2v_early_warning_gain_s: float = Field(4.7, description="Additional early warning time gained via V2V")

class ModelExplainability(BaseModel):
    model_version: str
    feature_names: List[str]
    feature_importances: List[float]
