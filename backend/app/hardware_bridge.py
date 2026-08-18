import sys
import time
import json
import asyncio
import httpx

try:
    import serial
except ImportError:
    serial = None

BACKEND_URL = "http://localhost:8000/api/telemetry"

class SerialHardwareBridge:
    def __init__(self, port: str = "/dev/tty.usbmodem14101", baudrate: int = 115200):
        self.port = port
        self.baudrate = baudrate
        self.last_seq = 0
        self.lost_packets = 0
        self.total_packets = 0

    def start_bridge(self):
        if serial is None:
            print("pyserial module not installed. Install with `pip install pyserial` to run real ESP32 hardware bridge.")
            return

        print(f"🔌 Connecting to physical ESP32 gateway on {self.port} @ {self.baudrate} baud...")
        try:
            ser = serial.Serial(self.port, self.baudrate, timeout=1.0)
            print("🟢 ESP32 Hardware Bridge Active. Streaming real V2V LoRa telemetry...")
            
            with httpx.Client(timeout=1.0) as client:
                while True:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if not line or not line.startswith("{"):
                        continue

                    try:
                        raw_data = json.loads(line)
                        recv_ts = int(time.time() * 1000)
                        
                        # Extract sequence & compute packet loss
                        seq = raw_data.get("seq", self.last_seq + 1)
                        if self.last_seq > 0 and seq > self.last_seq + 1:
                            self.lost_packets += (seq - self.last_seq - 1)
                        self.last_seq = seq
                        self.total_packets += 1

                        packet_loss_pct = (self.lost_packets / max(1, self.total_packets + self.lost_packets)) * 100.0
                        sent_ts = raw_data.get("timestamp", recv_ts)
                        latency_ms = max(5.0, float(recv_ts - sent_ts))

                        # Build standardized TelemetryEvent payload
                        telemetry_payload = {
                            "vehicle": {
                                "vehicle_id": raw_data.get("vehicle_id", "ESP32_V001"),
                                "seq": seq,
                                "timestamp": sent_ts,
                                "position": raw_data.get("position", {"x": 10.0, "y": 100.0}),
                                "speed_mps": raw_data.get("speed_mps", 0.0),
                                "heading_deg": raw_data.get("heading_deg", 90.0),
                                "accel": raw_data.get("accel", {"x": 0.0, "y": 0.0, "z": 9.8}),
                                "gyro": raw_data.get("gyro", {"x": 0.0, "y": 0.0, "z": 0.0}),
                                "distance_to_obstacle_m": raw_data.get("distance_to_obstacle_m", 999.0),
                                "event_flag": raw_data.get("event_flag", "none"),
                                "crc": raw_data.get("crc", "0x4A8F")
                            },
                            "receiver": {
                                "rssi": raw_data.get("rssi", -72.0),
                                "snr": raw_data.get("snr", 8.5),
                                "packet_loss_pct": round(packet_loss_pct, 1),
                                "latency_ms": round(latency_ms, 1),
                                "source": "LIVE_HARDWARE"
                            }
                        }

                        res = client.post(BACKEND_URL, json=telemetry_payload)
                        print(f"Received ESP32 packet seq #{seq} -> Backend status: {res.status_code}")

                    except json.JSONDecodeError:
                        pass
                    except Exception as e:
                        print(f"Bridge error: {e}")

        except Exception as e:
            print(f"❌ Serial connection error ({e}). Ensure ESP32 is connected via USB.")

if __name__ == "__main__":
    port_name = sys.argv[1] if len(sys.argv) > 1 else "/dev/tty.usbmodem14101"
    bridge = SerialHardwareBridge(port=port_name)
    bridge.start_bridge()
