"""
V2V Intelligence & Decision System — FastAPI Backend
=====================================================
WebSocket event types emitted per telemetry packet:
  • TELEMETRY_UPDATE   — twin state + decision (existing, unchanged shape)
  • V2V_PACKET         — raw comms record (new — drives transmission panel)
  • MESSAGE_JOURNEY    — real backend pipeline trace (new — drives journey bar)
  • STALENESS_TICK     — periodic twin staleness sweep (unchanged)
  • INIT_SNAPSHOT      — on WS connect (unchanged)
"""

import json
import time
import asyncio
from typing import List, Dict
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.config import settings
from app.schemas.telemetry import TelemetryEvent
from app.schemas.decision import SafetyDecision, RiskAssessment, ModelExplainability
from app.schemas.twin import VehicleTwin, FleetStateResponse
from app.decision.engine import decision_engine
from app.twin.store import twin_store
from app.intelligence.model import risk_model
from app.storage.db import log_telemetry, log_decision, get_recent_decisions

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="V2V Intelligent Cooperative Collision Prevention System — Backend Service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket connection manager
# ─────────────────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for dead_conn in disconnected:
            self.disconnect(dead_conn)


ws_manager = ConnectionManager()


# ─────────────────────────────────────────────────────────────────────────────
# Startup: staleness daemon
# ─────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    async def staleness_daemon():
        while True:
            await asyncio.sleep(1.0)
            now_ms = int(time.time() * 1000)
            twin_store.update_staleness(now_ms)
            twins = twin_store.get_all_twins()
            if twins:
                await ws_manager.broadcast({
                    "type": "STALENESS_TICK",
                    "timestamp": now_ms,
                    "vehicles": [t.dict() for t in twins],
                })

    asyncio.create_task(staleness_daemon())


# ─────────────────────────────────────────────────────────────────────────────
# Helper: build V2V_PACKET event from telemetry + decision
# ─────────────────────────────────────────────────────────────────────────────

def _build_v2v_packet_event(event: TelemetryEvent, decision: SafetyDecision) -> dict:
    """
    Constructs the V2V_PACKET WebSocket event that drives the transmission panel.
    Includes actual telemetry values so the panel can show:
      "V001 transmitted BRAKE_ALERT, speed 52.6 km/h, accel -5.2 m/s²"
    """
    v = event.vehicle
    r = event.receiver
    packet_id = f"{v.vehicle_id}-{v.seq}"

    return {
        "type": "V2V_PACKET",
        "packet": {
            "id": packet_id,
            "sender_id": v.vehicle_id,
            "receiver_id": event.receiver_id,
            "msg_type": event.msg_type,
            "seq": v.seq,
            # Actual telemetry being transmitted (key demo value)
            "speed_mps": round(v.speed_mps, 2),
            "speed_kmh": round(v.speed_mps * 3.6, 1),
            "accel_mps2": round(v.accel.x, 2),
            "distance_m": round(v.distance_to_obstacle_m, 1),
            "event_flag": v.event_flag,
            # LoRa link quality
            "rssi": r.rssi,
            "snr": r.snr,
            "latency_ms": r.latency_ms,
            "payload_size_bytes": 64,           # fixed ESP32 frame size
            "timestamp": v.timestamp,
            "status": "DELIVERED",              # DROPPED only if a future packet_loss scenario
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Helper: build MESSAGE_JOURNEY event from pipeline trace
# ─────────────────────────────────────────────────────────────────────────────

def _build_message_journey_event(
    event: TelemetryEvent, pipeline_trace: list
) -> dict:
    """
    Constructs the MESSAGE_JOURNEY WebSocket event that drives the
    pipeline bar. All timing values come from real perf_counter_ns()
    measurements in the decision engine — never from frontend timers.
    """
    v = event.vehicle
    return {
        "type": "MESSAGE_JOURNEY",
        "event_id": f"{v.vehicle_id}-{v.seq}",
        "sender_id": v.vehicle_id,
        "receiver_id": event.receiver_id,
        "msg_type": event.msg_type,
        "steps": pipeline_trace,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/telemetry — canonical ingestion endpoint
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/telemetry", response_model=Dict)
async def ingest_telemetry(payload: Dict, background_tasks: BackgroundTasks):
    """
    Ingests vehicle telemetry from synthetic simulator or real ESP32 USB gateway.
    Validates schema, computes TTC/risk via ML, generates Safety Decision &
    Reason Codes, syncs Digital Twin, and broadcasts three WebSocket events.
    """
    # Accept legacy single-level format by wrapping into canonical envelope
    if "vehicle" not in payload and "vehicle_id" in payload:
        payload = {
            "msg_type": payload.get("msg_type", "HEARTBEAT"),
            "receiver_id": payload.get("receiver_id", None),
            "vehicle": {
                "vehicle_id": payload.get("vehicle_id"),
                "seq": payload.get("seq", 1),
                "timestamp": payload.get("timestamp", int(time.time() * 1000)),
                "position": payload.get("position", {"x": 10.0, "y": 100.0}),
                "speed_mps": payload.get("speed_mps", 0.0),
                "heading_deg": payload.get("heading_deg", 90.0),
                "accel": payload.get("accel", {"x": 0.0, "y": 0.0, "z": 9.8}),
                "gyro": payload.get("gyro", {"x": 0.0, "y": 0.0, "z": 0.0}),
                "distance_to_obstacle_m": payload.get("distance_to_obstacle_m", 999.0),
                "event_flag": payload.get("event_flag", "none"),
                "crc": payload.get("crc", "0x4A8F"),
            },
            "receiver": {
                "rssi": payload.get("rssi", -72.0),
                "snr": payload.get("snr", 8.5),
                "packet_loss_pct": payload.get("packet_loss_pct", 0.0),
                "latency_ms": payload.get("latency_ms", 45.0),
                "source": payload.get("source", "SIMULATED"),
            },
        }

    try:
        event = TelemetryEvent(**payload)
    except ValidationError as ve:
        raise HTTPException(status_code=422, detail=f"Telemetry validation error: {ve.errors()}")

    all_telemetry_map = twin_store.get_latest_telemetry_map()

    # ── Level 2 (Intelligence) + Level 3 (Decision) ──────────────────────
    primary_decision, risk_assessment, pipeline_trace = decision_engine.process_telemetry(
        event, all_telemetry_map
    )

    # ── Level 5 — Digital Twin Update ────────────────────────────────────
    twin = twin_store.update_twin(event, primary_decision)

    # ── Async DB Logging ──────────────────────────────────────────────────
    v = event.vehicle
    background_tasks.add_task(
        log_telemetry,
        json.dumps(payload),
        v.vehicle_id,
        v.timestamp,
        "civilian",
        "L1",
        v.position.x,
        v.position.y,
        v.speed_mps,
        v.heading_deg,
        v.event_flag,
    )
    background_tasks.add_task(
        log_decision,
        primary_decision.vehicle_id,
        primary_decision.timestamp,
        primary_decision.decision_type,
        primary_decision.priority,
        primary_decision.triggering_rule,
        primary_decision.risk_score,
        primary_decision.ttc,
        primary_decision.rationale,
    )

    # ── WebSocket Broadcasts ──────────────────────────────────────────────

    # 1. TELEMETRY_UPDATE — existing format (unchanged shape, no frontend breakage)
    telemetry_update_msg = {
        "type": "TELEMETRY_UPDATE",
        "timestamp": v.timestamp,
        "vehicle": twin.dict(),
        "primary_decision": primary_decision.dict(),
        "risk_assessment": risk_assessment.dict(),
        "all_vehicles": [t.dict() for t in twin_store.get_all_twins()],
    }

    # 2. V2V_PACKET — raw comms record (drives transmission panel)
    v2v_packet_msg = _build_v2v_packet_event(event, primary_decision)

    # 3. MESSAGE_JOURNEY — real pipeline trace (drives journey bar)
    journey_msg = _build_message_journey_event(event, pipeline_trace)

    background_tasks.add_task(ws_manager.broadcast, telemetry_update_msg)
    background_tasks.add_task(ws_manager.broadcast, v2v_packet_msg)
    background_tasks.add_task(ws_manager.broadcast, journey_msg)

    return {
        "status": "success",
        "vehicle_id": v.vehicle_id,
        "msg_type": event.msg_type,
        "risk_score": primary_decision.risk_score,
        "decision_type": primary_decision.decision_type,
        "reasons": primary_decision.reasons,
        "v2v_early_warning_gain_s": primary_decision.v2v_early_warning_gain_s,
    }


# ─────────────────────────────────────────────────────────────────────────────
# REST Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/vehicles", response_model=FleetStateResponse)
async def get_vehicles():
    twins = twin_store.get_all_twins()
    now_ms = int(time.time() * 1000)
    return FleetStateResponse(
        vehicles=twins,
        timestamp=now_ms,
        active_count=len(twins),
    )


@app.get("/api/decisions")
async def get_decisions(limit: int = 50):
    return get_recent_decisions(limit)


@app.get("/api/model/explain", response_model=ModelExplainability)
async def explain_model():
    return risk_model.get_explainability()


@app.post("/api/scenario/trigger/{scenario_name}")
async def trigger_scenario(scenario_name: str):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.post(f"http://localhost:8001/sim/scenario/{scenario_name}")
            return res.json()
    except Exception:
        return {"status": "triggered_local", "active_scenario": scenario_name}


@app.post("/api/sim/start")
async def start_sim():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.post("http://localhost:8001/sim/start")
            return res.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/sim/pause")
async def pause_sim():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.post("http://localhost:8001/sim/pause")
            return res.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/sim/reset")
async def reset_sim():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.post("http://localhost:8001/sim/reset")
            return res.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/sim/status")
async def get_sim_status():
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get("http://localhost:8001/sim/status")
            return res.json()
    except Exception:
        return {"is_running": True, "is_paused": False, "active_scenario": "full_demo", "current_phase": "Online"}


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "active_vehicles": len(twin_store.get_all_twins()),
        "model_loaded": risk_model.model is not None,
        "model_version": risk_model.version,
    }


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket endpoint
# ─────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        twins = twin_store.get_all_twins()
        await websocket.send_json({
            "type": "INIT_SNAPSHOT",
            "timestamp": int(time.time() * 1000),
            "all_vehicles": [t.dict() for t in twins],
        })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
