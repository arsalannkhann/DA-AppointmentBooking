"""
Auth routes — clinic registration, login, logout, profile.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from core.auth import (
    hash_password,
    verify_password,
    validate_password_strength,
    create_access_token,
    decode_token,
)
from core.dependencies import get_current_user, get_db_session, UserContext
from models.models import (
    Clinic, User, AuditLog, TokenBlacklist, LoginAttempt, Patient,
)
from config import MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_MINUTES

router = APIRouter()


# ── Request / Response Schemas ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    clinic_name: str
    email: str
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    tenant_id: str
    email: str
    full_name: str
    role: str
    clinic_name: str


# ── Register (Create Clinic + Admin User) ────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db_session)):
    """Create a new clinic (tenant) and its admin user."""
    # Validate password strength
    pw_error = validate_password_strength(data.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    # Check if email already exists globally
    existing = db.query(User).filter(User.email == data.email, User.is_deleted == False).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create clinic (tenant)
    clinic = Clinic(
        name=data.clinic_name,
        onboarding_complete=False,
    )
    db.add(clinic)
    db.flush()

    # Create admin user
    user = User(
        tenant_id=clinic.clinic_id,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role="admin",
    )
    db.add(user)
    db.flush()

    # Audit log
    db.add(AuditLog(
        tenant_id=clinic.clinic_id,
        user_id=user.id,
        action="REGISTER",
        entity_type="clinic",
        entity_id=str(clinic.clinic_id),
        details={"clinic_name": data.clinic_name, "admin_email": data.email},
    ))

    # Issue JWT
    token = create_access_token(
        user_id=str(user.id),
        tenant_id=str(clinic.clinic_id),
        role=user.role,
    )

    return {
        "token": token,
        "user": {
            "user_id": str(user.id),
            "tenant_id": str(clinic.clinic_id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "clinic_name": clinic.name,
        },
        "onboarding_complete": clinic.onboarding_complete,
    }


# ── Login ────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db_session)):
    """Authenticate with email + password, return JWT."""
    now = datetime.now(timezone.utc)

    # Check login attempts / lockout
    attempt = db.query(LoginAttempt).filter(LoginAttempt.email == data.email).first()
    if attempt and attempt.locked_until and attempt.locked_until > now:
        remaining = int((attempt.locked_until - now).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Account temporarily locked. Try again in {remaining} minutes.",
        )

    # Find user
    user = (
        db.query(User)
        .filter(User.email == data.email, User.is_deleted == False, User.is_active == True)
        .first()
    )

    if not user or not verify_password(data.password, user.hashed_password):
        # Record failed attempt
        if attempt:
            attempt.attempt_count += 1
            attempt.last_attempt = now
            if attempt.attempt_count >= MAX_LOGIN_ATTEMPTS:
                attempt.locked_until = now + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
        else:
            db.add(LoginAttempt(email=data.email, attempt_count=1, last_attempt=now))

        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear login attempts on success
    if attempt:
        db.delete(attempt)

    # Load clinic
    clinic = db.query(Clinic).filter(Clinic.clinic_id == user.tenant_id).first()

    # Audit log
    client_ip = request.client.host if request.client else None
    db.add(AuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="LOGIN",
        entity_type="user",
        entity_id=str(user.id),
        ip_address=client_ip,
    ))

    # Issue JWT
    token = create_access_token(
        user_id=str(user.id),
        tenant_id=str(user.tenant_id),
        role=user.role,
    )

    return {
        "token": token,
        "user": {
            "user_id": str(user.id),
            "tenant_id": str(user.tenant_id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "clinic_name": clinic.name if clinic else "",
        },
        "onboarding_complete": clinic.onboarding_complete if clinic else False,
    }


# ── Logout (Token Blacklist) ────────────────────────────────────────────────

@router.post("/logout")
def logout(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Blacklist the current JWT to prevent reuse."""
    # Decode again to get expiry
    token_payload = {"jti": user.jti, "sub": str(user.user_id)}

    # We need the actual expiry — re-derive from a reasonable max
    from config import JWT_EXPIRY_MINUTES
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)

    # Blacklist current token
    blacklist_entry = TokenBlacklist(
        jti=user.jti,
        expires_at=expires_at,
    )
    if user.role == "patient":
        blacklist_entry.patient_id = user.user_id
    else:
        blacklist_entry.user_id = user.user_id
    
    db.add(blacklist_entry)

    # Audit log
    audit_entry = AuditLog(
        tenant_id=user.tenant_id,
        action="LOGOUT",
        entity_type="user",
        entity_id=str(user.user_id),
    )
    if user.role == "patient":
        audit_entry.patient_id = user.user_id
    else:
        audit_entry.user_id = user.user_id
    
    db.add(audit_entry)

    return {"message": "Logged out successfully"}


# ── Me (Current User Profile) ───────────────────────────────────────────────

@router.get("/me")
def me(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Return current authenticated user's profile."""
    if user.role == "patient":
        patient = db.query(Patient).filter(Patient.patient_id == user.user_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        return {
            "user_id": str(patient.patient_id),
            "tenant_id": str(patient.tenant_id) if patient.tenant_id else "",
            "email": patient.email,
            "patient_name": patient.name,
            "role": "patient",
            "created_at": str(patient.created_at),
        }

    db_user = db.query(User).filter(User.id == user.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    clinic = db.query(Clinic).filter(Clinic.clinic_id == user.tenant_id).first()

    return {
        "user_id": str(db_user.id),
        "tenant_id": str(db_user.tenant_id),
        "email": db_user.email,
        "full_name": db_user.full_name,
        "role": db_user.role,
        "clinic_name": clinic.name if clinic else "",
        "onboarding_complete": clinic.onboarding_complete if clinic else False,
        "created_at": str(db_user.created_at),
    }
