import os
import joblib
import pandas as pd
from typing import Dict, List
from app.intelligence.train_model import MODEL_PATH, FEATURE_NAMES, train_and_save_model
from app.schemas.decision import ModelExplainability

class RiskModelManager:
    def __init__(self):
        self.model = None
        self.feature_names = FEATURE_NAMES
        self.feature_importances = []
        self.version = "v1.0-rf"
        self.load_or_train()

    def load_or_train(self):
        if not os.path.exists(MODEL_PATH):
            train_and_save_model()
            
        try:
            artifact = joblib.load(MODEL_PATH)
            self.model = artifact["model"]
            self.feature_names = artifact.get("feature_names", FEATURE_NAMES)
            self.version = artifact.get("version", "v1.0-rf")
            self.feature_importances = artifact.get("feature_importances", [])
        except Exception as e:
            train_and_save_model()
            artifact = joblib.load(MODEL_PATH)
            self.model = artifact["model"]
            self.feature_names = artifact.get("feature_names", FEATURE_NAMES)
            self.version = artifact.get("version", "v1.0-rf")
            self.feature_importances = artifact.get("feature_importances", [])

    def predict_risk(self, feature_dict: Dict[str, float]) -> float:
        row = [feature_dict.get(fname, 0.0) for fname in self.feature_names]
        df_row = pd.DataFrame([row], columns=self.feature_names)
        pred = self.model.predict(df_row)[0]
        return float(max(0.0, min(100.0, pred)))

    def get_explainability(self) -> ModelExplainability:
        return ModelExplainability(
            model_version=self.version,
            feature_names=self.feature_names,
            feature_importances=self.feature_importances
        )

risk_model = RiskModelManager()
