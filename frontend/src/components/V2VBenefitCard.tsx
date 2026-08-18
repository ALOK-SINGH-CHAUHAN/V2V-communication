"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import { SafetyDecision } from "@/types";
import { ShieldCheck, Zap } from "lucide-react";

export const V2VBenefitCard: React.FC<{ decision?: SafetyDecision }> = ({ decision }) => {
  const { decisions } = useFleet();

  const activeDecision = decision || decisions[0] || {
    local_detection_ttc_s: 0.0,
    v2v_detection_ttc_s: 0.0,
    v2v_early_warning_gain_s: 0.0,
  };

  const localSec = activeDecision.local_detection_ttc_s ?? 0.0;
  const v2vSec = activeDecision.v2v_detection_ttc_s ?? 0.0;
  const gain = activeDecision.v2v_early_warning_gain_s ?? 0.0;

  return (
    <div className="bg-[#05080b] border border-[#9281f7]/40 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_20px_rgba(146,129,247,0.1)] relative overflow-hidden">
      <div className="flex items-center justify-between pb-2 border-b border-[#1c1f28]">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-[#ffca16]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            COOPERATIVE SAFETY BENEFIT
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#9281f7]/20 text-[#9281f7] font-bold border border-[#9281f7]/40">
          SIH CORE METRIC
        </span>
      </div>

      <div className="py-3 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-400 block">Local Vehicle Sensor Horizon</span>
          <p className="text-sm font-mono font-bold text-zinc-400">
            {localSec > 0 ? `${localSec.toFixed(1)} sec` : "--"}
          </p>
        </div>

        <div className="text-right space-y-1">
          <span className="text-[10px] font-mono text-[#70b8ff] block">V2V Cooperative Horizon</span>
          <p className="text-sm font-mono font-bold text-[#70b8ff]">
            {v2vSec > 0 ? `${v2vSec.toFixed(1)} sec` : "--"}
          </p>
        </div>
      </div>

      {/* Headline Metric Highlight */}
      <div className="bg-gradient-to-r from-[#9281f7]/20 via-[#3b9eff]/20 to-[#3ad389]/20 border border-[#9281f7]/50 rounded-lg p-2.5 text-center">
        <span className="text-[10px] font-mono text-zinc-300 block uppercase">Additional Warning Time Gained</span>
        <p className="text-lg font-mono font-extrabold text-[#3ad389] tracking-tight">
          {gain > 0 ? `+${gain.toFixed(1)} SECONDS EARLY WARNING` : "NOMINAL / MONITORING"}
        </p>
      </div>
    </div>
  );
};
