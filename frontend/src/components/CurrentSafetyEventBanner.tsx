"use client";

import React, { useEffect, useState } from "react";
import { useFleet } from "@/context/FleetContext";
import { AlertCircle, ShieldCheck, WifiOff, Radio } from "lucide-react";

function useRelativeTime(ts: number | null): string {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    if (!ts) { setLabel("—"); return; }
    const update = () => {
      const diffMs = Date.now() - ts;
      if (diffMs < 1000) setLabel(`${diffMs}ms ago`);
      else setLabel(`${(diffMs / 1000).toFixed(1)}s ago`);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [ts]);
  return label;
}

export const CurrentSafetyEventBanner: React.FC = () => {
  const { alertPacket, decisions, vehicles } = useFleet();

  const v1 = vehicles.find((v) => v.vehicle_id === "V001");
  const latestDecision = decisions[0] ?? null;
  const isCommLost = v1?.connectivity_status === "COMMUNICATION_LOST";

  const relativeTime = useRelativeTime(alertPacket?.timestamp ?? null);

  // ── Determine banner state ───────────────────────────────────────────────
  const isAlertActive =
    alertPacket &&
    (alertPacket.msg_type === "BRAKE_ALERT" ||
      alertPacket.msg_type === "OBSTACLE_ALERT" ||
      alertPacket.msg_type === "EMERGENCY_ALERT") &&
    !isCommLost;

  // ── Risk tier config ─────────────────────────────────────────────────────
  const riskScore = latestDecision?.risk_score ?? 0;
  const ttc = latestDecision?.ttc ?? 999;
  const decisionType = latestDecision?.decision_type ?? "SAFE";

  const tierColor =
    decisionType === "IMMEDIATE_ALERT"
      ? "#ef4444"
      : decisionType === "HIGH_RISK"
      ? "#f97316"
      : decisionType === "EARLY_WARNING"
      ? "#eab308"
      : "#22c55e";

  const tierLabel =
    decisionType === "IMMEDIATE_ALERT"
      ? "IMMEDIATE ALERT"
      : decisionType === "HIGH_RISK"
      ? "HIGH RISK"
      : decisionType === "EARLY_WARNING"
      ? "EARLY WARNING"
      : "SAFE";

  // ── COMM LOST ──────────────────────────────────────────────────────────
  if (isCommLost) {
    const lastSeen = v1?.last_seen ?? null;
    return <CommLostBanner lastSeen={lastSeen} />;
  }

  // ── ALERT ACTIVE ────────────────────────────────────────────────────────
  if (isAlertActive && alertPacket) {
    return (
      <div
        className="rounded-lg border px-4 py-2.5 font-mono flex flex-wrap items-center justify-between gap-3 text-sm"
        style={{
          background: `${tierColor}10`,
          borderColor: `${tierColor}50`,
        }}
      >
        {/* Left: type + route + seq */}
        <div className="flex items-center gap-3">
          <AlertCircle size={16} style={{ color: tierColor }} className="shrink-0" />
          <span className="font-black text-base tracking-wider" style={{ color: tierColor }}>
            {alertPacket.msg_type.replace("_", " ")}
          </span>
          <span className="text-zinc-300 font-semibold text-sm">
            {alertPacket.sender_id} → {alertPacket.receiver_id ?? "BROADCAST"}
          </span>
          <span className="text-zinc-500 text-xs">
            SEQ #{alertPacket.seq}
          </span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded border"
            style={{ color: "#94a3b8", borderColor: "#334155" }}
          >
            RECEIVED {relativeTime}
          </span>
        </div>

        {/* Right: TTC + risk + tier label */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-xs">TTC</span>
            <span
              className="font-black text-lg leading-none"
              style={{ color: ttc < 5 ? "#ef4444" : ttc < 10 ? "#f97316" : "#eab308" }}
            >
              {ttc < 900 ? `${ttc.toFixed(1)}s` : "∞"}
            </span>
          </div>
          <div className="w-px h-5 bg-zinc-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-xs">RISK</span>
            <span className="font-black text-lg leading-none" style={{ color: tierColor }}>
              {riskScore.toFixed(0)}/100
            </span>
          </div>
          <div className="w-px h-5 bg-zinc-700" />
          <span
            className="text-sm font-black px-2.5 py-0.5 rounded border"
            style={{
              color: tierColor,
              background: `${tierColor}20`,
              borderColor: `${tierColor}40`,
            }}
          >
            {tierLabel}
          </span>
        </div>
      </div>
    );
  }

  // ── NORMAL TELEMETRY ────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-[#1e2226] bg-[#070809] px-4 py-2 font-mono flex items-center justify-between text-xs">
      <div className="flex items-center gap-3">
        <Radio size={13} className="text-green-400" />
        <span className="text-green-400 font-bold tracking-wider">NORMAL TELEMETRY</span>
        {v1 && (
          <span className="text-zinc-500">
            V001 → V002
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-zinc-500">
        <span>
          TTC{" "}
          <strong className="text-zinc-300">
            {ttc < 900 ? `${ttc.toFixed(1)}s` : "∞"}
          </strong>
        </span>
        <span>
          RISK{" "}
          <strong className="text-green-400">
            {riskScore.toFixed(0)}/100
          </strong>
        </span>
        <span className="text-green-400 font-bold flex items-center gap-1">
          <ShieldCheck size={12} /> SAFE
        </span>
      </div>
    </div>
  );
};

function CommLostBanner({ lastSeen }: { lastSeen: number | null }) {
  const rel = useRelativeTime(lastSeen);
  return (
    <div className="rounded-lg border border-red-800/60 bg-red-950/20 px-4 py-2.5 font-mono flex items-center justify-between text-sm">
      <div className="flex items-center gap-3">
        <WifiOff size={16} className="text-red-400 shrink-0 animate-pulse" />
        <span className="font-black text-red-400 tracking-wider">COMMUNICATION LOST</span>
        <span className="text-zinc-400">V001</span>
        <span className="text-zinc-600 text-xs">LAST PACKET: {rel}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-red-400 border border-red-800/60 px-2 py-0.5 rounded">
          RISK: UNKNOWN
        </span>
        <span className="text-xs text-zinc-500">Telemetry unavailable</span>
      </div>
    </div>
  );
}
