"""
core/config.py – centralised settings via pydantic-settings
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # API
    GEMINI_API_KEY: str = ""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # Processing
    FRAME_SKIP: int = 3                  # GPU can handle every 3rd frame easily
    CONFIDENCE_THRESHOLD: float = 0.5
    ANOMALY_THRESHOLD: float = 0.65
    MAX_VIDEO_DURATION: int = 3600

    # GPU / Model
    YOLO_MODEL: str = "yolov8m.pt"       # n / s / m / l / x
    USE_FP16: bool = True                # half-precision on RTX Tensor Cores
    CUDA_DEVICE: int = 0                 # GPU index (0 for single GPU)

    # Storage
    UPLOAD_DIR: str = "uploads"
    OUTPUT_DIR: str = "outputs"
    DATABASE_URL: str = "sqlite+aiosqlite:///./surveillance.db"

    # SMTP (optional)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    ALERT_EMAIL: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def ensure_dirs(self):
        Path(self.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
