"use client";

import React from "react";
import { V2VTransmissionPanel } from "@/components/V2VTransmissionPanel";
import { MessageJourneyBar } from "@/components/MessageJourneyBar";
import { FleetCanvasMap } from "@/components/FleetCanvasMap";
import { RiskAnalysisPanel } from "@/components/RiskAnalysisPanel";
import { AlertFeed } from "@/components/AlertFeed";
import { SimulationControls } from "@/components/SimulationControls";
import { VehicleDetailPanel } from "@/components/VehicleDetailPanel";
import { ModelExplainabilityModal } from "@/components/ModelExplainabilityModal";
import { CurrentSafetyEventBanner } from "@/components/CurrentSafetyEventBanner";
import { PresentationControls } from "@/components/PresentationControls";
import { PresentationStageIndicator } from "@/components/PresentationStageIndicator";

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-3">
      {/* ROW 1: Compact scenario controls */}
      <SimulationControls />

      {/* ROW 2: Demo mode — LIVE / AUTO / STEP + speed + NEXT button */}
      <PresentationControls />

      {/* ROW 3: Current Safety Event banner — instant one-line situation awareness */}
      <CurrentSafetyEventBanner />

      {/* ROW 4: Stage flow indicator + WHY RISK CHANGED (visible in AUTO/STEP only) */}
      <PresentationStageIndicator />

      {/* ROW 5: V2V Transmission Hero (full width) */}
      <V2VTransmissionPanel />

      {/* ROW 6: Message Journey pipeline bar (full width) */}
      <MessageJourneyBar />

      {/* ROW 7: Vehicle spatial visualization + Risk analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <FleetCanvasMap />
        </div>
        <div className="lg:col-span-5">
          <RiskAnalysisPanel />
        </div>
      </div>

      {/* ROW 8: Event / Safety Log */}
      <AlertFeed />

      {/* Overlays */}
      <VehicleDetailPanel />
      <ModelExplainabilityModal />
    </div>
  );
};
