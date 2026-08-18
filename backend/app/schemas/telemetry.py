from pydantic import BaseModel, Field
from typing import Optional, Literal

class Position(BaseModel):
    x: float = Field(..., description="Local plane X coordinate in meters")
    y: float = Field(..., description="Local plane Y coordinate in meters")

class Vector3D(BaseModel):
    x: float = Field(0.0, description="X component")
    y: float = Field(0.0, description="Y component")
    z: float = Field(0.0, description="Z component")

class VehiclePayload(BaseModel):
    vehicle_id: str = Field(..., description="Unique Vehicle Identification Code")
    seq: int = Field(1, description="Monotonic packet sequence number")
    timestamp: int = Field(..., description="Device epoch timestamp in milliseconds")
    position: Position = Field(..., description="Position in local coordinate plane")
    speed_mps: float = Field(..., description="Current speed in meters per second")
    heading_deg: float = Field(..., description="Heading direction in degrees (0-360)")
    accel: Vector3D = Field(default_factory=Vector3D, description="3-axis accelerometer values in m/s^2")
    gyro: Vector3D = Field(default_factory=Vector3D, description="3-axis gyroscope values in rad/s")
    distance_to_obstacle_m: float = Field(999.0, description="Distance to front obstacle in meters")
    event_flag: Literal["none", "brake", "obstacle", "heartbeat", "emergency"] = Field(
        "none", description="Event flag broadcasted by vehicle hardware"
    )
    crc: str = Field("0x0000", description="Payload CRC16 checksum")

class ReceiverMetadata(BaseModel):
    rssi: float = Field(-72.0, description="LoRa Signal Strength in dBm")
    snr: float = Field(8.5, description="Signal to Noise Ratio in dB")
    packet_loss_pct: float = Field(0.0, description="Calculated packet loss percentage")
    latency_ms: float = Field(45.0, description="Over-the-air + serial transport latency in ms")
    source: Literal["LIVE_HARDWARE", "SIMULATED"] = Field("SIMULATED", description="Data origin")

class TelemetryEvent(BaseModel):
    # Top-level canonical V2V message fields (mirrors ESP32 packet format)
    msg_type: Literal[
        "HEARTBEAT", "BRAKE_ALERT", "OBSTACLE_ALERT", "EMERGENCY_ALERT"
    ] = Field("HEARTBEAT", description="V2V message type — canonical packet category")
    receiver_id: Optional[str] = Field(
        None, description="Intended recipient vehicle ID (e.g. 'V002')"
    )
    vehicle: VehiclePayload
    receiver: ReceiverMetadata = Field(default_factory=ReceiverMetadata)
