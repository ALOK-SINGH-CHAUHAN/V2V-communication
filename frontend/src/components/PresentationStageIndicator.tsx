"use client";

import React from "react";
import { usePresentationContext, STAGE_ORDER, PresentationStage } from "@/context/PresentationContext";
import { ChevronRight, HelpCircle } from "lucide-react";

// Ordered visible pipeline stages (subset, for display)
const FLOW_STAGES: { stage: PresentationStage; short: string }[] = [
  { stage: "BRAKE_DETECTED",     short: "BRAKE" },
  { stage: "PACKET_TRANSMITTED", short: "TX" },
  { stage: "PACKET_RECEIVED",    short: "RX" },
  { stage: "TTC_COMPUTED",       short: "TTC" },
  { stage: "HIGH_RISK",          short: "RISK" },
  { stage: "IMMEDIATE_ALERT",    short: "ALERT" },
  { stage: "VEHICLE_RESPONSE",   short: "RESPONSE" },
  { stage: "RISK_RESOLVED",      short: "RESOLVED" },
];

function stageIsComplete(
  stageInFlow: PresentationStage,
  currentStage: PresentationStage
): boolean {
  const flowIdx = STAGE_ORDER.indexOf(stageInFlow);
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  return currentIdx > flowIdx;
}

function stageIsCurrent(
  stageInFlow: PresentationStage,
  currentStage: PresentationStage
): boolean {
  return stageInFlow === currentStage;
}

export const PresentationStageIndicator: React.FC = () => {
  const { mode, currentStage, stageConfig, stageExplanation, nextStagePending } =
    usePresentationContext();

  // In LIVE mode with NORMAL state: show minimal version
  const isNormal = currentStage === "NORMAL" || currentStage === "RISK_RESOLVED";
  const isCommLost = currentStage === "COMMUNICATION_LOST";

  if (mode === "LIVE") return null; // LIVE mode: no stage indicator needed

  return (
    <div className="space-y-2 font-mono">
      {/* ── Stage Flow Strip ─────────────────────────────────────────── */}
      <div className="bg-[#050607] border border-[#1e2226] rounded-xl px-4 py-3 space-y-3">

        {/* Current Stage Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: stageConfig.color }}
            />
            <span
              className="text-sm font-black tracking-wider uppercase"
              style={{ color: stageConfig.color }}
            >
              {stageConfig.label}
            </span>
            {nextStagePending && mode === "STEP" && (
              <span className="text-[9px] font-bold text-green-400 bg-green-950/60 border border-green-800/50 px-1.5 py-0.5 rounded animate-pulse">
                NEXT READY
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-600">{stageConfig.description}</span>
        </div>

        {/* Stage Flow Visual — horizontal pipeline */}
        {!isNormal && !isCommLost && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {FLOW_STAGES.map(({ stage, short }, i) => {
              const complete = stageIsComplete(stage, currentStage);
              const current = stageIsCurrent(stage, currentStage);

              return (
                <React.Fragment key={stage}>
                  {i > 0 && (
                    <ChevronRight
                      size={10}
                      className={complete ? "text-zinc-400" : "text-zinc-700"}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-all ${
                      current
                        ? "text-white border"
                        : complete
                        ? "text-zinc-400"
                        : "text-zinc-700"
                    }`}
                    style={
                      current
                        ? {
                            background: `${stageConfig.color}20`,
                            borderColor: `${stageConfig.color}60`,
                            color: stageConfig.color,
                          }
                        : {}
                    }
                  >
                    {complete && <span className="text-green-400">✓</span>}
                    {current && (
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: stageConfig.color }}
                      />
                    )}
                    {short}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── WHY RISK CHANGED ─────────────────────────────────────────── */}
      {stageExplanation.length > 0 && !isNormal && (
        <div className="bg-[#040506] border border-[#1e2226] rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <HelpCircle size={11} className="text-zinc-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              WHY RISK CHANGED
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {stageExplanation.map((line, i) => (
              <span key={i} className="text-[11px] text-zinc-300 flex items-start gap-1.5">
                <span
                  className="text-[10px] mt-0.5 shrink-0"
                  style={{ color: stageConfig.color }}
                >
                  ›
                </span>
                {line}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
