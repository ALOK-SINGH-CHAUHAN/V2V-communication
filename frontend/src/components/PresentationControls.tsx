"use client";

import React from "react";
import {
  usePresentationContext,
  PresentationMode,
  PresentationSpeed,
  STAGE_ORDER,
} from "@/context/PresentationContext";
import { Monitor, Play, ChevronRight, Gauge } from "lucide-react";

export const PresentationControls: React.FC = () => {
  const { mode, speed, currentStage, nextStagePending, advanceStage, setMode, setSpeed } =
    usePresentationContext();

  const stageIdx = STAGE_ORDER.indexOf(currentStage);
  const totalStages = STAGE_ORDER.length;

  const modes: { id: PresentationMode; label: string; hint: string }[] = [
    { id: "LIVE",  label: "LIVE",  hint: "Real-time 10Hz passthrough" },
    { id: "AUTO",  label: "AUTO",  hint: "Auto-advance with timing" },
    { id: "STEP",  label: "STEP",  hint: "Manual [ NEXT ] control" },
  ];

  const speeds: PresentationSpeed[] = [0.5, 1, 2];

  return (
    <div className="bg-[#050607] border border-[#1e2226] rounded-xl px-4 py-2.5 font-mono flex flex-wrap items-center gap-3">

      {/* Icon + Label */}
      <div className="flex items-center gap-2 shrink-0">
        <Monitor size={13} className="text-[#9281f7]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          DEMO MODE
        </span>
      </div>

      <div className="w-px h-4 bg-[#292d30]" />

      {/* Mode selector */}
      <div className="flex items-center gap-1 bg-[#0a0b0d] rounded-lg p-0.5 border border-[#292d30]">
        {modes.map((m) => (
          <button
            key={m.id}
            title={m.hint}
            onClick={() => setMode(m.id)}
            className={`px-2.5 py-1 rounded text-[11px] font-black tracking-wider transition-all cursor-pointer ${
              mode === m.id
                ? m.id === "LIVE"
                  ? "bg-green-900/70 text-green-300 border border-green-700/60"
                  : m.id === "AUTO"
                  ? "bg-[#9281f7]/20 text-[#9281f7] border border-[#9281f7]/40"
                  : "bg-sky-900/60 text-sky-300 border border-sky-700/60"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m.id === "LIVE" && mode === "LIVE" && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-1 -mb-px" />
            )}
            {m.label}
          </button>
        ))}
      </div>

      {/* Speed selector (hidden in LIVE) */}
      {mode !== "LIVE" && (
        <>
          <div className="w-px h-4 bg-[#292d30]" />
          <div className="flex items-center gap-1.5">
            <Gauge size={11} className="text-zinc-500" />
            <span className="text-[10px] text-zinc-600">SPEED</span>
            <div className="flex items-center gap-0.5 bg-[#0a0b0d] rounded border border-[#292d30] p-0.5">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    speed === s
                      ? "bg-[#9281f7]/30 text-[#9281f7]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Stage counter (AUTO/STEP) */}
      {mode !== "LIVE" && stageIdx >= 0 && (
        <>
          <div className="w-px h-4 bg-[#292d30]" />
          <span className="text-[10px] text-zinc-600 font-mono">
            STAGE{" "}
            <span className="text-zinc-300 font-bold">
              {stageIdx + 1}
            </span>
            /{totalStages}
          </span>
        </>
      )}

      {/* NEXT button — STEP mode only */}
      {mode === "STEP" && (
        <>
          <div className="ml-auto" />
          <button
            onClick={advanceStage}
            disabled={!nextStagePending}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black tracking-wider border transition-all cursor-pointer ${
              nextStagePending
                ? "bg-green-950/80 border-green-600 text-green-300 shadow-[0_0_12px_rgba(74,222,128,0.3)] animate-pulse"
                : "bg-[#0a0b0d] border-[#292d30] text-zinc-600 cursor-not-allowed"
            }`}
          >
            <Play size={11} className={nextStagePending ? "fill-green-400" : "fill-zinc-600"} />
            NEXT
            <ChevronRight size={11} />
          </button>
        </>
      )}

      {/* AUTO mode live indicator */}
      {mode === "AUTO" && (
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9281f7] animate-pulse inline-block" />
          AUTO-ADVANCING
        </div>
      )}
    </div>
  );
};
