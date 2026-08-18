import time
import asyncio
import httpx
from typing import Dict
from scenarios import get_initial_fleet, update_scenario_step

class SyntheticSimulator:
    def __init__(self, backend_url: str = "http://localhost:8000/api/telemetry"):
        self.backend_url = backend_url
        self.active_scenario = "full_demo"    # Default to full interactive demo sequence!
        self.fleet = get_initial_fleet()
        self.step_counter = 0
        self.is_running = False
        self.is_paused = False
        self.current_phase = "Initializing Full Demo Sequence"

    def reset_fleet(self):
        self.fleet = get_initial_fleet()
        self.step_counter = 0
        print("🔄 Fleet reset to initial positions")

    def set_scenario(self, scenario_name: str):
        print(f"🎬 Switch Scenario -> {scenario_name}")
        self.active_scenario = scenario_name
        self.reset_fleet()
        self.is_paused = False

    def pause(self):
        print("⏸ Simulator PAUSED")
        self.is_paused = True

    def resume(self):
        print("▶️ Simulator RESUMED")
        self.is_paused = False

    async def start(self):
        self.is_running = True
        print(f"🚀 Synthetic Telemetry Generator started (target: {self.backend_url})")

        async with httpx.AsyncClient(timeout=1.0) as client:
            while self.is_running:
                if self.is_paused:
                    await asyncio.sleep(0.1)
                    continue

                start_time = time.time()
                payloads, phase_desc = update_scenario_step(self.fleet, self.step_counter, self.active_scenario)
                self.current_phase = phase_desc
                self.step_counter += 1

                for p in payloads:
                    try:
                        await client.post(self.backend_url, json=p)
                    except Exception as e:
                        print(f"Post error for {p.get('vehicle', {}).get('vehicle_id')}: {e}")

                elapsed = time.time() - start_time
                sleep_time = max(0.02, 0.10 - elapsed)
                await asyncio.sleep(sleep_time)

    def stop(self):
        self.is_running = False

    def get_status(self) -> dict:
        return {
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "active_scenario": self.active_scenario,
            "step_counter": self.step_counter,
            "current_phase": self.current_phase,
        }

simulator_instance = SyntheticSimulator()
