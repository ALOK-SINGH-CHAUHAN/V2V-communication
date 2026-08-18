"use client";

/**
 * PresentationContext — SIH Demo Mode
 *
 * Sits between FleetContext (live 10Hz) and the UI components.
 * Controls the pace at which safety event stages are revealed to the audience.
 *
 * LIVE mode:  pure passthrough — no staging, zero latency added.
 * AUTO mode:  auto-advances through stages based on real data triggers + min duration.
 * STEP mode:  presenter clicks [NEXT] to advance each stage manually.
 *
 * No backend changes. No fake data. All telemetry is from the live pipeline.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useFleet } from "@/context/FleetContext";
import { VehicleTwin, SafetyDecision, V2VPacket, MessageJourney } from "@/types";

// ─── Stage definitions ────────────────────────────────────────────────────────

export type PresentationStage =
  | "NORMAL"
  | "BRAKE_DETECTED"
  | "PACKET_TRANSMITTED"
  | "PACKET_RECEIVED"
  | "TTC_COMPUTED"
  | "EARLY_WARNING"
  | "HIGH_RISK"
  | "IMMEDIATE_ALERT"
  | "VEHICLE_RESPONSE"
  | "RISK_RESOLVED"
  | "COMMUNICATION_LOST";

export type PresentationMode = "LIVE" | "AUTO" | "STEP";
export type PresentationSpeed = 0.5 | 1 | 2;

interface StageConfig {
  label: string;
  description: string;
  /** Minimum milliseconds to hold this stage at 1× speed in AUTO mode */
  minDurationMs: number;
  /** Accent color */
  color: string;
}

const STAGE_CONFIG: Record<PresentationStage, StageConfig> = {
  NORMAL: {
    label: "NORMAL TELEMETRY",
    description: "Fleet operating normally. Heartbeat telemetry flowing via LoRa.",
    minDurationMs: 3000,
    color: "#22c55e",
  },
  BRAKE_DETECTED: {
    label: "BRAKE DETECTED",
    description: "V001 sudden deceleration detected. V2V safety message being composed.",
    minDurationMs: 1500,
    color: "#f97316",
  },
  PACKET_TRANSMITTED: {
    label: "LoRa TRANSMISSION",
    description: "BRAKE_ALERT packet transmitted over LoRa 915MHz. Propagating to V002.",
    minDurationMs: 1500,
    color: "#f97316",
  },
  PACKET_RECEIVED: {
    label: "PACKET RECEIVED",
    description: "V002 received BRAKE_ALERT via LoRa. Backend pipeline begins processing.",
    minDurationMs: 1200,
    color: "#38bdf8",
  },
  TTC_COMPUTED: {
    label: "TTC COMPUTED",
    description: "Time-To-Collision calculated from relative kinematics. Risk engine triggered.",
    minDurationMs: 2000,
    color: "#a78bfa",
  },
  EARLY_WARNING: {
    label: "EARLY WARNING",
    description: "TTC entering caution threshold. ML risk score elevated. System watching closely.",
    minDurationMs: 3000,
    color: "#eab308",
  },
  HIGH_RISK: {
    label: "HIGH RISK",
    description: "TTC critically low. ML risk score above threshold. Safety rule engine engaged.",
    minDurationMs: 3000,
    color: "#f97316",
  },
  IMMEDIATE_ALERT: {
    label: "IMMEDIATE ALERT",
    description: "Collision imminent. Safety rule: BRAKE IMMEDIATELY. Alert issued to V002 driver.",
    minDurationMs: 2000,
    color: "#ef4444",
  },
  VEHICLE_RESPONSE: {
    label: "VEHICLE RESPONSE",
    description: "V002 applying brakes in response to alert. TTC beginning to recover.",
    minDurationMs: 3000,
    color: "#fb923c",
  },
  RISK_RESOLVED: {
    label: "RISK RESOLVED",
    description: "V2V intervention successful. Safe following distance restored. Risk normalising.",
    minDurationMs: 3000,
    color: "#22c55e",
  },
  COMMUNICATION_LOST: {
    label: "COMMUNICATION LOST",
    description: "LoRa link to V001 lost. Telemetry unavailable. System in degraded state.",
    minDurationMs: 99999,
    color: "#ef4444",
  },
};

export const STAGE_ORDER: PresentationStage[] = [
  "NORMAL",
  "BRAKE_DETECTED",
  "PACKET_TRANSMITTED",
  "PACKET_RECEIVED",
  "TTC_COMPUTED",
  "EARLY_WARNING",
  "HIGH_RISK",
  "IMMEDIATE_ALERT",
  "VEHICLE_RESPONSE",
  "RISK_RESOLVED",
];

// ─── Context shape ────────────────────────────────────────────────────────────

export interface PresentedState {
  vehicles: VehicleTwin[];
  decisions: SafetyDecision[];
  alertPacket: V2VPacket | null;
  latestJourney: MessageJourney | null;
  riskScore: number;
  ttc: number;
}

interface PresentationContextType {
  mode: PresentationMode;
  speed: PresentationSpeed;
  currentStage: PresentationStage;
  stageConfig: StageConfig;
  nextStagePending: boolean;        // STEP: lights up NEXT button
  stageExplanation: string[];       // WHY RISK CHANGED — from real telemetry
  presented: PresentedState;        // What UI should display (live or staged)
  setMode: (mode: PresentationMode) => void;
  setSpeed: (speed: PresentationSpeed) => void;
  advanceStage: () => void;         // STEP: manual advance
  beamDurationMs: number;           // For LoRa animation duration
}

const PresentationContext = createContext<PresentationContextType | undefined>(undefined);

// ─── WHY explanation generator ────────────────────────────────────────────────

function deriveExplanations(
  stage: PresentationStage,
  vehicles: VehicleTwin[],
  decisions: SafetyDecision[],
  alertPacket: V2VPacket | null
): string[] {
  const v1 = vehicles.find((v) => v.vehicle_id === "V001");
  const v2 = vehicles.find((v) => v.vehicle_id === "V002");
  const dec = decisions[0];
  const reasons: string[] = [];

  switch (stage) {
    case "BRAKE_DETECTED":
      if (v1 && v1.last_accel_x < -1.5)
        reasons.push(`V001 deceleration: ${v1.last_accel_x.toFixed(2)} m/s²`);
      if (v1)
        reasons.push(`V001 speed: ${(v1.last_speed_mps * 3.6).toFixed(1)} km/h`);
      reasons.push("Sudden Hard Brake event flag set");
      break;

    case "PACKET_TRANSMITTED":
      if (alertPacket) {
        reasons.push(`Message type: ${alertPacket.msg_type}`);
        reasons.push(`LoRa RSSI: ${alertPacket.rssi.toFixed(0)} dBm`);
        reasons.push(`Air-time latency: ${alertPacket.latency_ms.toFixed(0)} ms`);
        reasons.push(`SEQ #${alertPacket.seq} · CRC verified`);
      }
      break;

    case "PACKET_RECEIVED":
      if (alertPacket) {
        reasons.push(`BRAKE_ALERT received by V002`);
        reasons.push(`Sender: ${alertPacket.sender_id} · Receiver: ${alertPacket.receiver_id ?? "BROADCAST"}`);
        reasons.push(`Signal SNR: ${alertPacket.snr.toFixed(1)} dB`);
      }
      break;

    case "TTC_COMPUTED":
      if (v2 && v2.last_ttc < 900)
        reasons.push(`TTC: ${v2.last_ttc.toFixed(2)}s`);
      if (v1 && v2) {
        const relSpeed = v1.last_speed_mps - v2.last_speed_mps;
        if (relSpeed < -0.5)
          reasons.push(`Closing speed: ${Math.abs(relSpeed * 3.6).toFixed(1)} km/h`);
      }
      reasons.push("TTC computed from relative kinematics");
      break;

    case "EARLY_WARNING":
      if (v2) reasons.push(`Risk score: ${v2.last_risk_score.toFixed(0)}/100`);
      if (v2 && v2.last_ttc < 900) reasons.push(`TTC: ${v2.last_ttc.toFixed(1)}s (caution zone)`);
      if (dec?.reasons) dec.reasons.slice(0, 2).forEach((r) => reasons.push(r));
      break;

    case "HIGH_RISK":
      if (v2) reasons.push(`Risk score: ${v2.last_risk_score.toFixed(0)}/100 (high threshold crossed)`);
      if (v2 && v2.last_ttc < 900) reasons.push(`TTC ↓: ${v2.last_ttc.toFixed(1)}s`);
      if (dec?.triggering_rule) reasons.push(`Rule: ${dec.triggering_rule}`);
      if (dec?.reasons) dec.reasons.slice(0, 2).forEach((r) => reasons.push(r));
      break;

    case "IMMEDIATE_ALERT":
      if (v2) reasons.push(`Risk score: ${v2.last_risk_score.toFixed(0)}/100`);
      if (v2 && v2.last_ttc < 900) reasons.push(`TTC: ${v2.last_ttc.toFixed(1)}s — CRITICAL`);
      reasons.push("Safety rule: IMMEDIATE_ALERT triggered");
      reasons.push("Action: BRAKE IMMEDIATELY");
      break;

    case "VEHICLE_RESPONSE":
      if (v2 && v2.last_accel_x < -0.5)
        reasons.push(`V002 braking: ${v2.last_accel_x.toFixed(2)} m/s²`);
      if (v2 && v2.last_ttc < 900)
        reasons.push(`TTC recovering: ${v2.last_ttc.toFixed(1)}s`);
      if (v2) reasons.push(`Risk: ${v2.last_risk_score.toFixed(0)}/100 (decreasing)`);
      break;

    case "RISK_RESOLVED":
      if (v2 && v2.last_ttc < 900)
        reasons.push(`TTC restored: ${v2.last_ttc.toFixed(1)}s`);
      if (v2) reasons.push(`Risk score: ${v2.last_risk_score.toFixed(0)}/100`);
      if (dec?.v2v_early_warning_gain_s && dec.v2v_early_warning_gain_s > 0)
        reasons.push(`V2V early warning advantage: +${dec.v2v_early_warning_gain_s.toFixed(1)}s`);
      reasons.push("Collision prevented by V2V cooperative safety");
      break;

    case "COMMUNICATION_LOST":
      reasons.push("LoRa link to V001 timed out");
      reasons.push("Last known state preserved");
      reasons.push("Risk assessment suspended — telemetry unavailable");
      break;

    default:
      break;
  }

  return reasons;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const PresentationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fleet = useFleet();

  const [mode, setModeState] = useState<PresentationMode>("AUTO");
  const [speed, setSpeedState] = useState<PresentationSpeed>(1);
  const [currentStage, setCurrentStage] = useState<PresentationStage>("NORMAL");
  const [nextStagePending, setNextStagePending] = useState(false);

  // Snapshot of fleet state frozen at the time we entered the current stage
  const [presented, setPresented] = useState<PresentedState>({
    vehicles: [],
    decisions: [],
    alertPacket: null,
    latestJourney: null,
    riskScore: 0,
    ttc: 999,
  });

  // Track last time we advanced a stage
  const stageEnteredAtRef = useRef<number>(Date.now());
  // Track what stage is queued next based on real data
  const pendingStageRef = useRef<PresentationStage | null>(null);
  // Track peak risk to detect VEHICLE_RESPONSE
  const peakRiskRef = useRef<number>(0);
  // Track if we've seen alert in this cycle
  const alertCycleRef = useRef<string | null>(null);

  const setMode = useCallback((m: PresentationMode) => {
    setModeState(m);
    if (m === "LIVE") {
      // Reset staging — pass everything through
      setCurrentStage("NORMAL");
      setNextStagePending(false);
      pendingStageRef.current = null;
    }
  }, []);

  const setSpeed = useCallback((s: PresentationSpeed) => {
    setSpeedState(s);
  }, []);

  // ── Stage advancement ─────────────────────────────────────────────────────

  const commitStage = useCallback(
    (stage: PresentationStage, fleetSnapshot: typeof fleet) => {
      setCurrentStage(stage);
      stageEnteredAtRef.current = Date.now();
      setNextStagePending(false);
      pendingStageRef.current = null;

      const v2 = fleetSnapshot.vehicles.find((v) => v.vehicle_id === "V002");
      setPresented({
        vehicles: fleetSnapshot.vehicles,
        decisions: fleetSnapshot.decisions,
        alertPacket: fleetSnapshot.alertPacket,
        latestJourney: fleetSnapshot.latestJourney,
        riskScore: v2?.last_risk_score ?? 0,
        ttc: v2?.last_ttc ?? 999,
      });
    },
    []
  );

  const advanceStage = useCallback(() => {
    if (pendingStageRef.current) {
      commitStage(pendingStageRef.current, fleet);
    }
  }, [commitStage, fleet]);

  // ── Data-driven stage trigger logic ──────────────────────────────────────

  useEffect(() => {
    if (mode === "LIVE") return;

    const v1 = fleet.vehicles.find((v) => v.vehicle_id === "V001");
    const v2 = fleet.vehicles.find((v) => v.vehicle_id === "V002");
    const dec = fleet.decisions[0];
    const isCommLost = v1?.connectivity_status === "COMMUNICATION_LOST";

    // Track peak risk for VEHICLE_RESPONSE detection
    if (v2 && v2.last_risk_score > peakRiskRef.current) {
      peakRiskRef.current = v2.last_risk_score;
    }

    // Determine what stage real data suggests we should be in
    let suggestedStage: PresentationStage = "NORMAL";

    if (isCommLost) {
      suggestedStage = "COMMUNICATION_LOST";
    } else if (
      dec?.decision_type === "SAFE" &&
      currentStage !== "NORMAL" &&
      peakRiskRef.current > 50
    ) {
      suggestedStage = "RISK_RESOLVED";
    } else if (
      v2 &&
      peakRiskRef.current > 60 &&
      v2.last_risk_score < peakRiskRef.current - 15 &&
      (currentStage === "IMMEDIATE_ALERT" || currentStage === "HIGH_RISK")
    ) {
      suggestedStage = "VEHICLE_RESPONSE";
    } else if (dec?.decision_type === "IMMEDIATE_ALERT") {
      suggestedStage = "IMMEDIATE_ALERT";
    } else if (dec?.decision_type === "HIGH_RISK") {
      suggestedStage = "HIGH_RISK";
    } else if (dec?.decision_type === "EARLY_WARNING") {
      // Check whether we've already seen the packet journey
      if (
        currentStage === "TTC_COMPUTED" ||
        currentStage === "PACKET_RECEIVED" ||
        currentStage === "PACKET_TRANSMITTED" ||
        currentStage === "BRAKE_DETECTED" ||
        currentStage === "EARLY_WARNING"
      ) {
        suggestedStage = "EARLY_WARNING";
      } else {
        suggestedStage = "EARLY_WARNING";
      }
    } else if (fleet.latestJourney && fleet.latestJourney.msg_type === "BRAKE_ALERT") {
      // Journey trace means packet is processed
      if (
        currentStage === "BRAKE_DETECTED" ||
        currentStage === "PACKET_TRANSMITTED" ||
        currentStage === "PACKET_RECEIVED"
      ) {
        suggestedStage = "TTC_COMPUTED";
      } else if (currentStage === "TTC_COMPUTED") {
        suggestedStage = "TTC_COMPUTED";
      } else {
        suggestedStage = "TTC_COMPUTED";
      }
    } else if (
      fleet.alertPacket &&
      fleet.alertPacket.msg_type === "BRAKE_ALERT" &&
      fleet.alertPacket.id !== alertCycleRef.current
    ) {
      // New BRAKE_ALERT packet arrived — this is a new cycle
      alertCycleRef.current = fleet.alertPacket.id;
      peakRiskRef.current = 0; // reset for new cycle
      if (currentStage === "NORMAL" || currentStage === "RISK_RESOLVED") {
        suggestedStage = "BRAKE_DETECTED";
      } else if (currentStage === "BRAKE_DETECTED") {
        suggestedStage = "PACKET_TRANSMITTED";
      } else {
        suggestedStage = currentStage;
      }
    } else if (
      fleet.alertPacket &&
      fleet.alertPacket.msg_type === "BRAKE_ALERT" &&
      (currentStage === "BRAKE_DETECTED" || currentStage === "PACKET_TRANSMITTED")
    ) {
      suggestedStage = "PACKET_RECEIVED";
    }

    // Only consider advancing if it's actually a forward movement
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const suggestedIdx = STAGE_ORDER.indexOf(suggestedStage);

    if (suggestedIdx <= currentIdx && suggestedStage !== "COMMUNICATION_LOST") return;
    if (suggestedStage === currentStage) return;

    const minDuration = STAGE_CONFIG[currentStage].minDurationMs / speed;
    const elapsed = Date.now() - stageEnteredAtRef.current;

    if (mode === "STEP") {
      // Queue it for manual advancement
      if (pendingStageRef.current !== suggestedStage) {
        pendingStageRef.current = suggestedStage;
        setNextStagePending(true);
      }
    } else if (mode === "AUTO") {
      if (elapsed >= minDuration) {
        commitStage(suggestedStage, fleet);
      } else {
        // Wait for min duration, then commit
        if (pendingStageRef.current !== suggestedStage) {
          pendingStageRef.current = suggestedStage;
          const remaining = minDuration - elapsed;
          setTimeout(() => {
            if (pendingStageRef.current === suggestedStage) {
              commitStage(suggestedStage, fleet);
            }
          }, remaining);
        }
      }
    }
  }, [
    fleet.vehicles,
    fleet.decisions,
    fleet.alertPacket,
    fleet.latestJourney,
    mode,
    speed,
    currentStage,
    commitStage,
  ]);

  // ── Reset when scenario changes ───────────────────────────────────────────
  useEffect(() => {
    setCurrentStage("NORMAL");
    setNextStagePending(false);
    pendingStageRef.current = null;
    peakRiskRef.current = 0;
    alertCycleRef.current = null;
    stageEnteredAtRef.current = Date.now();
  }, [fleet.activeScenario]);

  // ── In LIVE mode: presented = live fleet state ────────────────────────────
  const v2Live = fleet.vehicles.find((v) => v.vehicle_id === "V002");
  const livePresentedState: PresentedState = useMemo(() => ({
    vehicles: fleet.vehicles,
    decisions: fleet.decisions,
    alertPacket: fleet.alertPacket,
    latestJourney: fleet.latestJourney,
    riskScore: v2Live?.last_risk_score ?? 0,
    ttc: v2Live?.last_ttc ?? 999,
  }), [fleet.vehicles, fleet.decisions, fleet.alertPacket, fleet.latestJourney, v2Live]);

  // ── Explanations from live telemetry ────────────────────────────────────
  const stageExplanation = useMemo(
    () =>
      deriveExplanations(currentStage, fleet.vehicles, fleet.decisions, fleet.alertPacket),
    [currentStage, fleet.vehicles, fleet.decisions, fleet.alertPacket]
  );

  const displayedPresented = mode === "LIVE" ? livePresentedState : presented;

  const beamDurationMs = mode === "LIVE" ? 700 : Math.round(1300 / speed);

  return (
    <PresentationContext.Provider
      value={{
        mode,
        speed,
        currentStage,
        stageConfig: STAGE_CONFIG[currentStage],
        nextStagePending,
        stageExplanation,
        presented: displayedPresented,
        setMode,
        setSpeed,
        advanceStage,
        beamDurationMs,
      }}
    >
      {children}
    </PresentationContext.Provider>
  );
};

export const usePresentationContext = () => {
  const ctx = useContext(PresentationContext);
  if (!ctx) throw new Error("usePresentationContext must be used within PresentationProvider");
  return ctx;
};
