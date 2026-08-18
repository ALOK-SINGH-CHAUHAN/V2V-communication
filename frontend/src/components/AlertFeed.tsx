"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFleet } from "@/context/FleetContext";
import { SafetyDecision, DecisionType } from "@/types";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldAlert,
  WifiOff,
  ShieldCheck,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FeedEntryType = DecisionType | "COLLISION_RESOLVED";

interface FeedEntry {
  id: string;
  ts: number;
  type: FeedEntryType;
  vehicle_id: string;
  message: string;
  risk_score?: number;
  ttc?: number;
  v2v_gain?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ENTRY_CONFIG: Record<
  FeedEntryType,
  { icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  IMMEDIATE_ALERT: {
    icon: <AlertCircle size={14} />,
    color: "#ef4444",
    bg: "#ef444412",
    border: "#ef444430",
  },
  HIGH_RISK: {
    icon: <ShieldAlert size={14} />,
    color: "#f97316",
    bg: "#f9731612",
    border: "#f9731630",
  },
  EARLY_WARNING: {
    icon: <AlertTriangle size={14} />,
    color: "#eab308",
    bg: "#eab30812",
    border: "#eab30830",
  },
  SAFE: {
    icon: <ShieldCheck size={14} />,
    color: "#22c55e",
    bg: "#22c55e08",
    border: "#22c55e20",
  },
  COMMUNICATION_LOST: {
    icon: <WifiOff size={14} />,
    color: "#ef4444",
    bg: "#ef444412",
    border: "#ef444430",
  },
  COLLISION_RESOLVED: {
    icon: <ShieldCheck size={14} />,
    color: "#22c55e",
    bg: "#22c55e18",
    border: "#22c55e50",
  },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) +
    "." +
    String(d.getMilliseconds()).padStart(3, "0")
  );
}

// ─── Staleness threshold for "interesting" decisions ─────────────────────────

const INTERESTING: Set<string> = new Set([
  "IMMEDIATE_ALERT",
  "HIGH_RISK",
  "EARLY_WARNING",
  "COMMUNICATION_LOST",
]);

// ─── Main Component ───────────────────────────────────────────────────────────

export const AlertFeed: React.FC = () => {
  const { decisions, vehicles } = useFleet();
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);

  // Track previous risk levels per vehicle to detect COLLISION_RESOLVED transitions
  const prevRiskTierRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (decisions.length === 0) return;
    const latest = decisions[0]; // newest decision

    // Only append if we haven't already appended this decision (by timestamp + vehicle)
    setFeedEntries((prev) => {
      const alreadyExists = prev.some(
        (e) =>
          e.vehicle_id === latest.vehicle_id &&
          Math.abs(e.ts - latest.timestamp) < 80
      );
      if (alreadyExists) return prev;

      const newEntries: FeedEntry[] = [];
      const prevTier = prevRiskTierRef.current[latest.vehicle_id];
      const curTier = latest.decision_type;

      // ── COLLISION_RESOLVED detection ─────────────────────────────────
      // Fires when a vehicle transitions from HIGH_RISK or IMMEDIATE_ALERT → SAFE
      if (
        (prevTier === "HIGH_RISK" || prevTier === "IMMEDIATE_ALERT") &&
        curTier === "SAFE" &&
        latest.v2v_early_warning_gain_s !== undefined
      ) {
        newEntries.push({
          id: `resolved-${latest.vehicle_id}-${latest.timestamp}`,
          ts: latest.timestamp,
          type: "COLLISION_RESOLVED",
          vehicle_id: latest.vehicle_id,
          message: `✅ COLLISION RISK RESOLVED — V2V early warning advantage: +${
            latest.v2v_early_warning_gain_s?.toFixed(1) ?? "—"
          }s vs local sensing`,
          risk_score: latest.risk_score,
          ttc: latest.ttc,
          v2v_gain: latest.v2v_early_warning_gain_s,
        });
      }

      // Update tier tracker
      prevRiskTierRef.current[latest.vehicle_id] = curTier;

      // Filter out raw HEARTBEAT spam; keep log strictly focused on safety milestones
      if (INTERESTING.has(curTier)) {
        newEntries.push({
          id: `dec-${latest.vehicle_id}-${latest.timestamp}`,
          ts: latest.timestamp,
          type: curTier as FeedEntryType,
          vehicle_id: latest.vehicle_id,
          message: latest.rationale,
          risk_score: latest.risk_score,
          ttc: latest.ttc < 900 ? latest.ttc : undefined,
          v2v_gain: latest.v2v_early_warning_gain_s,
        });
      }

      if (newEntries.length === 0) return prev;

      return [...newEntries, ...prev].slice(0, 120);
    });
  }, [decisions]);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-100 tracking-wider uppercase">
            V2V Event Stream
          </h2>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          {feedEntries.length} events
        </span>
      </div>

      <div className="overflow-auto max-h-64 divide-y divide-slate-800/60">
        {feedEntries.length === 0 ? (
          <div className="py-8 text-center text-slate-600 text-sm">
            Waiting for safety events…
          </div>
        ) : (
          feedEntries.map((entry, i) => {
            const cfg = ENTRY_CONFIG[entry.type];
            const isResolved = entry.type === "COLLISION_RESOLVED";

            return (
              <div
                key={`feed-${entry.id}-${i}`}
                className="flex items-start gap-3 px-4 py-2.5 transition-colors"
                style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.border}` }}
              >
                {/* Icon */}
                <div
                  className="mt-0.5 shrink-0"
                  style={{ color: cfg.color }}
                >
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-500">
                      {formatTime(entry.ts)}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: cfg.color,
                        background: `${cfg.color}20`,
                      }}
                    >
                      {entry.vehicle_id}
                    </span>
                    {entry.risk_score !== undefined && !isResolved && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Risk {entry.risk_score.toFixed(0)}/100
                      </span>
                    )}
                    {entry.ttc !== undefined && (
                      <span className="text-[10px] font-mono text-slate-500">
                        TTC {entry.ttc.toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs mt-0.5 leading-snug"
                    style={{ color: isResolved ? "#22c55e" : "#94a3b8" }}
                  >
                    {entry.message}
                  </p>
                  {isResolved && entry.v2v_gain !== undefined && entry.v2v_gain > 0 && (
                    <div className="mt-1 text-[11px] font-bold text-green-400">
                      ⭐ V2V ADVANTAGE: Local sensing ~2.1s · V2V warning ~{(
                        2.1 + entry.v2v_gain
                      ).toFixed(1)}s · +{entry.v2v_gain.toFixed(1)}s earlier
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
