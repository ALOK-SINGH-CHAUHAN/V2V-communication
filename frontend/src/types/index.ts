// ─── Core enumerations ────────────────────────────────────────────────────────

export type ConnectivityStatus = "LIVE" | "STALE" | "COMMUNICATION_LOST";

export type DecisionType =
  | "SAFE"
  | "EARLY_WARNING"
  | "HIGH_RISK"
  | "IMMEDIATE_ALERT"
  | "COMMUNICATION_LOST";

/** Top-level canonical V2V message categories (mirrors ESP32 packet format) */
export type MsgType =
  | "HEARTBEAT"
  | "BRAKE_ALERT"
  | "OBSTACLE_ALERT"
  | "EMERGENCY_ALERT";

export type PacketStatus = "DELIVERED" | "DROPPED";

export type TtcTrend = "STABLE" | "CLOSING_SLOWLY" | "RISK_INCREASING_RAPIDLY";

// ─── Geometric / sensor primitives ───────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

// ─── Telemetry schemas ────────────────────────────────────────────────────────

export interface VehiclePayload {
  vehicle_id: string;
  seq: number;
  timestamp: number;
  position: Position;
  speed_mps: number;
  heading_deg: number;
  accel: Vector3D;
  gyro: Vector3D;
  distance_to_obstacle_m: number;
  event_flag: string;
  crc: string;
}

export interface ReceiverMetadata {
  rssi: number;
  snr: number;
  packet_loss_pct: number;
  latency_ms: number;
  source: "LIVE_HARDWARE" | "SIMULATED";
}

export interface TelemetryEvent {
  msg_type: MsgType;          // top-level canonical field
  receiver_id: string | null;
  vehicle: VehiclePayload;
  receiver: ReceiverMetadata;
}

// ─── Decision / risk schemas ──────────────────────────────────────────────────

export interface SafetyDecision {
  vehicle_id: string;
  target_vehicle_id?: string;
  timestamp: number;
  decision_type: DecisionType;
  priority: number;
  triggering_rule: string;
  risk_score: number;
  ttc: number;
  ttc_trend: TtcTrend;
  risk_trend_label?: string;
  reasons: string[];
  rationale: string;
  local_detection_ttc_s: number;
  v2v_detection_ttc_s: number;
  v2v_early_warning_gain_s: number;
}

export interface RiskAssessment {
  vehicle_id: string;
  target_vehicle_id?: string;
  timestamp: number;
  ttc: number;
  risk_score: number;
  model_version: string;
}

// ─── Digital Twin ─────────────────────────────────────────────────────────────

export interface VehicleTwin {
  vehicle_id: string;
  seq: number;
  last_position: Position;
  last_speed_mps: number;
  last_heading_deg: number;
  last_accel_x: number;
  last_risk_score: number;
  last_ttc: number;
  ttc_trend: string;
  last_decision?: SafetyDecision;
  connectivity_status: ConnectivityStatus;
  last_seen: number;
  receiver_meta: ReceiverMetadata;
}

// ─── V2V Packet (transmission panel) ─────────────────────────────────────────

/**
 * Raw comms record emitted by backend as WS type "V2V_PACKET".
 * Contains actual telemetry values so the panel can show:
 *   "V001 transmitted BRAKE_ALERT, speed 52.6 km/h, accel -5.2 m/s²"
 */
export interface V2VPacket {
  id: string;              // e.g. "V001-427"
  sender_id: string;
  receiver_id: string | null;
  msg_type: MsgType;
  seq: number;
  // Actual telemetry being transmitted
  speed_mps: number;
  speed_kmh: number;
  accel_mps2: number;
  distance_m: number;
  event_flag: string;
  // LoRa link quality
  rssi: number;
  snr: number;
  latency_ms: number;
  payload_size_bytes: number;
  timestamp: number;
  status: PacketStatus;
}

// ─── Message Journey (pipeline bar) ──────────────────────────────────────────

/**
 * Single stage in the backend processing pipeline.
 * elapsed_us is measured from real perf_counter_ns() — never a frontend timer.
 */
export interface JourneyStep {
  stage: string;       // e.g. "TTC_COMPUTED"
  label: string;       // e.g. "⏱ TTC Computed"
  value: string;       // e.g. "4.2s"
  elapsed_us: number;  // microseconds since PACKET_RECEIVED
}

/**
 * Full backend-driven pipeline trace emitted as WS type "MESSAGE_JOURNEY".
 */
export interface MessageJourney {
  event_id: string;    // e.g. "V001-427"
  sender_id: string;
  receiver_id: string | null;
  msg_type: MsgType;
  steps: JourneyStep[];
}

// ─── ML explainability ────────────────────────────────────────────────────────

export interface ModelExplainability {
  model_version: string;
  feature_names: string[];
  feature_importances: number[];
}
