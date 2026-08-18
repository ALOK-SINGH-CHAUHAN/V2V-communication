"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import {
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  WifiOff,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { VehicleTwin } from "@/types";

function getRiskTier(score: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
} {
  if (score >= 75)
    return {
      label: "IMMEDIATE ALERT",
      color: "#ef4444",
      bg: "#ef444415",
      border: "#ef444440",
      icon: <AlertCircle size={16} className="text-red-400" />,
    };
  if (score >= 50)
    return {
      label: "HIGH RISK",
      color: "#f97316",
      bg: "#f9731615",
      border: "#f9731640",
      icon: <AlertTriangle size={16} className="text-orange-400" />,
    };
  if (score >= 30)
    return {
      label: "EARLY WARNING",
      color: "#eab308",
      bg: "#eab30815",
      border: "#eab30840",
      icon: <AlertTriangle size={16} className="text-yellow-400" />,
    };
  return {
    label: "SAFE",
    color: "#22c55e",
    bg: "#22c55e15",
    border: "#22c55e40",
    icon: <ShieldCheck size={16} className="text-green-400" />,
  };
}

function renderRiskTrend(trendLabel?: string) {
  const label = trendLabel || "STABLE";
  if (label === "RAPIDLY_INCREASING") {
    return (
      <span className="flex items-center gap-1 text-red-400 font-bold">
        <TrendingUp size={13} /> ↑ RAPIDLY INCREASING
      </span>
    );
  }
  if (label === "INCREASING") {
    return (
      <span className="flex items-center gap-1 text-orange-400 font-bold">
        <TrendingUp size={13} /> ↑ INCREASING
      </span>
    );
  }
  if (label === "RAPIDLY_DECREASING") {
    return (
      <span className="flex items-center gap-1 text-green-400 font-bold">
        <TrendingDown size={13} /> ↓ RAPIDLY DECREASING
      </span>
    );
  }
  if (label === "DECREASING") {
    return (
      <span className="flex items-center gap-1 text-green-400 font-bold">
        <TrendingDown size={13} /> ↓ DECREASING
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-slate-400 font-mono">
      <Minus size={13} /> STABLE
    </span>
  );
}

export const RiskAnalysisPanel: React.FC = () => {
  const { vehicles, riskHistory } = useFleet();

  // V002 (Follower) evaluates collision risk of hitting V001 (Leader)
  const v2 = vehicles.find((v) => v.vehicle_id === "V002") || vehicles[0];
  const v1 = vehicles.find((v) => v.vehicle_id === "V001");

  if (!v2) return null;

  const isCommLost = v1?.connectivity_status === "COMMUNICATION_LOST";
  const tier = getRiskTier(v2.last_risk_score);
  const history = (riskHistory["V002"] || []).map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], {
      hour12: false,
      minute: "2-digit",
      second: "2-digit",
    }),
    score: h.score,
  }));

  const decision = v2.last_decision;

  return (
    <div className="bg-[#000000] border border-[#292d30] rounded-xl p-4 space-y-4 font-mono">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#292d30]">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Real-Time Collision Risk
          </h2>
          <p className="text-[11px] font-sans text-zinc-500">
            Cooperative risk evaluation for following vehicle (V002 → V001)
          </p>
        </div>
        <span className="text-[10px] text-zinc-500 uppercase">Target: V001 Leader</span>
      </div>

      {/* ── Primary Card: V002 Following Vehicle ── */}
      <div
        className="rounded-lg border p-4 transition-all space-y-3"
        style={{ background: tier.bg, borderColor: tier.border }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {tier.icon}
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              FOLLOWING VEHICLE (V002)
            </span>
          </div>

          {/* Risk Tier Badge */}
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border"
            style={{
              color: tier.color,
              borderColor: tier.border,
              background: `${tier.color}20`,
            }}
          >
            {isCommLost ? "COMMUNICATION LOST" : tier.label}
          </span>
        </div>

        {isCommLost ? (
          /* Link Lost state */
          <div className="py-6 text-center space-y-2">
            <WifiOff className="w-8 h-8 text-red-400 mx-auto" />
            <div className="text-sm font-bold text-red-400">
              COMMUNICATION LOST — Telemetry Timeout
            </div>
            <p className="text-xs text-zinc-400 font-sans max-w-sm mx-auto">
              V001 telemetry lost. Vehicle state unknown — collision risk score withheld.
            </p>
          </div>
        ) : (
          /* Active Risk Evaluation */
          <div className="grid grid-cols-3 gap-3 pt-1">
            {/* Risk Score */}
            <div>
              <span className="text-[10px] text-zinc-400 uppercase">ML RISK SCORE</span>
              <div className="text-2xl font-bold font-mono" style={{ color: tier.color }}>
                {v2.last_risk_score.toFixed(0)} <span className="text-xs font-normal text-zinc-500">/ 100</span>
              </div>
            </div>

            {/* TTC */}
            <div>
              <span className="text-[10px] text-zinc-400 uppercase">TIME-TO-COLLISION</span>
              <div className="text-2xl font-bold font-mono text-zinc-100">
                {v2.last_ttc < 900 ? `${v2.last_ttc.toFixed(1)}s` : "∞"}
              </div>
            </div>

            {/* Risk Trend */}
            <div>
              <span className="text-[10px] text-zinc-400 uppercase">RISK TRAJECTORY</span>
              <div className="mt-1 text-xs">{renderRiskTrend(decision?.risk_trend_label)}</div>
            </div>
          </div>
        )}

        {/* Reason Codes */}
        {!isCommLost && decision?.reasons && decision.reasons.length > 0 && (
          <div className="pt-2 border-t border-[#292d30]/60 space-y-1">
            <div className="text-[10px] text-zinc-400 uppercase">Derivation Reasons:</div>
            {decision.reasons.map((reason, idx) => (
              <div key={idx} className="text-xs text-zinc-200 flex items-center gap-1.5">
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Risk Score Sparkline Chart ── */}
      {!isCommLost && history.length > 2 && (
        <div className="pt-2">
          <div className="text-[10px] text-zinc-400 uppercase mb-1">
            Risk Trajectory History (Last 40 Samples)
          </div>
          <div className="h-24 w-full bg-[#08090b] border border-[#1e2226] rounded-lg p-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={tier.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={tier.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{
                    background: "#0c0e10",
                    border: "1px solid #292d30",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={tier.color}
                  strokeWidth={2}
                  fill="url(#riskGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Compact Secondary Status for V001 (Leader) ── */}
      {v1 && (
        <div className="p-2.5 rounded-lg bg-[#0a0b0d] border border-[#292d30] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="font-bold text-zinc-300">LEADER (V001)</span>
          </div>
          <div className="text-zinc-400">
            Speed: <strong className="text-zinc-200">{(v1.last_speed_mps * 3.6).toFixed(1)} km/h</strong>
            &nbsp;·&nbsp;
            Accel: <strong className="text-zinc-200">{v1.last_accel_x.toFixed(2)} m/s²</strong>
          </div>
        </div>
      )}
    </div>
  );
};
