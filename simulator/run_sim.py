import asyncio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from generator import simulator_instance

sim_app = FastAPI(title="Synthetic Telemetry Simulator Control")

sim_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@sim_app.post("/sim/scenario/{scenario_name}")
async def switch_scenario(scenario_name: str):
    valid_scenarios = ["full_demo", "normal_cruising", "hard_brake", "communication_loss"]
    if scenario_name not in valid_scenarios:
        return {"status": "error", "message": f"Invalid scenario. Choose from {valid_scenarios}"}
    simulator_instance.set_scenario(scenario_name)
    return {"status": "success", "active_scenario": scenario_name, "status_info": simulator_instance.get_status()}

@sim_app.post("/sim/start")
async def start_sim():
    simulator_instance.resume()
    return {"status": "success", "message": "Simulator resumed", "status_info": simulator_instance.get_status()}

@sim_app.post("/sim/pause")
async def pause_sim():
    simulator_instance.pause()
    return {"status": "success", "message": "Simulator paused", "status_info": simulator_instance.get_status()}

@sim_app.post("/sim/reset")
async def reset_sim():
    simulator_instance.reset_fleet()
    return {"status": "success", "message": "Fleet reset to initial state", "status_info": simulator_instance.get_status()}

@sim_app.get("/sim/status")
async def get_sim_status():
    return simulator_instance.get_status()

@sim_app.on_event("startup")
async def start_sim_loop():
    asyncio.create_task(simulator_instance.start())

if __name__ == "__main__":
    uvicorn.run(sim_app, host="0.0.0.0", port=8001)
