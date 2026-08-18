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

  const featuredScenario = { id: "full_demo", label: "END-TO-END TEST" };

  const scenarios = [
    { id: "normal_cruising", label: "NORMAL TRAFFIC" },
    { id: "hard_brake",      label: "SUDDEN BRAKE" },
    { id: "communication_loss", label: "COMM LOSS" },
  ];

  return (
    <div className="bg-[#000000] border border-[#292d30] rounded-xl px-4 py-3 font-mono">
      <div className="flex flex-wrap items-center gap-3">

        {/* Label */}
        <div className="flex items-center gap-2 shrink-0">
          <Activity className="w-4 h-4 text-[#9281f7]" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            TEST SCENARIOS
          </span>
        </div>

        {/* Featured: END-TO-END TEST */}
        <button
          onClick={() => triggerScenario(featuredScenario.id)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-black tracking-wider transition-all cursor-pointer ${
            activeScenario === featuredScenario.id
              ? "bg-purple-950/60 border-purple-500 text-purple-300 ring-1 ring-purple-500"
              : "bg-[#0d0f12] border-[#3d2f6e] text-purple-400 hover:border-purple-500"
          }`}
        >
          {activeScenario === featuredScenario.id && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse mr-1.5 -mb-px" />
          )}
          {featuredScenario.label}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-[#292d30]" />

        {/* Individual scenario buttons */}
        {scenarios.map((sc) => {
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => triggerScenario(sc.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider transition-all cursor-pointer ${
                isActive
                  ? "bg-[#121417] border-[#9281f7] text-white ring-1 ring-[#9281f7]"
                  : "bg-[#0a0b0d] border-[#292d30] text-zinc-400 hover:border-[#40464d] hover:text-zinc-200"
              }`}
            >
              {isActive && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9281f7] animate-pulse mr-1.5 -mb-px" />
              )}
              {sc.label}
            </button>
          );
        })}

        {/* Divider */}
        <div className="w-px h-5 bg-[#292d30]" />

        {/* Controls */}
        {isPaused ? (
          <button
            onClick={startSim}
            className="px-3 py-1.5 rounded-lg bg-green-950/80 hover:bg-green-900 border border-green-700/60 text-green-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Play size={11} className="fill-green-400" /> START
          </button>
        ) : (
          <button
            onClick={pauseSim}
            className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Pause size={11} className="fill-amber-400" /> PAUSE
          </button>
        )}

        <button
          onClick={resetSim}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RotateCcw size={11} /> RESET
        </button>

        {/* Running status */}
        <span
          className={`ml-auto text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded border ${
            isPaused
              ? "bg-amber-950/40 text-amber-400 border-amber-800/40"
              : "bg-green-950/40 text-green-400 border-green-800/40"
          }`}
        >
          {isPaused ? "PAUSED" : "● RUNNING"}
        </span>
      </div>

      {/* Live Phase ticker — compact single line */}
      {currentPhase && (
        <div className="mt-2 pt-2 border-t border-[#1a1e22] flex items-center gap-2 text-[10px]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500" />
          </span>
          <span className="text-zinc-500">{currentPhase}</span>
        </div>
      )}
    </div>
  );
};
