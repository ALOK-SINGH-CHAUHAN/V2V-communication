"""
V2V Cooperative Collision Prevention — Synthetic Scenario Engine
=================================================================
Produces physics-driven telemetry payloads matching the ESP32 hardware wire format.

Supported Scenarios:
  1. full_demo          — Auto Full Demo Sequence covering all 5 situations (30s cycle)
  2. normal_cruising    — Baseline safe multi-vehicle flow (gap ~120m, speed ~55 km/h)
  3. hard_brake         — Sudden hard brake with V2V alert & V002 response (20s cycle)
  4. communication_loss — Telemetry link timeout with progressive signal decay
"""

import math
import time
from typing import List, Dict, Optional, Tuple


class VehicleSimState:
    def __init__(
        self,
        vehicle_id: str,
        x: float,
        y: float,
        speed_mps: float,
        heading_deg: float,
    ):
        self.vehicle_id = vehicle_id
        self.x = x
        self.y = y
        self.speed_mps = speed_mps
        self.base_speed = speed_mps          # cruise speed
        self.heading_deg = heading_deg
        self.accel_x = 0.0
        self.accel_y = 0.0
        self.accel_z = 9.81
        self.gyro_z = 0.0
        self.distance_to_obstacle_m = 999.0
        self.event_flag = "none"
        self.seq = 1


def get_initial_fleet() -> Dict[str, VehicleSimState]:
    """V001 leads at 55 km/h (15.3 m/s), V002 follows 120m behind at 57 km/h (15.8 m/s)."""
    return {
        "V001": VehicleSimState("V001", 10.0, 220.0, 15.3, 90.0),  # leader ahead
        "V002": VehicleSimState("V002", 10.0, 100.0, 15.8, 90.0),  # follower behind
    }


def _inter_vehicle_distance(v1: VehicleSimState, v2: VehicleSimState) -> float:
    dx = v2.x - v1.x
    dy = v2.y - v1.y
    return math.sqrt(dx * dx + dy * dy)


def _link_quality(phase: str, signal_factor: float = 1.0) -> dict:
    """Returns realistic LoRa link metrics with optional degradation."""
    profiles = {
        "normal":     {"rssi": -72.0 * signal_factor, "snr": 8.5 * signal_factor, "packet_loss_pct": 0.0,  "latency_ms": 43.0},
        "brake":      {"rssi": -78.0, "snr": 6.1, "packet_loss_pct": 0.5,  "latency_ms": 52.0},
        "alert_peak": {"rssi": -82.0, "snr": 4.8, "packet_loss_pct": 1.2,  "latency_ms": 61.0},
        "response":   {"rssi": -75.0, "snr": 7.0, "packet_loss_pct": 0.3,  "latency_ms": 48.0},
        "degraded":   {"rssi": -89.0, "snr": 2.1, "packet_loss_pct": 15.0, "latency_ms": 120.0},
    }
    return profiles.get(phase, profiles["normal"])


def _build_payload(
    v: VehicleSimState,
    receiver_id: Optional[str],
    msg_type: str,
    link: dict,
    source: str = "SIMULATED",
) -> dict:
    """Assembles canonical V2V packet matching the ESP32 wire format."""
    return {
        "msg_type": msg_type,
        "receiver_id": receiver_id,
        "vehicle": {
            "vehicle_id": v.vehicle_id,
            "seq": v.seq,
            "timestamp": int(time.time() * 1000),
            "position": {"x": round(v.x, 2), "y": round(v.y, 2)},
            "speed_mps": round(v.speed_mps, 2),
            "heading_deg": round(v.heading_deg, 1),
            "accel": {
                "x": round(v.accel_x, 3),
                "y": round(v.accel_y, 3),
                "z": round(v.accel_z, 2),
            },
            "gyro": {"x": 0.0, "y": 0.0, "z": round(v.gyro_z, 3)},
            "distance_to_obstacle_m": round(v.distance_to_obstacle_m, 1),
            "event_flag": v.event_flag,
            "crc": "0x4A8F",
        },
        "receiver": {
            "rssi": link["rssi"],
            "snr": link["snr"],
            "packet_loss_pct": link["packet_loss_pct"],
            "latency_ms": link["latency_ms"],
            "source": source,
        },
    }


def update_scenario_step(
    fleet: Dict[str, VehicleSimState],
    step: int,
    scenario_name: str,
) -> Tuple[List[dict], str]:
    dt = 0.10           # 10 Hz
    t_sec = step * dt

    v1 = fleet["V001"]
    v2 = fleet["V002"]

    # ── 1. Full Interactive Demo Sequence (30s complete loop) ───────────────
    if scenario_name == "full_demo":
        t_phase = t_sec % 30.0

        if t_phase < 5.0:
            # Phase 1: Normal Cruising
            phase_desc = "Phase 1/5: Normal Traffic Cruising (Safe Gap ~120m & Heartbeat Stream)"
            v1.speed_mps = 15.3
            v2.speed_mps = 15.8
            v1.accel_x = 0.0
            v2.accel_x = 0.0
            v1.event_flag = "heartbeat"
            v2.event_flag = "heartbeat"
            link = _link_quality("normal")
            v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"
            send_v1 = True

        elif t_phase < 10.0:
            # Phase 2: Sudden Hard Brake
            phase_desc = "Phase 2/5: Sudden Hard Brake — BRAKE_ALERT Transmitted over LoRa"
            v1.accel_x = -6.5
            v1.speed_mps = max(0.0, v1.speed_mps - 6.5 * dt)
            v1.event_flag = "brake"
            v2.accel_x = 0.0
            v2.event_flag = "heartbeat"
            link = _link_quality("brake")
            # Strict Phase Rule: EMERGENCY_ALERT ONLY in peak danger (t > 8.5s)
            v1_msg = "EMERGENCY_ALERT" if t_phase > 8.5 else "BRAKE_ALERT"
            v2_msg = "HEARTBEAT"
            send_v1 = True

        elif t_phase < 16.0:
            # Phase 3: Coordinated Reaction & Resolution
            phase_desc = "Phase 3/5: Coordinated V002 Response — Risk Resolving & Collision Avoided"
            v1.accel_x = 0.0
            v1.speed_mps = max(0.0, v1.speed_mps)
            v1.event_flag = "heartbeat"
            v2.accel_x = -5.0
            v2.speed_mps = max(0.0, v2.speed_mps - 5.0 * dt)
            v2.event_flag = "brake"
            link = _link_quality("response")
            v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"
            send_v1 = True

        elif t_phase < 23.0:
            # Phase 4: Communication Loss (Progressive decay -> Timeout)
            phase_desc = "Phase 4/5: Communication Loss — V001 Link Degrading → COMM_LOST"
            v1.speed_mps = min(15.3, v1.speed_mps + 1.0 * dt)
            v2.speed_mps = min(15.8, v2.speed_mps + 1.0 * dt)
            v1.accel_x = 0.0
            v2.accel_x = 0.0
            v1.event_flag = "none"
            v2.event_flag = "heartbeat"
            
            if t_phase < 18.0:
                link = _link_quality("degraded")
                v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"
                send_v1 = True
            else:
                link = _link_quality("normal")
                v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"
                send_v1 = False  # V001 stops transmitting -> Timeout

        else:
            # Phase 5: Re-sync & Normal Cruise
            phase_desc = "Phase 5/5: Fleet Re-sync — LoRa Link Restored & Cruising"
            v1.speed_mps = 15.3
            v2.speed_mps = 15.8
            v1.accel_x = 0.0
            v2.accel_x = 0.0
            v1.event_flag = "heartbeat"
            v2.event_flag = "heartbeat"
            link = _link_quality("normal")
            v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"
            send_v1 = True

        v1.y += v1.speed_mps * dt
        v2.y += v2.speed_mps * dt
        if v1.y > 400.0: v1.y = 0.0
        if v2.y > 400.0: v2.y = 0.0

        dist = _inter_vehicle_distance(v1, v2)
        v1.distance_to_obstacle_m = round(max(0.5, dist), 1)
        v2.distance_to_obstacle_m = round(max(0.5, dist), 1)

        payloads = []
        if send_v1:
            v1.seq += 1
            payloads.append(_build_payload(v1, "V002", v1_msg, link))
        v2.seq += 1
        payloads.append(_build_payload(v2, "V001", v2_msg, link))

        return payloads, phase_desc

    # ── 2. Normal Cruising ────────────────────────────────────────────────
    elif scenario_name == "normal_cruising":
        phase_desc = "Normal Cruising — Safe multi-vehicle flow (V001 55 km/h, V002 57 km/h)"
        v1.speed_mps = 15.3
        v2.speed_mps = 15.8
        v1.accel_x = 0.0
        v2.accel_x = 0.0
        v1.event_flag = "heartbeat"
        v2.event_flag = "heartbeat"

        v1.y += v1.speed_mps * dt
        v2.y += v2.speed_mps * dt
        if v1.y > 400.0: v1.y = 0.0
        if v2.y > 400.0: v2.y = 0.0

        dist = _inter_vehicle_distance(v1, v2)
        v1.distance_to_obstacle_m = round(dist, 1)
        v2.distance_to_obstacle_m = round(dist, 1)

        link = _link_quality("normal")
        payloads = []
        for v in [v1, v2]:
            v.seq += 1
            other = "V002" if v.vehicle_id == "V001" else "V001"
            payloads.append(_build_payload(v, other, "HEARTBEAT", link))

        return payloads, phase_desc

    # ── 3. Hard Brake ─────────────────────────────────────────────────────
    elif scenario_name == "hard_brake":
        t_phase = t_sec % 20.0
        if t_phase < 4.0:
            phase_desc = "Hard Brake Scenario — Normal Cruising"
            v1.speed_mps, v2.speed_mps = 15.3, 15.8
            v1.accel_x, v2.accel_x = 0.0, 0.0
            v1.event_flag, v2.event_flag = "heartbeat", "heartbeat"
            link = _link_quality("normal")
            v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"
        elif t_phase < 10.0:
            phase_desc = "Hard Brake Scenario — V001 Hard Braking (BRAKE_ALERT)"
            v1.accel_x = -6.5
            v1.speed_mps = max(0.0, v1.speed_mps - 6.5 * dt)
            v1.event_flag = "brake"
            v2.accel_x = 0.0
            v2.event_flag = "heartbeat"
            link = _link_quality("brake")
            v1_msg = "EMERGENCY_ALERT" if t_phase > 8.5 else "BRAKE_ALERT"
            v2_msg = "HEARTBEAT"
        elif t_phase < 16.0:
            phase_desc = "Hard Brake Scenario — V002 Brakes & Resolves Risk"
            v1.accel_x = 0.0
            v2.accel_x = -5.0
            v2.speed_mps = max(0.0, v2.speed_mps - 5.0 * dt)
            v2.event_flag = "brake"
            link = _link_quality("response")
            v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"
        else:
            phase_desc = "Hard Brake Scenario — Speed Recovery"
            v1.speed_mps = min(15.3, v1.speed_mps + 1.5 * dt)
            v2.speed_mps = min(15.8, v2.speed_mps + 1.5 * dt)
            v1.accel_x, v2.accel_x = 0.0, 0.0
            link = _link_quality("normal")
            v1_msg, v2_msg = "HEARTBEAT", "HEARTBEAT"

        v1.y += v1.speed_mps * dt
        v2.y += v2.speed_mps * dt
        if v1.y > 400.0: v1.y = 0.0
        if v2.y > 400.0: v2.y = 0.0

        dist = _inter_vehicle_distance(v1, v2)
        v1.distance_to_obstacle_m = round(max(0.5, dist), 1)
        v2.distance_to_obstacle_m = round(max(0.5, dist), 1)

        payloads = []
        for v, msg, other_id in [(v1, v1_msg, "V002"), (v2, v2_msg, "V001")]:
            v.seq += 1
            payloads.append(_build_payload(v, other_id, msg, link))
        return payloads, phase_desc

    # ── 4. Communication Loss ─────────────────────────────────────────────
    elif scenario_name == "communication_loss":
        phase_desc = "Communication Loss Scenario — V001 Link Degrading → Timeout"
        v1.y += v1.speed_mps * dt
        v2.y += v2.speed_mps * dt
        if v1.y > 400.0: v1.y = 0.0
        if v2.y > 400.0: v2.y = 0.0

        dist = _inter_vehicle_distance(v1, v2)
        v1.distance_to_obstacle_m = round(max(0.5, dist), 1)
        v2.distance_to_obstacle_m = round(max(0.5, dist), 1)

        payloads = []
        if t_sec <= 2.0:
            link = _link_quality("normal")
            v1.seq += 1
            v1.event_flag = "heartbeat"
            payloads.append(_build_payload(v1, "V002", "HEARTBEAT", link))
        elif t_sec <= 4.0:
            link = _link_quality("degraded")
            v1.seq += 1
            v1.event_flag = "heartbeat"
            payloads.append(_build_payload(v1, "V002", "HEARTBEAT", link))
        # After 4s, V001 payload stopped to trigger timeout

        v2.seq += 1
        v2.event_flag = "heartbeat"
        link_v2 = _link_quality("normal")
        payloads.append(_build_payload(v2, "V001", "HEARTBEAT", link_v2))

        return payloads, phase_desc

    return [], "Idle"
