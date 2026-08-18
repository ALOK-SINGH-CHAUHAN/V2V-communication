import os

class Settings:
    PROJECT_NAME: str = "V2V Intelligence & Decision System"
    VERSION: str = "1.0.0"
    
    # Deterministic Rule Floor & Thresholds
    HARD_TTC_THRESHOLD: float = float(os.getenv("HARD_TTC_THRESHOLD", "2.0"))  # seconds
    HIGH_RISK_THRESHOLD: float = float(os.getenv("HIGH_RISK_THRESHOLD", "75.0"))
    MED_RISK_THRESHOLD: float = float(os.getenv("MED_RISK_THRESHOLD", "40.0"))
    
    # Emergency Vehicle Priority (EVP)
    CORRIDOR_RADIUS_M: float = float(os.getenv("CORRIDOR_RADIUS_M", "60.0"))   # meters
    HEADING_ALIGNMENT_TOLERANCE_DEG: float = float(os.getenv("HEADING_ALIGNMENT_TOLERANCE_DEG", "45.0"))
    
    # Cooperative Lane Merge Assist
    MERGE_SAFE_TTC_THRESHOLD: float = float(os.getenv("MERGE_SAFE_TTC_THRESHOLD", "3.5"))  # seconds
    
    # Digital Twin Staleness Timeout
    STALENESS_TIMEOUT_S: float = float(os.getenv("STALENESS_TIMEOUT_S", "2.0"))  # seconds
    
    # Spatial Proximity Radius for vehicle pair evaluations
    SPATIAL_PROXIMITY_RADIUS_M: float = float(os.getenv("SPATIAL_PROXIMITY_RADIUS_M", "100.0"))

settings = Settings()
