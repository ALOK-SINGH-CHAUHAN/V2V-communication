import os
import sqlite3
import json
from typing import List, Dict

DB_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(DB_DIR, "v2v_events.db")

def init_db():
    """Initializes SQLite tables for telemetry, risk, and decision persistence."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        vehicle_type TEXT,
        lane_id TEXT,
        x REAL,
        y REAL,
        speed_mps REAL,
        heading_deg REAL,
        event_flag TEXT,
        raw_json TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS decision_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        decision_type TEXT NOT NULL,
        priority INTEGER NOT NULL,
        triggering_rule TEXT NOT NULL,
        risk_score REAL NOT NULL,
        ttc REAL NOT NULL,
        rationale TEXT NOT NULL
    );
    """)

    conn.commit()
    conn.close()

def log_telemetry(raw_json_str: str, vehicle_id: str, timestamp: int, v_type: str, lane_id: str, x: float, y: float, speed: float, heading: float, event_flag: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO telemetry_logs (vehicle_id, timestamp, vehicle_type, lane_id, x, y, speed_mps, heading_deg, event_flag, raw_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (vehicle_id, timestamp, v_type, lane_id, x, y, speed, heading, event_flag, raw_json_str)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"SQLite Telemetry Log Error: {e}")

def log_decision(vehicle_id: str, timestamp: int, d_type: str, priority: int, rule: str, risk_score: float, ttc: float, rationale: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO decision_logs (vehicle_id, timestamp, decision_type, priority, triggering_rule, risk_score, ttc, rationale)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (vehicle_id, timestamp, d_type, priority, rule, risk_score, ttc, rationale)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"SQLite Decision Log Error: {e}")

def get_recent_decisions(limit: int = 50) -> List[Dict]:
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM decision_logs ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"SQLite Read Error: {e}")
        return []

init_db()
