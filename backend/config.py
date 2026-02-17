"""
Application configuration — environment variables and clinic constants.
"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── Database ────────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/dentalbridge",
)

# ── Redis & Rate Limiting ───────────────────────────────────────────────────
REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
RATE_LIMIT_LOGIN: int = 10  # per minute
RATE_LIMIT_CHATBOT: int = 20  # per hour per user
RATE_LIMIT_TENANT_CHATBOT: int = 500  # per day per tenant
RATE_LIMIT_CREATE_APPOINTMENT: int = 50  # per hour per tenant
RATE_LIMIT_GLOBAL_API: int = int(os.getenv("RATE_LIMIT_GLOBAL_API", 100))  # per minute per tenant

# ── Gemini AI ───────────────────────────────────────────────────────────────
GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY") or None
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# ── Clinic Operating Parameters ─────────────────────────────────────────────
CLINIC_TIMEZONE = "Asia/Kolkata"
DAY_START_HOUR = 9
DAY_END_HOUR = 17
SLOT_MINUTES = 15
SLOTS_PER_DAY = (DAY_END_HOUR - DAY_START_HOUR) * (60 // SLOT_MINUTES)  # 32
BUFFER_SLOTS = 1
SCHEDULE_LOOKAHEAD_DAYS = 14

# ── CORS ────────────────────────────────────────────────────────────────────
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://bronn.dev")

# ── JWT Authentication ──────────────────────────────────────────────────────
JWT_SECRET: str = os.getenv("JWT_SECRET", "bronn-dev-jwt-secret-change-in-production")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRY_MINUTES: int = int(os.getenv("JWT_EXPIRY_MINUTES", "480"))  # 8 hours

# ── Login Security ──────────────────────────────────────────────────────────
MAX_LOGIN_ATTEMPTS: int = 5
LOGIN_LOCKOUT_MINUTES: int = 15

