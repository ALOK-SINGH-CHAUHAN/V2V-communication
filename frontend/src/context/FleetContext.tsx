"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  VehicleTwin,
  SafetyDecision,
  ModelExplainability,
  V2VPacket,
  MessageJourney,
  MsgType,
} from "@/types";

// ─── Context shape ─────────────────────────────────────────────────────────

interface FleetContextType {
  vehicles: VehicleTwin[];
  decisions: SafetyDecision[];
  riskHistory: Record<string, { timestamp: number; score: number }[]>;
  packets: V2VPacket[];           // ring-buffer of last 50 V2V packets
  latestJourney: MessageJourney | null;  // most recent backend pipeline trace
  /** Latest non-HEARTBEAT packet, locked for display until next alert arrives */
  alertPacket: V2VPacket | null;
  selectedVehicleId: string | null;
  activeScenario: string;
  isPaused: boolean;
  currentPhase: string | null;
  isConnected: boolean;
  explainability: ModelExplainability | null;
  showExplainModal: boolean;
  setSelectedVehicleId: (id: string | null) => void;
  setShowExplainModal: (show: boolean) => void;
  triggerScenario: (scenarioName: string) => Promise<void>;
  startSim: () => Promise<void>;
  pauseSim: () => Promise<void>;
  resetSim: () => Promise<void>;
  fetchExplainability: () => Promise<void>;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────

const ALERT_MSG_TYPES: MsgType[] = ["BRAKE_ALERT", "OBSTACLE_ALERT", "EMERGENCY_ALERT"];

function isAlertPacket(p: V2VPacket): boolean {
  return ALERT_MSG_TYPES.includes(p.msg_type);
}

// ─── Provider ──────────────────────────────────────────────────────────────

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [vehiclesMap, setVehiclesMap] = useState<Record<string, VehicleTwin>>({});
  const [decisions, setDecisions] = useState<SafetyDecision[]>([]);
  const [riskHistory, setRiskHistory] = useState<
    Record<string, { timestamp: number; score: number }[]>
  >({});
  const [packets, setPackets] = useState<V2VPacket[]>([]);
  const [latestJourney, setLatestJourney] = useState<MessageJourney | null>(null);
  const [alertPacket, setAlertPacket] = useState<V2VPacket | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string>("full_demo");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [explainability, setExplainability] = useState<ModelExplainability | null>(null);
  const [showExplainModal, setShowExplainModal] = useState<boolean>(false);

  const alertLockRef = useRef<string | null>(null);

  // Poll simulator status periodically for phase descriptions and pause state
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/sim/status");
        if (res.ok) {
          const data = await res.json();
          if (data.active_scenario) setActiveScenario(data.active_scenario);
          if (typeof data.is_paused === "boolean") setIsPaused(data.is_paused);
          if (data.current_phase) setCurrentPhase(data.current_phase);
        }
      } catch (err) {
        // quiet ignore if sim offline
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── WebSocket connection manager ────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWS = () => {
      ws = new WebSocket("ws://localhost:8000/ws");

      ws.onopen = () => {
        setIsConnected(true);
        console.log("🟢 Connected to V2V Backend WebSocket");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (
            data.type === "INIT_SNAPSHOT" ||
            data.type === "STALENESS_TICK"
          ) {
            const vList: VehicleTwin[] = data.vehicles || data.all_vehicles || [];
            const newMap: Record<string, VehicleTwin> = {};
            vList.forEach((v) => {
              newMap[v.vehicle_id] = v;
            });
            setVehiclesMap(newMap);
          } else if (data.type === "TELEMETRY_UPDATE") {
            const twin: VehicleTwin = data.vehicle;
            const primaryDec: SafetyDecision = data.primary_decision;

            setVehiclesMap((prev) => ({ ...prev, [twin.vehicle_id]: twin }));

            if (primaryDec.decision_type !== ("LOG_ONLY" as any)) {
              setDecisions((prev) => [primaryDec, ...prev].slice(0, 150));
            }

            setRiskHistory((prev) => {
              const list = prev[twin.vehicle_id] || [];
              const updated = [
                ...list,
                { timestamp: twin.last_seen, score: twin.last_risk_score },
              ].slice(-40);
              return { ...prev, [twin.vehicle_id]: updated };
            });
          } else if (data.type === "V2V_PACKET") {
            const pkt: V2VPacket = data.packet;
            setPackets((prev) => [pkt, ...prev].slice(0, 50));

            if (isAlertPacket(pkt)) {
              alertLockRef.current = pkt.id;
              setAlertPacket(pkt);
            } else if (alertLockRef.current === null) {
              setAlertPacket(pkt);
            }
          } else if (data.type === "MESSAGE_JOURNEY") {
            const journey: MessageJourney = {
              event_id: data.event_id,
              sender_id: data.sender_id,
              receiver_id: data.receiver_id,
              msg_type: data.msg_type,
              steps: data.steps,
            };
            setLatestJourney(journey);
          }
        } catch (err) {
          console.error("WS Message Error:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connectWS, 2000);
      };

      ws.onerror = () => {};
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  // ── Simulator controls ──────────────────────────────────────────────────
  const triggerScenario = useCallback(async (scenarioName: string) => {
    try {
      setActiveScenario(scenarioName);
      setIsPaused(false);
      alertLockRef.current = null;
      setAlertPacket(null);
      setLatestJourney(null);
      await fetch(
        `http://localhost:8000/api/scenario/trigger/${scenarioName}`,
        { method: "POST" }
      );
    } catch (err) {
      console.error("Failed to trigger scenario:", err);
    }
  }, []);

  const startSim = useCallback(async () => {
    try {
      setIsPaused(false);
      await fetch("http://localhost:8000/api/sim/start", { method: "POST" });
    } catch (err) {
      console.error("Failed to start sim:", err);
    }
  }, []);

  const pauseSim = useCallback(async () => {
    try {
      setIsPaused(true);
      await fetch("http://localhost:8000/api/sim/pause", { method: "POST" });
    } catch (err) {
      console.error("Failed to pause sim:", err);
    }
  }, []);

  const resetSim = useCallback(async () => {
    try {
      alertLockRef.current = null;
      setAlertPacket(null);
      setLatestJourney(null);
      setDecisions([]);
      setRiskHistory({});
      await fetch("http://localhost:8000/api/sim/reset", { method: "POST" });
    } catch (err) {
      console.error("Failed to reset sim:", err);
    }
  }, []);

  const fetchExplainability = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/api/model/explain");
      if (res.ok) {
        const data = await res.json();
        setExplainability(data);
      }
    } catch (err) {
      console.error("Failed to fetch model explainability:", err);
    }
  }, []);

  const vehicles = Object.values(vehiclesMap);

  return (
    <FleetContext.Provider
      value={{
        vehicles,
        decisions,
        riskHistory,
        packets,
        latestJourney,
        alertPacket,
        selectedVehicleId,
        activeScenario,
        isPaused,
        currentPhase,
        isConnected,
        explainability,
        showExplainModal,
        setSelectedVehicleId,
        setShowExplainModal,
        triggerScenario,
        startSim,
        pauseSim,
        resetSim,
        fetchExplainability,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
};

export const useFleet = () => {
  const context = useContext(FleetContext);
  if (!context) throw new Error("useFleet must be used within FleetProvider");
  return context;
};
