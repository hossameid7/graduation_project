import pickle
import os
from django.conf import settings
import logging
import lightgbm as lgb

logger = logging.getLogger(__name__)

# Load the ML model once at startup
FDD_MODEL_PATH = os.path.join(settings.BASE_DIR, "assets", "stacking_model.pkl")
RUL_MODEL_PATH = os.path.join(settings.BASE_DIR, "assets", "lightgbm_model.pkl")
FDD_SCALER_PATH = os.path.join(settings.BASE_DIR, "assets", "fdd_scaler.pkl")
RUL_SCALER_PATH = os.path.join(settings.BASE_DIR, "assets", "rul_scaler.pkl")
LE_PATH = os.path.join(settings.BASE_DIR, "assets", "label_encoder.pkl")
FDD_SCALER = None
RUL_SCALER = None
FDD_MODEL = None
RUL_MODEL = None
le = None

def load_models():
    global FDD_MODEL, RUL_MODEL, FDD_SCALER, RUL_SCALER
    try:
        logger.info(f"Loading FDD model from {FDD_MODEL_PATH}")
        with open(FDD_MODEL_PATH, "rb") as f:
            FDD_MODEL = pickle.load(f)
        
        logger.info(f"Loading FDD model from {FDD_MODEL}")

        logger.info(f"Loading RUL model from {RUL_MODEL_PATH}")
        with open(RUL_MODEL_PATH, "rb") as f:
            RUL_MODEL = pickle.load(f)

        logger.info(f"Loading FDD model from {RUL_MODEL}")

        with open(FDD_SCALER_PATH, "rb") as f:
            FDD_SCALER = pickle.load(f)
        
        with open(RUL_SCALER_PATH, "rb") as f:
            RUL_SCALER = pickle.load(f)

        
        with open(LE_PATH, "rb") as f:
            le = pickle.load(f)

        logger.info("Models loaded successfully")
        return True
    except FileNotFoundError as e:
        logger.error(f"Model file not found: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Error loading models: {str(e)}")
        return False

# Load models when module is imported
if not load_models():
    logger.error("Failed to load ML models. Predictions will not work.")

