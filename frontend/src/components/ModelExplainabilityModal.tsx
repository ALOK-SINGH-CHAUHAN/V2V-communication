"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import { Cpu, X } from "lucide-react";

export const ModelExplainabilityModal: React.FC = () => {
  const { explainability, showExplainModal, setShowExplainModal } = useFleet();

  if (!showExplainModal) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#000000] border border-[#292d30] rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#292d30]">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-[#9281f7]" />
            <div>
              <h3 className="text-sm font-mono font-bold text-white">
                RANDOM FOREST MODEL EXPLAINABILITY
              </h3>
              <p className="text-[11px] font-mono text-zinc-500">
                Model Version: {explainability?.model_version || "v1.0-rf"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowExplainModal(false)}
            className="p-1.5 rounded-md border border-[#292d30] hover:bg-[#181a1d] text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 font-sans leading-relaxed">
          Feature importances calculated from the trained scikit-learn Random Forest model. Demonstrates the feature weights driving Level 2 Risk Scoring (0–100) alongside the Level 3 deterministic rule floor.
        </p>

        {/* Feature Importance Bar Chart */}
        <div className="space-y-3">
          {explainability ? (
            explainability.feature_names.map((name, idx) => {
              const imp = explainability.feature_importances[idx] || 0;
              const pct = (imp * 100).toFixed(1);

              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300">{name}</span>
                    <span className="text-[#9281f7] font-bold">{pct}%</span>
                  </div>
                  <div className="w-full bg-[#121417] border border-[#292d30] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#9281f7] to-[#70b8ff] h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs font-mono text-zinc-500">
              Loading model feature weights...
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#292d30] flex justify-end">
          <button
            onClick={() => setShowExplainModal(false)}
            className="bg-[#121416] hover:bg-[#1a1d20] text-zinc-200 border border-[#292d30] px-4 py-1.5 rounded-md font-mono text-xs cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
