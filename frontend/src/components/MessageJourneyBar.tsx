"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import { JourneyStep } from "@/types";

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  PACKET_RECEIVED: { label: "PACKET RECEIVED", color: "#38bdf8" }, // sky
  TTC_COMPUTED:    { label: "TTC COMPUTED",    color: "#a78bfa" }, // violet
  ML_RISK:         { label: "ML RISK SCORE",   color: "#f472b6" }, // pink
  RULE_ENGINE:     { label: "SAFETY ENGINE",   color: "#fb923c" }, // orange
  DECISION_ISSUED: { label: "DECISION ISSUED", color: "#4ade80" }, // green
};

function stageColor(stage: string, value: string): string {
  if (stage === "RULE_ENGINE" || stage === "DECISION_ISSUED") {
    if (value.includes("IMMEDIATE") || value.includes("🚨")) return "#ef4444";
    if (value.includes("HIGH") || value.includes("⚠️") || value.includes("BRAKE")) return "#f97316";
    if (value.includes("WARNING") || value.includes("🟡")) return "#eab308";
    return "#4ade80";
  }
  return STAGE_CONFIG[stage]?.color ?? "#94a3b8";
}

export const MessageJourneyBar: React.FC = () => {
  const { latestJourney } = useFleet();

  if (!latestJourney) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 font-mono text-center">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">
          PACKET PROCESSING
        </div>
        <div className="text-xs text-slate-500 font-sans">
          Waiting for packet telemetry trace…
        </div>
      </div>
    );
  }

  const { steps, msg_type, sender_id, receiver_id, event_id } = latestJourney;

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 space-y-3 font-mono">
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
            PACKET PROCESSING
          </h2>
          <span className="text-[10px] text-slate-500">— Real Backend Pipeline Trace</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-300">
            EVENT: <strong className="text-sky-400">{event_id}</strong>
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border"
            style={{
              color:
                msg_type === "EMERGENCY_ALERT"
                  ? "#ef4444"
                  : msg_type === "BRAKE_ALERT"
                  ? "#f97316"
                  : "#22c55e",
              borderColor:
                msg_type === "EMERGENCY_ALERT"
                  ? "#ef444440"
                  : msg_type === "BRAKE_ALERT"
                  ? "#f9731640"
                  : "#22c55e40",
              background:
                msg_type === "EMERGENCY_ALERT"
                  ? "#ef444420"
                  : msg_type === "BRAKE_ALERT"
                  ? "#f9731620"
                  : "#22c55e20",
            }}
          >
            {sender_id} → {receiver_id ?? "BROADCAST"} · {msg_type}
          </span>
        </div>
      </div>

      {/* ── Processing Pipeline Table ── */}
      <div className="divide-y divide-slate-800/80 rounded-lg bg-slate-950/80 border border-slate-800/80 overflow-hidden">
        {steps.map((step: JourneyStep, idx: number) => {
          const color = stageColor(step.stage, step.value);
          const stageName = STAGE_CONFIG[step.stage]?.label ?? step.stage;

          return (
            <div
              key={`step-${step.stage}-${idx}`}
              className="flex items-center justify-between px-4 py-2 text-xs transition-colors hover:bg-slate-900/50"
            >
              {/* Stage indicator & label */}
              <div className="flex items-center space-x-3 w-1/3">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                />
                <span className="font-bold tracking-wide" style={{ color }}>
                  {stageName}
                </span>
              </div>

              {/* Value / Result */}
              <div className="flex-1 text-center font-bold text-slate-100 truncate px-2">
                {step.value}
              </div>

              {/* Microsecond latency elapsed */}
              <div className="w-28 text-right text-[10px] text-slate-400 font-mono">
                {idx === 0 ? (
                  <span className="text-slate-400">TX RECEIVED</span>
                ) : (
                  <span>+{step.elapsed_us} µs</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
