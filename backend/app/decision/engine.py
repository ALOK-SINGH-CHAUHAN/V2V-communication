"""
Hybrid Decision Engine — Level 2 (Intelligence) + Level 3 (Decision)
======================================================================
"""

import time
from collections import deque
from typing import Dict, List, Tuple
from app.config import settings
from app.schemas.telemetry import TelemetryEvent
from app.schemas.decision import SafetyDecision, RiskAssessment
from app.intelligence.feature_extractor import feature_extractor
from app.intelligence.model import risk_model
from app.intelligence.ttc import compute_ttc_trend

# Per-vehicle EMA smoothed risk buffers
_smoothed_risk: Dict[str, float] = {}
_risk_history_buffer: Dict[str, deque] = {}

EMA_ALPHA = 0.25   # α=0.25 — responsive but not jittery


def _ema_smooth(vehicle_id: str, raw_risk: float) -> float:
    """Exponential Moving Average smoother — prevents 43→44→43 jitter."""
    prev = _smoothed_risk.get(vehicle_id, raw_risk)
    smoothed = EMA_ALPHA * raw_risk + (1.0 - EMA_ALPHA) * prev
    _smoothed_risk[vehicle_id] = smoothed
    return smoothed


def _compute_risk_trend_label(vehicle_id: str, current_risk: float) -> str:
    """
    Tracks rolling risk history and computes rate of change per second (ΔRisk/sec):
      - |Δ| < 2.0 pts/sec    → STABLE
      - +2.0 to +8.0 pts/sec  → INCREASING
      - > +8.0 pts/sec       → RAPIDLY_INCREASING
      - -2.0 to -8.0 pts/sec  → DECREASING
      - < -8.0 pts/sec       → RAPIDLY_DECREASING
    """
    if vehicle_id not in _risk_history_buffer:
        _risk_history_buffer[vehicle_id] = deque(maxlen=10)
    
    buf = _risk_history_buffer[vehicle_id]
    buf.append((time.time(), current_risk))

    if len(buf) < 3:
        return "STABLE"

    dt = buf[-1][0] - buf[0][0]
    if dt < 0.1:
        return "STABLE"

    d_risk = buf[-1][1] - buf[0][1]
    rate = d_risk / dt   # points per second

    if rate > 8.0:
        return "RAPIDLY_INCREASING"
    elif rate > 2.0:
        return "INCREASING"
    elif rate < -8.0:
        return "RAPIDLY_DECREASING"
    elif rate < -2.0:
        return "DECREASING"
    else:
        return "STABLE"


class HybridDecisionEngine:
    def process_telemetry(
        self,
        event: TelemetryEvent,
        all_twins_telemetry: Dict[str, TelemetryEvent],
    ) -> Tuple[SafetyDecision, RiskAssessment, List[dict]]:
        t0 = time.perf_counter_ns()
        pipeline_trace: List[dict] = []

        v = event.vehicle
        features = feature_extractor.extract_features(event, all_twins_telemetry)

        min_ttc = features["min_ttc"]
        min_distance = features["min_distance"]
        max_closing_rate = features["max_closing_rate"]
        deceleration = features["deceleration"]

        # Stage 1 — packet received
        pipeline_trace.append({
            "stage": "PACKET_RECEIVED",
            "label": "📡 V2V Packet Received",
            "value": f"{v.vehicle_id} · {event.msg_type}",
            "elapsed_us": 0,
        })

        # Stage 2 — TTC computed
        t1 = time.perf_counter_ns()
        ttc_display = f"{min_ttc:.1f}s" if min_ttc < 900.0 else "∞"
        pipeline_trace.append({
            "stage": "TTC_COMPUTED",
            "label": "⏱ TTC Computed",
            "value": ttc_display,
            "elapsed_us": round((t1 - t0) / 1_000),
        })

        # ── ML Risk Prediction ────────────────────────────────────────────
        raw_risk = risk_model.predict_risk(features)

        # Physical floor enforcement
        if min_ttc < 2.0 and max_closing_rate > 0:
            raw_risk = max(80.0, raw_risk)
        elif min_ttc < 5.0 and max_closing_rate > 2.0:
            raw_risk = max(55.0, raw_risk)
        elif min_ttc < 9.0 and (deceleration > 2.0 or max_closing_rate > 3.0):
            raw_risk = max(35.0, raw_risk)

        raw_risk = float(max(0.0, min(100.0, raw_risk)))

        # EMA smoothing
        risk_score = float(max(0.0, min(100.0, _ema_smooth(v.vehicle_id, raw_risk))))
        risk_trend_label = _compute_risk_trend_label(v.vehicle_id, risk_score)

        # Stage 3 — ML risk score
        t2 = time.perf_counter_ns()
        pipeline_trace.append({
            "stage": "ML_RISK",
            "label": "🧠 ML Risk Scored",
            "value": f"{risk_score:.0f} / 100",
            "elapsed_us": round((t2 - t0) / 1_000),
        })

        ttc_trend = compute_ttc_trend(v.vehicle_id, min_ttc)

        risk_assessment = RiskAssessment(
            vehicle_id=v.vehicle_id,
            timestamp=v.timestamp,
            ttc=min_ttc,
            risk_score=risk_score,
            model_version=risk_model.version,
        )

        # ── Deterministic Reason Code Engine ─────────────────────────────
        reasons: List[str] = []
        if min_ttc < 2.0:
            reasons.append(f"🔴 TTC = {min_ttc:.1f}s (< 2.0s critical safety floor)")
        elif min_ttc < 6.0:
            reasons.append(f"🟠 TTC = {min_ttc:.1f}s (rapidly closing)")
        elif min_ttc < 10.0:
            reasons.append(f"🟡 TTC = {min_ttc:.1f}s (caution zone)")

        if max_closing_rate > 5.0:
            reasons.append(
                f"🔴 High closing speed = {max_closing_rate:.1f} m/s "
                f"({max_closing_rate * 3.6:.0f} km/h)"
            )

        if deceleration > 3.0:
            reasons.append(f"🟠 Heavy braking detected = -{deceleration:.1f} m/s²")
        elif v.event_flag == "brake":
            reasons.append("🟡 Vehicle brake flag active")

        if min_distance < 20.0:
            reasons.append(f"🟡 Close proximity = {min_distance:.1f} m")

        if not reasons:
            reasons.append("🟢 Safe distance & speed maintained")

        # ── Cooperative V2V Advantage Metrics ───────────────────────
        has_active_hazard = (
            (min_ttc < 10.0) or (v.event_flag == "brake") or (deceleration > 2.0)
        )
        if has_active_hazard:
            v2v_horizon_ttc = min_ttc if min_ttc < 900.0 else 6.8
            local_radar_limit_ttc = 2.1
            v2v_early_warning_gain = round(
                max(0.0, v2v_horizon_ttc - local_radar_limit_ttc), 1
            )
        else:
            v2v_horizon_ttc = 0.0
            local_radar_limit_ttc = 0.0
            v2v_early_warning_gain = 0.0

        # ── Progressive Warning Engine ─────────────────────────────────
        if risk_score >= 75.0:
            decision_type = "IMMEDIATE_ALERT"
            priority = 1
            triggering_rule = "RULE_IMMEDIATE_COLLISION_ALERT"
            rationale = (
                f"CRITICAL COLLISION HAZARD: Risk {risk_score:.0f}/100, "
                f"TTC {min_ttc:.1f}s. Immediate action required!"
            )
            decision_label = "🚨 BRAKE IMMEDIATELY"
        elif risk_score >= 50.0:
            decision_type = "HIGH_RISK"
            priority = 2
            triggering_rule = "RULE_HIGH_COLLISION_RISK"
            rationale = (
                f"HIGH COLLISION RISK: Risk {risk_score:.0f}/100. "
                f"Closing speed {max_closing_rate * 3.6:.0f} km/h. Prepare to brake."
            )
            decision_label = "⚠️ PREPARE TO BRAKE"
        elif risk_score >= 30.0:
            decision_type = "EARLY_WARNING"
            priority = 3
            triggering_rule = "RULE_EARLY_COOPERATIVE_WARNING"
            rationale = (
                f"EARLY COOPERATIVE WARNING: Risk {risk_score:.0f}/100. "
                f"Hazard detected via V2V. +{v2v_early_warning_gain:.1f}s early warning."
            )
            decision_label = "🟡 MONITOR CLOSELY"
        else:
            decision_type = "SAFE"
            priority = 4
            triggering_rule = "RULE_NOMINAL"
            rationale = f"Fleet telemetry nominal. Safe operating conditions (Risk: {risk_score:.0f}/100)."
            decision_label = "🟢 SAFE"

        # Stage 4 — rule engine
        t3 = time.perf_counter_ns()
        pipeline_trace.append({
            "stage": "RULE_ENGINE",
            "label": "⚖️ Safety Engine",
            "value": decision_type,
            "elapsed_us": round((t3 - t0) / 1_000),
        })

        decision = SafetyDecision(
            vehicle_id=v.vehicle_id,
            timestamp=v.timestamp,
            decision_type=decision_type,
            priority=priority,
            triggering_rule=triggering_rule,
            risk_score=risk_score,
            ttc=min_ttc,
            ttc_trend=ttc_trend,
            risk_trend_label=risk_trend_label,
            reasons=reasons,
            rationale=rationale,
            local_detection_ttc_s=local_radar_limit_ttc,
            v2v_detection_ttc_s=v2v_horizon_ttc,
            v2v_early_warning_gain_s=v2v_early_warning_gain,
        )

        # Stage 5 — decision issued
        t4 = time.perf_counter_ns()
        pipeline_trace.append({
            "stage": "DECISION_ISSUED",
            "label": "🚨 Decision Issued",
            "value": decision_label,
            "elapsed_us": round((t4 - t0) / 1_000),
        })

        return decision, risk_assessment, pipeline_trace


decision_engine = HybridDecisionEngine()
