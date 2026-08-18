"use client";

import React from "react";
import { useFleet } from "@/context/FleetContext";
import { Navigation } from "lucide-react";

export const FleetCanvasMap: React.FC = () => {
  const { vehicles, selectedVehicleId, setSelectedVehicleId } = useFleet();

  const getRiskColor = (score: number) => {
    if (score >= 75) return "#ef4444"; // Red
    if (score >= 40) return "#f97316"; // Amber
    return "#22c55e"; // Green
  };

  const v1 = vehicles.find((v) => v.vehicle_id === "V001");
  const v2 = vehicles.find((v) => v.vehicle_id === "V002");

  let interDistance = 0.0;
  if (v1 && v2) {
    const dx = v2.last_position.x - v1.last_position.x;
    const dy = v2.last_position.y - v1.last_position.y;
    interDistance = Math.sqrt(dx * dx + dy * dy);
  }

  // ── DYNAMIC AUTO-ZOOM VIEWPORT ──────────────────────────────────────────────
  // Automatically scales and focuses around V001 and V002 so vehicles fill ~60%
  // of the canvas without large dead space.
  const minY = Math.min(v1?.last_position.y ?? 0, v2?.last_position.y ?? 0) - 30;
  const maxY = Math.max(v1?.last_position.y ?? 400, v2?.last_position.y ?? 400) + 30;
  const ySpan = Math.max(80, maxY - minY);

  const scaleX = (x: number) => 150 + (x / 40) * 200;
  const scaleY = (y: number) => 440 - ((y - minY) / ySpan) * 380;

  return (
    <div className="bg-[#000000] border border-[#292d30] rounded-xl p-4 flex flex-col relative overflow-hidden font-mono">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#292d30] mb-3">
        <div className="flex items-center space-x-2">
          <Navigation className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Spatial Pair Canvas
          </h2>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-zinc-400">Safe (&lt;30)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-zinc-400">Caution (30-75)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-zinc-400">Immediate (&gt;75)</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="w-full flex items-center justify-center bg-[#08090a] border border-[#292d30]/60 rounded-lg p-2 relative">
        <svg
          viewBox="0 0 500 480"
          className="w-full h-[400px] max-w-[600px] select-none"
        >
          {/* Road Infrastructure Grid */}
          <rect x="150" y="20" width="200" height="440" fill="#0c0e10" rx="8" stroke="#1e2226" strokeWidth="1" />
          <rect x="170" y="30" width="160" height="420" fill="#111417" />
          <line x1="250" y1="30" x2="250" y2="450" stroke="#292d30" strokeWidth="2" strokeDasharray="8 8" />

          {/* Inter-Vehicle Distance Vector Callout */}
          {v1 && v2 && (
            <g>
              <line
                x1={scaleX(v1.last_position.x)}
                y1={scaleY(v1.last_position.y)}
                x2={scaleX(v2.last_position.x)}
                y2={scaleY(v2.last_position.y)}
                stroke={interDistance < 30 ? "#ef4444" : "#38bdf8"}
                strokeWidth={interDistance < 30 ? "2.5" : "2"}
                strokeDasharray="4 4"
              />
              <rect
                x={(scaleX(v1.last_position.x) + scaleX(v2.last_position.x)) / 2 - 35}
                y={(scaleY(v1.last_position.y) + scaleY(v2.last_position.y)) / 2 - 12}
                width="70"
                height="22"
                rx="4"
                fill="#000000"
                stroke={interDistance < 30 ? "#ef4444" : "#38bdf8"}
                strokeWidth="1"
              />
              <text
                x={(scaleX(v1.last_position.x) + scaleX(v2.last_position.x)) / 2}
                y={(scaleY(v1.last_position.y) + scaleY(v2.last_position.y)) / 2 + 3}
                fill={interDistance < 30 ? "#ef4444" : "#38bdf8"}
                fontSize="11"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {interDistance.toFixed(1)} m
              </text>
            </g>
          )}

          {/* Soft Red Danger Ring around follower V002 when gap < 30m */}
          {v2 && interDistance < 30 && (
            <circle
              cx={scaleX(v2.last_position.x)}
              cy={scaleY(v2.last_position.y)}
              r="40"
              fill="#ef444415"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="animate-pulse"
            />
          )}

          {/* Render Vehicles */}
          {vehicles.map((v) => {
            const cx = scaleX(v.last_position.x);
            const cy = scaleY(v.last_position.y);
            const isSelected = selectedVehicleId === v.vehicle_id;
            const riskColor = getRiskColor(v.last_risk_score);
            const isStale = v.connectivity_status !== "LIVE";

            return (
              <g
                key={v.vehicle_id}
                onClick={() => setSelectedVehicleId(v.vehicle_id)}
                className="cursor-pointer transition-all duration-300 hover:opacity-90"
              >
                {/* Risk Aura Pulse Ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? "26" : "20"}
                  fill={isStale ? "#f59e0b" : riskColor}
                  fillOpacity={isSelected ? "0.3" : "0.15"}
                  stroke={isStale ? "#f59e0b" : riskColor}
                  strokeWidth={isSelected ? "2" : "1"}
                />

                {/* Vehicle Body Box */}
                <rect
                  x={cx - 16}
                  y={cy - 24}
                  width="32"
                  height="48"
                  rx="6"
                  fill="#090d11"
                  stroke={isSelected ? "#a78bfa" : isStale ? "#f59e0b" : riskColor}
                  strokeWidth={isSelected ? "2.5" : "1.5"}
                />

                {/* Directional Heading Indicator */}
                <polygon
                  points={`${cx},${cy - 20} ${cx - 5},${cy - 12} ${cx + 5},${cy - 12}`}
                  fill="#38bdf8"
                />

                {/* Vehicle ID Label */}
                <text
                  x={cx}
                  y={cy + 4}
                  fill="#ffffff"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {v.vehicle_id}
                </text>

                {/* Speed & Risk Badge below vehicle */}
                <text
                  x={cx}
                  y={cy + 36}
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {(v.last_speed_mps * 3.6).toFixed(0)}km/h | R:{v.last_risk_score.toFixed(0)}
                </text>

                {/* Comm Lost Badge */}
                {isStale && (
                  <text
                    x={cx}
                    y={cy - 30}
                    fill={v.connectivity_status === "COMMUNICATION_LOST" ? "#ef4444" : "#f59e0b"}
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {v.connectivity_status === "COMMUNICATION_LOST" ? "COMM LOST" : "STALE"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
