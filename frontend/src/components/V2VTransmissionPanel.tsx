"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFleet } from "@/context/FleetContext";
import { V2VPacket, MsgType } from "@/types";
import { Radio, WifiOff, CheckCircle2 } from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const MSG_CONFIG: Record<
  MsgType,
  { label: string; color: string; glow: string; beamClass: string; priority: "high" | "low" }
> = {
  HEARTBEAT: {
    label: "HEARTBEAT",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.35)",
    beamClass: "beam-heartbeat",
    priority: "low",
  },
  BRAKE_ALERT: {
    label: "BRAKE ALERT",
    color: "#f97316",
    glow: "rgba(249,115,22,0.5)",
    beamClass: "beam-brake",
    priority: "high",
  },
  OBSTACLE_ALERT: {
    label: "OBSTACLE ALERT",
    color: "#eab308",
    glow: "rgba(234,179,8,0.5)",
    beamClass: "beam-obstacle",
    priority: "high",
  },
  EMERGENCY_ALERT: {
    label: "EMERGENCY",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.6)",
    beamClass: "beam-emergency",
    priority: "high",
  },
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function MsgTypeBadge({ type }: { type: MsgType }) {
  const cfg = MSG_CONFIG[type];
  return (
    <span
      className="px-2.5 py-1 rounded text-sm font-black tracking-wider"
      style={{
        color: cfg.color,
        background: cfg.glow,
        border: `1px solid ${cfg.color}60`,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Animated LoRa Beam ───────────────────────────────────────────────────────

function LoraBeam({
  packet,
  commLost,
}: {
  packet: V2VPacket | null;
  commLost: boolean;
}) {
  const [animKey, setAnimKey] = useState(0);
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (packet && packet.id !== prevIdRef.current) {
      prevIdRef.current = packet.id;
      if (packet.msg_type !== "HEARTBEAT") {
        setAnimKey((k) => k + 1);
      }
    }
  }, [packet]);

  const cfg = packet ? MSG_CONFIG[packet.msg_type] : MSG_CONFIG.HEARTBEAT;

  return (
    <div className="relative flex items-center justify-between w-full px-6 py-4">
      {/* ── Vehicle A (Sender) ── */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center justify-center shadow-lg"
          style={{ opacity: commLost ? 0.5 : 1 }}
        >
          <span className="text-xs font-mono font-bold text-slate-100">
            {packet?.sender_id ?? "V001"}
          </span>
          <span className="text-[9px] font-mono text-slate-500">LEADER</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono tracking-wider">SENDER</div>
      </div>

      {/* ── Beam track ── */}
      <div className="flex-1 mx-4 relative flex flex-col items-center gap-1">
        {commLost ? (
          /* ── Communication Lost state ── */
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-px border-t border-dashed border-red-800" />
              <WifiOff size={18} className="text-red-500 shrink-0" />
              <div className="flex-1 h-px border-t border-dashed border-red-800" />
            </div>
            <span className="text-[10px] text-red-400 font-bold tracking-widest uppercase">
              LINK LOST
            </span>
          </div>
        ) : (
          /* ── Normal beam ── */
          <>
            <div className="relative w-full h-6 flex items-center overflow-hidden">
              <div
                className="absolute inset-x-0 h-px opacity-30"
                style={{ background: cfg.color }}
              />
              {packet?.msg_type === "HEARTBEAT" && (
                <div
                  key={`hb-${packet.id}`}
                  className="absolute w-2 h-2 rounded-full animate-ping"
                  style={{
                    background: cfg.color,
                    left: "50%",
                    transform: "translateX(-50%)",
                    animationDuration: "1.2s",
                  }}
                />
              )}
              {packet && packet.msg_type !== "HEARTBEAT" && (
                <div
                  key={`beam-${animKey}`}
                  className="absolute h-1 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${cfg.color}, ${cfg.color})`,
                    boxShadow: `0 0 12px ${cfg.glow}`,
                    width: "100%",
                    animation: "beamSweep 0.7s ease-out forwards",
                  }}
                />
              )}
            </div>

            {/* Packet label */}
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="text-xs font-bold tracking-wider font-mono"
                style={{ color: cfg.color }}
              >
                {cfg.label}
              </span>
              {packet && (
                <span className="text-[10px] text-slate-400 font-mono">
                  SEQ #{packet.seq} · {packet.latency_ms.toFixed(0)}ms · {packet.rssi.toFixed(0)} dBm
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Vehicle B (Receiver) ── */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center justify-center shadow-lg"
          style={{ opacity: commLost ? 0.6 : 1 }}
        >
          <span className="text-xs font-mono font-bold text-slate-100">
            {packet?.receiver_id ?? "V002"}
          </span>
          <span className="text-[9px] font-mono text-slate-500">FOLLOWER</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono tracking-wider">RECEIVER</div>
      </div>

      <style>{`
        @keyframes beamSweep {
          from { transform: scaleX(0); transform-origin: left; opacity: 1; }
          to   { transform: scaleX(1); transform-origin: left; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Latest Packet Detail Panel ───────────────────────────────────────────────

function LatestPacketDetail({ packet }: { packet: V2VPacket | null }) {
  if (!packet) {
    return (
      <div className="text-slate-500 text-sm text-center py-4">
        Waiting for first packet…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {/* Left: telemetry values */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs w-20">TYPE</span>
            <MsgTypeBadge type={packet.msg_type} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs w-20">SPEED</span>
            <span className="font-mono text-sm font-bold text-slate-100">
              {packet.speed_kmh.toFixed(1)} km/h
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs w-20">ACCEL</span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: packet.accel_mps2 < -1 ? "#f97316" : "#94a3b8" }}
            >
              {packet.accel_mps2.toFixed(2)} m/s²
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs w-20">DISTANCE</span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: packet.distance_m < 25 ? "#ef4444" : "#94a3b8" }}
            >
              {packet.distance_m < 900 ? `${packet.distance_m.toFixed(1)} m` : "—"}
            </span>
          </div>
        </div>

        {/* Right: transmission status pipeline */}
        <div className="space-y-2 pl-4 border-l border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span className="text-slate-300 text-xs font-mono">● TRANSMITTED</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span className="text-slate-300 text-xs font-mono">● RECEIVED</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span className="text-slate-300 text-xs font-mono">● PROCESSED</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700 space-y-1 font-mono text-[10px] text-slate-400">
            <div>RSSI {packet.rssi.toFixed(0)} dBm · SNR {packet.snr.toFixed(1)} dB</div>
            <div>LATENCY {packet.latency_ms.toFixed(0)} ms</div>
          </div>
        </div>
      </div>

      {/* Technical Detail Thread Bar */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div>
          TX <span className="text-slate-200">{formatTimestamp(packet.timestamp)}</span>
          &nbsp;·&nbsp;
          RX <span className="text-slate-200">+{packet.latency_ms.toFixed(0)}ms</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Δ {packet.latency_ms.toFixed(0)} ms</span>
          <span className="text-green-400 font-bold">CRC ✓</span>
        </div>
      </div>
    </div>
  );
}

// ─── Packet Stream Table ───────────────────────────────────────────────────────

function PacketStreamTable({
  packets,
  activePacket,
}: {
  packets: V2VPacket[];
  activePacket: V2VPacket | null;
}) {
  // Guarantee active hero packet is pinned as Row #0 if not already present
  const allDisplay: V2VPacket[] = [];
  if (activePacket) {
    allDisplay.push(activePacket);
  }
  packets.forEach((p) => {
    if (!activePacket || p.id !== activePacket.id) {
      allDisplay.push(p);
    }
  });

  const display = allDisplay.slice(0, 20);

  return (
    <div className="overflow-auto max-h-44">
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="text-slate-500 text-left border-b border-slate-700/50">
            <th className="pb-1 pr-3 font-medium">TIME</th>
            <th className="pb-1 pr-3 font-medium">SENDER</th>
            <th className="pb-1 pr-3 font-medium">TYPE</th>
            <th className="pb-1 pr-3 font-medium">SEQ</th>
            <th className="pb-1 pr-3 font-medium">RSSI</th>
            <th className="pb-1 pr-3 font-medium">LAT</th>
            <th className="pb-1 font-medium">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {display.map((pkt, i) => {
            const cfg = MSG_CONFIG[pkt.msg_type];
            const isActive = activePacket && pkt.id === activePacket.id;
            return (
              <tr
                key={`pkt-${pkt.id}-${pkt.timestamp}-${i}`}
                className="border-b border-slate-800/40 transition-colors"
                style={{
                  background: isActive ? `${cfg.glow}` : "transparent",
                  opacity: isActive ? 1 : 0.75 - i * 0.025,
                }}
              >
                <td className="py-0.5 pr-3 text-slate-400">
                  {formatTimestamp(pkt.timestamp)}
                </td>
                <td className="py-0.5 pr-3 font-bold text-slate-200">
                  {pkt.sender_id}
                </td>
                <td className="py-0.5 pr-3" style={{ color: cfg.color }}>
                  {cfg.label} {isActive && <span className="text-[9px] text-amber-400 ml-1">[ACTIVE]</span>}
                </td>
                <td className="py-0.5 pr-3 text-slate-400">#{pkt.seq}</td>
                <td className="py-0.5 pr-3 text-slate-400">{pkt.rssi.toFixed(0)}</td>
                <td className="py-0.5 pr-3 text-slate-400">{pkt.latency_ms.toFixed(0)}ms</td>
                <td className="py-0.5">
                  <span className="text-green-400">✓ {pkt.status}</span>
                </td>
              </tr>
            );
          })}
          {display.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-slate-600">
                Waiting for V2V packets…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Hero Panel ──────────────────────────────────────────────────────────

export function V2VTransmissionPanel() {
  const { packets, alertPacket, vehicles } = useFleet();

  // Pick displayed packet: alertPacket (locked alert) or fallback to latest packet
  const activePacket = alertPacket || (packets.length > 0 ? packets[0] : null);

  // Check if lead vehicle is in COMM_LOST
  const v1 = vehicles.find((v) => v.vehicle_id === "V001");
  const commLost = v1?.connectivity_status === "COMMUNICATION_LOST";

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-5 space-y-4">
      {/* ── Panel Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-sky-400" />
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">
            V2V Transmission
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">LoRa LINK</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className={`w-2 h-2 rounded-full ${commLost ? "bg-red-500 animate-pulse" : "bg-green-400"}`} />
          <span className={commLost ? "text-red-400 font-bold" : "text-green-400"}>
            {commLost ? "LINK LOST" : "ACTIVE"}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">{packets.length} packets</span>
        </div>
      </div>

      {/* ── Animated Beam Visualizer ── */}
      <LoraBeam packet={activePacket} commLost={commLost} />

      {/* ── Bottom split: Details + Stream Table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
        {/* Left: Active packet telemetry */}
        <div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">
            Active Message Detail
          </div>
          <LatestPacketDetail packet={activePacket} />
        </div>

        {/* Right: Real-time packet stream table */}
        <div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">
            Packet Stream
          </div>
          <PacketStreamTable packets={packets} activePacket={activePacket} />
        </div>
      </div>
    </div>
  );
}
