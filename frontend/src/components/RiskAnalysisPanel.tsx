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
  ArrowDown,
  ArrowUp,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

// ─── Risk tier helper ─────────────────────────────────────────────────────────

function getRiskTier(score: number) {
  if (score >= 75)
    return {
      label: "IMMEDIATE ALERT",
      color: "#ef4444",
      bg: "#ef444415",
      border: "#ef444440",
      icon: <AlertCircle size={16} className="text-red-400" />,
      action: "BRAKE IMMEDIATELY",
      actionColor: "#ef4444",
    };
  if (score >= 50)
    return {
      label: "HIGH RISK",
      color: "#f97316",
      bg: "#f9731615",
      border: "#f9731640",
      icon: <AlertTriangle size={16} className="text-orange-400" />,
      action: "BRAKE RECOMMENDED",
      actionColor: "#f97316",
    };
  if (score >= 30)
    return {
      label: "EARLY WARNING",
      color: "#eab308",
      bg: "#eab30815",
      border: "#eab30840",
      icon: <AlertTriangle size={16} className="text-yellow-400" />,
      action: "PREPARE TO BRAKE",
      actionColor: "#eab308",
    };
  return {
    label: "SAFE",
    color: "#22c55e",
    bg: "#22c55e15",
    border: "#22c55e40",
    icon: <ShieldCheck size={16} className="text-green-400" />,
    action: "NO INTERVENTION REQUIRED",
    actionColor: "#22c55e",
  };
}

function renderRiskTrend(trendLabel?: string) {
  const label = trendLabel || "STABLE";
  if (label === "RAPIDLY_INCREASING")
    return (
      <span className="flex items-center gap-1 text-red-400 font-bold">
        <TrendingUp size={13} /> ↑ RAPIDLY INCREASING
      </span>
    );
  if (label === "INCREASING")
    return (
      <span className="flex items-center gap-1 text-orange-400 font-bold">
        <TrendingUp size={13} /> ↑ INCREASING
      </span>
    );
  if (label === "RAPIDLY_DECREASING")
    return (
      <span className="flex items-center gap-1 text-green-400 font-bold">
        <TrendingDown size={13} /> ↓ RAPIDLY DECREASING
      </span>
    );
  if (label === "DECREASING")
    return (
      <span className="flex items-center gap-1 text-green-400 font-bold">
        <TrendingDown size={13} /> ↓ DECREASING
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-slate-400 font-mono">
      <Minus size={13} /> STABLE
    </span>
  );
}

// ─── TTC → Risk relationship indicator ────────────────────────────────────────

function TtcRiskRelationship({ trendLabel }: { trendLabel?: string }) {
  const isIncreasing =
    trendLabel === "INCREASING" || trendLabel === "RAPIDLY_INCREASING";
  const isDecreasing =
    trendLabel === "DECREASING" || trendLabel === "RAPIDLY_DECREASING";

  if (isIncreasing) {
    return (
      <div className="flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded bg-red-950/30 border border-red-900/40">
        <ArrowDown size={11} className="text-red-400" />
        <span className="text-red-300 font-bold">TTC ↓</span>
        <span className="text-zinc-600 mx-1">→</span>
        <ArrowUp size={11} className="text-red-400" />
        <span className="text-red-300 font-bold">COLLISION RISK ↑</span>
      </div>
    );
  }
  if (isDecreasing) {
    return (
      <div className="flex items-center gap-2 text-[11px] font-mono px-3 py-1.5 rounded bg-green-950/30 border border-green-900/40">
        <ArrowUp size={11} className="text-green-400" />
        <span className="text-green-300 font-bold">TTC ↑</span>
        <span className="text-zinc-600 mx-1">→</span>
        <ArrowDown size={11} className="text-green-400" />
        <span className="text-green-300 font-bold">COLLISION RISK ↓</span>
      </div>
    );
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const RiskAnalysisPanel: React.FC = () => {
  const { vehicles, riskHistory, decisions } = useFleet();

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
  const latestFull = decisions[0];

  // V2V Early Warning values (from latest SafetyDecision)
  const v2vGain = latestFull?.v2v_early_warning_gain_s ?? 0;
  const localTtc = latestFull?.local_detection_ttc_s ?? 0;
  const v2vTtc = latestFull?.v2v_detection_ttc_s ?? 0;
  const showV2VAdvantage = v2vGain > 0.1 && v2vTtc > 0 && localTtc > 0;

  return (
    <div className="bg-[#000000] border border-[#292d30] rounded-xl p-4 space-y-4 font-mono">

      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#292d30]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          COLLISION RISK
        </h2>
        <span className="text-[10px] text-zinc-500 uppercase">V002 → V001</span>
      </div>

      {/* ── Primary Risk Card ── */}
      <div
        className="rounded-lg border p-4 transition-all space-y-3"
        style={{ background: tier.bg, borderColor: tier.border }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {tier.icon}
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              FOLLOWING VEHICLE (V002)
            </span>
          </div>
          <span
            className="text-xs font-black uppercase px-2.5 py-1 rounded border"
            style={{
              color: tier.color,
              borderColor: tier.border,
              background: `${tier.color}20`,
            }}
          >
            {isCommLost ? "COMM LOST" : tier.label}
          </span>
        </div>

        {isCommLost ? (
          <div className="py-4 text-center space-y-2">
            <WifiOff className="w-8 h-8 text-red-400 mx-auto" />
            <div className="text-sm font-bold text-red-400">
              COMMUNICATION LOST — Telemetry Timeout
            </div>
            <p className="text-xs text-zinc-400 font-sans max-w-sm mx-auto">
              V001 telemetry lost. Vehicle state unknown — collision risk score withheld.
            </p>
          </div>
        ) : (
          <>
            {/* Big numbers: Risk + TTC */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">RISK SCORE</span>
                <div
                  className="text-4xl font-extrabold font-mono leading-none mt-1"
                  style={{ color: tier.color }}
                >
                  {v2.last_risk_score.toFixed(0)}
                  <span className="text-sm font-normal text-zinc-600 ml-1">/ 100</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">TIME-TO-COLLISION</span>
                <div className="text-4xl font-extrabold font-mono leading-none mt-1 text-zinc-100">
                  {v2.last_ttc < 900 ? `${v2.last_ttc.toFixed(1)}s` : "∞"}
                </div>
              </div>
            </div>

            {/* TTC → Risk relationship */}
            <TtcRiskRelationship trendLabel={decision?.risk_trend_label} />

            {/* Risk trend + Safety Action */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#292d30]/60">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase">Risk Trajectory</span>
                <div className="mt-1 text-xs">{renderRiskTrend(decision?.risk_trend_label)}</div>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase">Safety Action</span>
                <div
                  className="mt-1 text-xs font-black uppercase tracking-wide"
                  style={{ color: tier.actionColor }}
                >
                  {tier.action}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RISK FACTORS ── */}
      {!isCommLost && decision?.reasons && decision.reasons.length > 0 && (
        <div className="rounded-lg border border-[#1e2226] bg-[#070809] p-3 space-y-2">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            RISK FACTORS
          </div>
          {decision.reasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
              <span className="text-zinc-600 mt-px shrink-0">›</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Risk Score Graph ── */}
      {!isCommLost && history.length > 2 && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center justify-between">
            <span>RISK HISTORY · LAST 40 SAMPLES</span>
            {decision?.risk_trend_label &&
              (decision.risk_trend_label === "RAPIDLY_INCREASING" ||
                decision.risk_trend_label === "INCREASING") && (
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <TrendingUp size={11} /> RAPIDLY INCREASING
                </span>
              )}
          </div>
          <div className="h-20 w-full bg-[#08090b] border border-[#1e2226] rounded-lg p-1">
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

      {/* ── V2V Early Warning Advantage ── */}
      {!isCommLost && showV2VAdvantage && (
        <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-sky-400" />
            <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">
              V2V EARLY WARNING
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-zinc-500 text-[10px]">Local detect</div>
              <div className="font-bold text-zinc-300">{localTtc.toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-zinc-500 text-[10px]">V2V detect</div>
              <div className="font-bold text-sky-400">{v2vTtc.toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-zinc-500 text-[10px]">Advantage</div>
              <div className="font-black text-green-400">+{v2vGain.toFixed(1)}s</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Compact V001 Leader Status ── */}
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
