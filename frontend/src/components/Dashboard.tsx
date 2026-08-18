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

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-5">
      {/* ROW 1: Scenario controls */}
      <SimulationControls />

      {/* ROW 2: V2V Transmission Hero (full width) */}
      <V2VTransmissionPanel />

      {/* ROW 3: Message Journey pipeline bar (full width) */}
      <MessageJourneyBar />

      {/* ROW 4: Vehicle spatial visualization + Risk analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <FleetCanvasMap />
        </div>
        <div className="lg:col-span-5">
          <RiskAnalysisPanel />
        </div>
      </div>

      {/* ROW 5: Event / Message Timeline */}
      <AlertFeed />

      {/* Overlays */}
      <VehicleDetailPanel />
      <ModelExplainabilityModal />
    </div>
  );
};
