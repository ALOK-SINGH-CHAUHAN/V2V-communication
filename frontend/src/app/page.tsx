import React from "react";
import { FleetProvider } from "@/context/FleetContext";
import { PresentationProvider } from "@/context/PresentationContext";
import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <FleetProvider>
      <PresentationProvider>
        <AppShell>
          <Dashboard />
        </AppShell>
      </PresentationProvider>
    </FleetProvider>
  );
}
