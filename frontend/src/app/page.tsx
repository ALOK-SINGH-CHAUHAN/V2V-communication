import React from "react";
import { FleetProvider } from "@/context/FleetContext";
import { AppShell } from "@/components/AppShell";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <FleetProvider>
      <AppShell>
        <Dashboard />
      </AppShell>
    </FleetProvider>
  );
}
