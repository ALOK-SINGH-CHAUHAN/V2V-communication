"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import { X, Activity, Radio, Cpu, Clock, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export const VehicleDetailPanel: React.FC = () => {
  const { vehicles, selectedVehicleId, setSelectedVehicleId, riskHistory } = useFleet();

  if (!selectedVehicleId) return null;

  const vehicle = vehicles.find((v) => v.vehicle_id === selectedVehicleId);
  if (!vehicle) return null;

  const vHistory = riskHistory[vehicle.vehicle_id] || [];
  const chartData = vHistory.map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString(),
    risk: h.score,
  }));

  const meta = vehicle.receiver_meta || {
    rssi: -72.0,
    snr: 8.5,
    packet_loss_pct: 0.0,
    latency_ms: 45.0,
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-[#000000] border-l border-[#292d30] z-50 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#292d30]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#9281f7]/10 border border-[#9281f7]/40 flex items-center justify-center font-mono font-bold text-[#9281f7] text-sm">
              {vehicle.vehicle_id}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-zinc-400">DIGITAL TWIN STATE</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                    vehicle.connectivity_status === "LIVE"
                      ? "bg-[#3ad389]/10 text-[#3ad389] border-[#3ad389]/40"
                      : vehicle.connectivity_status === "STALE"
                      ? "bg-[#ffca16]/10 text-[#ffca16] border-[#ffca16]/40"
                      : "bg-[#ff6465]/10 text-[#ff6465] border-[#ff6465]/40"
                  }`}
                >
                  {vehicle.connectivity_status}
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">
                Source: {meta.source}
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedVehicleId(null)}
            className="p-1.5 rounded-md border border-[#292d30] hover:bg-[#181a1d] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Risk Trend Sparkline Chart */}
        <div className="bg-[#0a0b0d] border border-[#292d30] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#9281f7]" /> RISK SCORE HISTORICAL TREND
            </span>
            <span className="text-xs font-mono font-bold text-[#9281f7]">
              {vehicle.last_risk_score.toFixed(1)} / 100
            </span>
          </div>
          <div className="h-32 w-full pt-2">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000000",
                      borderColor: "#292d30",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke="#9281f7"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-mono text-zinc-500">
                Collecting historical trend data...
              </div>
            )}
          </div>
        </div>

        {/* Clean Digital Twin Cards */}
        <div className="grid grid-cols-2 gap-3 font-mono">
          <div className="bg-[#0a0b0d] border border-[#292d30] p-3 rounded-lg space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block">Speed</span>
            <p className="text-sm font-bold text-white">
              {(vehicle.last_speed_mps * 3.6).toFixed(1)} km/h
            </p>
            <span className="text-[10px] text-zinc-500">{vehicle.last_speed_mps.toFixed(1)} m/s</span>
          </div>

          <div className="bg-[#0a0b0d] border border-[#292d30] p-3 rounded-lg space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block">Acceleration</span>
            <p className="text-sm font-bold text-white">
              {vehicle.last_accel_x.toFixed(2)} m/s²
            </p>
            <span className="text-[10px] text-zinc-500">Longitudinal</span>
          </div>

          <div className="bg-[#0a0b0d] border border-[#292d30] p-3 rounded-lg space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block">Position (X, Y)</span>
            <p className="text-sm font-bold text-white">
              ({vehicle.last_position.x.toFixed(1)}m, {vehicle.last_position.y.toFixed(1)}m)
            </p>
            <span className="text-[10px] text-zinc-500">Heading: {vehicle.last_heading_deg}°</span>
          </div>

          <div className="bg-[#0a0b0d] border border-[#292d30] p-3 rounded-lg space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase block">LoRa Link Quality</span>
            <p className="text-sm font-bold text-[#3ad389]">
              {meta.rssi} dBm
            </p>
            <span className="text-[10px] text-zinc-500">SNR: {meta.snr} dB | CRC: OK</span>
          </div>
        </div>

        {/* Link Reliability Stats */}
        <div className="bg-[#08090b] border border-[#1e2226] p-3 rounded-lg font-mono text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Packet Sequence:</span>
            <span className="text-zinc-200">#{vehicle.seq}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Transport Latency:</span>
            <span className="text-[#70b8ff]">{meta.latency_ms} ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Packet Loss Rate:</span>
            <span className="text-zinc-200">{meta.packet_loss_pct}%</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-[#292d30] text-center">
        <button
          onClick={() => setSelectedVehicleId(null)}
          className="w-full bg-[#121416] hover:bg-[#1c1e22] text-zinc-300 border border-[#292d30] py-2 rounded-md font-mono text-xs transition-colors cursor-pointer"
        >
          Close Inspector Drawer
        </button>
      </div>
    </div>
  );
};
