"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import { Radio } from "lucide-react";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { vehicles, isConnected, activeScenario } = useFleet();

  // Determine active source mode
  const activeSource = vehicles.some((v) => v.receiver_meta?.source === "LIVE_HARDWARE")
    ? "LIVE_HARDWARE"
    : "SIMULATED";

  const v1 = vehicles.find((v) => v.vehicle_id === "V001");
  const isCommLost = v1?.connectivity_status === "COMMUNICATION_LOST";

  const sampleMeta = vehicles[0]?.receiver_meta || {
    rssi: -72.0,
    snr: 8.5,
    packet_loss_pct: 0.0,
    latency_ms: 45.0,
  };

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 font-mono selection:bg-[#9281f7]/30 selection:text-white flex flex-col">
      {/* Top Header & Network Ribbon */}
      <header className="border-b border-[#292d30] bg-[#000000] px-6 py-3 sticky top-0 z-40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9281f7] to-[#3b9eff] flex items-center justify-center font-bold text-black text-xs shadow-[0_0_15px_rgba(146,129,247,0.4)]">
              V2V
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white uppercase">
                V2V SAFETY MONITOR
              </h1>
            </div>
          </div>

          {/* Mode Switch Status */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2 px-3 py-1 rounded-full border bg-[#111315] border-[#292d30]">
              <span className={`w-2 h-2 rounded-full ${activeSource === "LIVE_HARDWARE" ? "bg-green-400 animate-pulse" : "bg-sky-400"}`}></span>
              <span className={activeSource === "LIVE_HARDWARE" ? "text-green-400 font-bold" : "text-sky-400 font-bold"}>
                {activeSource === "LIVE_HARDWARE" ? "LIVE HARDWARE" : "SIMULATION"}
              </span>
            </div>
          </div>
        </div>

        {/* LoRa Network Health Ribbon */}
        <div className="flex items-center justify-between bg-[#08090b] border border-[#1e2226] px-4 py-1.5 rounded-lg text-[11px] text-zinc-400">
          <div className="flex items-center space-x-6">
            <span className="flex items-center gap-1.5 font-bold text-zinc-200">
              <span className={`w-2 h-2 rounded-full ${isCommLost ? "bg-red-500 animate-pulse" : "bg-green-400"}`} />
              {isCommLost ? "COMM LOST" : "CONNECTED"}
            </span>
            <span>RSSI <strong className="text-zinc-200">{sampleMeta.rssi.toFixed(0)} dBm</strong></span>
            <span>SNR <strong className="text-zinc-200">{sampleMeta.snr.toFixed(1)} dB</strong></span>
            <span>LOSS <strong className="text-zinc-200">{sampleMeta.packet_loss_pct.toFixed(1)}%</strong></span>
            <span>LATENCY <strong className="text-sky-400">{sampleMeta.latency_ms.toFixed(0)} ms</strong></span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-zinc-500">SCENARIO:</span>
            <span className="text-[#9281f7] font-bold uppercase">{activeScenario.replace("_", " ")}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-4 md:p-6 space-y-5 max-w-[1700px] w-full mx-auto">
        {children}
      </main>

      {/* Technical Footer */}
      <footer className="border-t border-[#1e2226] px-6 py-2 bg-[#040506] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
        <div>SIH Intelligent Cooperative Collision Prevention System</div>
        <div>Engineered V2V Safety Architecture · ESP32 + LoRa Reference</div>
      </footer>
    </div>
  );
};
