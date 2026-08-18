"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import { Play, Pause, RotateCcw, Activity } from "lucide-react";

export const SimulationControls: React.FC = () => {
  const {
    activeScenario,
    isPaused,
    currentPhase,
    triggerScenario,
    startSim,
    pauseSim,
    resetSim,
  } = useFleet();

  const scenarios = [
    {
      id: "full_demo",
      label: "END-TO-END TEST",
      desc: "Auto-sequence covering all 5 situations (Cruising → Hard Brake → Reaction → Comm Loss → Re-sync)",
      featured: true,
    },
    {
      id: "normal_cruising",
      label: "1. Normal Traffic",
      desc: "Baseline safe multi-vehicle flow & heartbeat stream",
      featured: false,
    },
    {
      id: "hard_brake",
      label: "2. Sudden Hard Brake",
      desc: "LoRa warning → Risk escalation (Early → High → Immediate) → Reaction",
      featured: false,
    },
    {
      id: "communication_loss",
      label: "3. Communication Loss",
      desc: "Telemetry timeout → STALE → COMM_LOST",
      featured: false,
    },
  ];

  return (
    <div className="bg-[#000000] border border-[#292d30] rounded-xl p-4 space-y-3 font-mono">
      {/* Header & Main Start/Pause/Reset Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#292d30]">
        <div className="flex items-center space-x-3">
          <Activity className="w-4 h-4 text-[#9281f7]" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              TEST SCENARIOS
            </h2>
          </div>
        </div>

        {/* Start / Pause / Reset Buttons */}
        <div className="flex items-center space-x-2">
          {isPaused ? (
            <button
              onClick={startSim}
              className="px-3.5 py-1.5 rounded-lg bg-green-950/80 hover:bg-green-900 border border-green-700/60 text-green-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
            >
              <Play size={13} className="fill-green-400" /> Start Sim
            </button>
          ) : (
            <button
              onClick={pauseSim}
              className="px-3.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
            >
              <Pause size={13} className="fill-amber-400" /> Pause Sim
            </button>
          )}

          <button
            onClick={resetSim}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Reset fleet positions to initial state"
          >
            <RotateCcw size={13} /> Reset Fleet
          </button>

          <span
            className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase border ${
              isPaused
                ? "bg-amber-950/40 text-amber-400 border-amber-800/40"
                : "bg-green-950/40 text-green-400 border-green-800/40"
            }`}
          >
            {isPaused ? "PAUSED" : "RUNNING"}
          </span>
        </div>
      </div>

      {/* Scenario Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {scenarios.map((sc) => {
          const isActive = activeScenario === sc.id;

          return (
            <button
              key={sc.id}
              onClick={() => triggerScenario(sc.id)}
              className={`p-3 rounded-lg border text-left flex flex-col justify-between space-y-2 transition-all cursor-pointer ${
                isActive
                  ? sc.featured
                    ? "bg-purple-950/50 border-purple-500 ring-1 ring-purple-500"
                    : "bg-[#121417] border-[#9281f7] ring-1 ring-[#9281f7]"
                  : "bg-[#0a0b0d] border-[#292d30] hover:border-[#40464d] hover:bg-[#101215]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold ${
                      sc.featured ? "text-purple-300" : "text-white"
                    }`}
                  >
                    {sc.label}
                  </span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-[#9281f7] animate-pulse"></span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-snug">{sc.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Phase Progress Banner */}
      {currentPhase && (
        <div className="bg-slate-900/90 border border-slate-700/60 rounded-lg px-3.5 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <span className="font-bold text-slate-200">
              {currentPhase}
            </span>
          </div>
          <span className="text-[10px] text-purple-400 uppercase tracking-widest hidden sm:inline">
            Active Phase
          </span>
        </div>
      )}
    </div>
  );
};
