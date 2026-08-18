import pytest
from app.schemas.telemetry import TelemetryEvent, VehiclePayload, ReceiverMetadata, Position, Vector3D
from app.intelligence.ttc import calculate_pair_ttc
from app.decision.engine import decision_engine
from app.twin.store import twin_store


def create_event(
    v_id: str,
    x: float,
    y: float,
    speed: float,
    event_flag: str = "heartbeat",
    msg_type: str = "HEARTBEAT",
    receiver_id: str | None = None,
) -> TelemetryEvent:
    """Factory for test telemetry events with the updated canonical schema."""
    return TelemetryEvent(
        msg_type=msg_type,
        receiver_id=receiver_id,
        vehicle=VehiclePayload(
            vehicle_id=v_id,
            seq=1,
            timestamp=1755500000000,
            position=Position(x=x, y=y),
            speed_mps=speed,
            heading_deg=90.0,
            accel=Vector3D(x=0.0, y=0.0, z=9.8),
            gyro=Vector3D(x=0.0, y=0.0, z=0.0),
            distance_to_obstacle_m=999.0,
            event_flag=event_flag,
            crc="0x4A8F",
        ),
        receiver=ReceiverMetadata(
            rssi=-72.0,
            snr=8.5,
            packet_loss_pct=0.0,
            latency_ms=45.0,
            source="SIMULATED",
        ),
    )


# ─── Schema tests ─────────────────────────────────────────────────────────────

def test_telemetry_schema_validation():
    """msg_type and receiver_id are top-level canonical fields."""
    t = create_event("V001", 10.0, 20.0, 15.0, msg_type="BRAKE_ALERT", receiver_id="V002")
    assert t.vehicle.vehicle_id == "V001"
    assert t.vehicle.speed_mps == 15.0
    assert t.receiver.rssi == -72.0
    # New top-level fields
    assert t.msg_type == "BRAKE_ALERT"
    assert t.receiver_id == "V002"


def test_heartbeat_default_msg_type():
    """Default msg_type is HEARTBEAT when not specified."""
    t = create_event("V001", 10.0, 20.0, 15.0)
    assert t.msg_type == "HEARTBEAT"
    assert t.receiver_id is None


# ─── TTC tests ────────────────────────────────────────────────────────────────

def test_ttc_calculation():
    t1 = create_event("V001", 10.0, 100.0, 20.0)
    t2 = create_event("V002", 10.0, 130.0, 10.0)
    ttc, dist, closing_sp = calculate_pair_ttc(t1, t2)
    assert round(dist, 1) == 30.0
    assert round(closing_sp, 1) == 10.0
    assert round(ttc, 1) == 3.0


def test_closing_speed_negative_infinity_ttc():
    """Vehicles moving apart → TTC is infinity (999)."""
    t1 = create_event("V001", 10.0, 100.0, 10.0)
    t2 = create_event("V002", 10.0, 130.0, 20.0)
    ttc, dist, closing_sp = calculate_pair_ttc(t1, t2)
    assert ttc == 999.0
    assert closing_sp <= 0.0


# ─── Decision engine tests ────────────────────────────────────────────────────

def test_progressive_warning_levels():
    """Engine returns a 3-tuple; decision types align with risk tiers."""
    # 1. Immediate Alert — V001 closing fast on V002
    t1 = create_event("V001", 10.0, 100.0, 25.0)
    t2 = create_event("V002", 10.0, 110.0, 5.0)
    twins = {"V002": t2}
    dec_imm, _, trace = decision_engine.process_telemetry(t1, twins)
    assert dec_imm.decision_type == "IMMEDIATE_ALERT"
    assert dec_imm.risk_score >= 75.0
    # Pipeline trace must have 5 stages
    assert len(trace) == 5
    stages = [s["stage"] for s in trace]
    assert stages == [
        "PACKET_RECEIVED", "TTC_COMPUTED", "ML_RISK", "RULE_ENGINE", "DECISION_ISSUED"
    ]
    # elapsed_us values must be monotonically non-decreasing
    elapsed = [s["elapsed_us"] for s in trace]
    assert elapsed == sorted(elapsed)

    # 2. Early Warning — vehicles further apart, moderate closing speed
    t3 = create_event("V003", 10.0, 100.0, 18.0)
    t4 = create_event("V004", 10.0, 150.0, 12.0)
    twins_early = {"V004": t4}
    dec_early, _, _ = decision_engine.process_telemetry(t3, twins_early)
    assert dec_early.decision_type in ["EARLY_WARNING", "HIGH_RISK"]
    assert dec_early.risk_score >= 30.0


def test_pipeline_trace_structure():
    """Every trace entry must have required keys."""
    t1 = create_event("V001", 10.0, 100.0, 20.0)
    _, _, trace = decision_engine.process_telemetry(t1, {})
    for step in trace:
        assert "stage" in step
        assert "label" in step
        assert "value" in step
        assert "elapsed_us" in step
        assert isinstance(step["elapsed_us"], int)


# ─── Staleness / COMM_LOST tests ──────────────────────────────────────────────

def test_staleness_communication_loss():
    """Twin transitions to COMMUNICATION_LOST after >2s without packets."""
    now_ms = 100_000
    t1 = create_event("V001", 10.0, 100.0, 15.0)
    t1.vehicle.timestamp = now_ms - 3000   # 3 seconds stale
    dec, _, _ = decision_engine.process_telemetry(t1, {})
    twin_store.update_twin(t1, dec)

    twin_store.update_staleness(now_ms)
    twin = twin_store.get_twin("V001")
    assert twin.connectivity_status == "COMMUNICATION_LOST"
    assert twin.last_decision.decision_type == "COMMUNICATION_LOST"
