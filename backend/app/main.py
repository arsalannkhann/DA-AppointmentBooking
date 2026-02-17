"""
FastAPI application — Dental Appointment Orchestration API.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from config import FRONTEND_URL
from routers.patients import router as patients_router
from routers.triage import router as triage_router
from routers.slots import router as slots_router
from routers.appointments import router as appointments_router
from routers.dashboard import router as dashboard_router
from routers.settings import router as settings_router
from routers.auth import router as auth_router
from routers.patient_auth import router as patient_auth_router
from routers.onboarding import router as onboarding_router
from core.rate_limit import RateLimitDependency, get_ip
from config import RATE_LIMIT_LOGIN

app = FastAPI(
    title="Bronn AI — Appointment Orchestration API",
    version="2.0.0",
    description="AI-driven dental scheduling with multi-tenant auth and onboarding",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "https://bronn.dev", "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routes ────────────────────────────────────────────────────────────
# ── Public routes ────────────────────────────────────────────────────────────
app.include_router(
    auth_router, 
    prefix="/api/auth", 
    tags=["Auth"],
    dependencies=[Depends(RateLimitDependency(limit=RATE_LIMIT_LOGIN, window=60, scope_func=get_ip, key_prefix="auth_lim"))]
)
app.include_router(
    patient_auth_router,
    prefix="",
    dependencies=[Depends(RateLimitDependency(limit=RATE_LIMIT_LOGIN, window=60, scope_func=get_ip, key_prefix="auth_lim"))]
)

# ── Protected routes ─────────────────────────────────────────────────────────
from core.rate_limit import AuthenticatedRateLimit
from config import RATE_LIMIT_GLOBAL_API

global_limit = [Depends(AuthenticatedRateLimit(limit=RATE_LIMIT_GLOBAL_API, window=60, scope="tenant"))]

app.include_router(onboarding_router, prefix="/api/onboarding", tags=["Onboarding"], dependencies=global_limit)
app.include_router(patients_router, prefix="/api/patients", tags=["Patients"], dependencies=global_limit)
app.include_router(triage_router, prefix="/api/triage", tags=["Triage"], dependencies=global_limit)
app.include_router(slots_router, prefix="/api/slots", tags=["Scheduling"], dependencies=global_limit)
app.include_router(appointments_router, prefix="/api/appointments", tags=["Appointments"], dependencies=global_limit)
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"], dependencies=global_limit)
app.include_router(settings_router, prefix="/api/settings", tags=["Settings"], dependencies=global_limit)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Bronn AI — Appointment Orchestration API", "version": "2.0.0"}
