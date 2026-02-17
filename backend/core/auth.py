"""
Core authentication utilities — password hashing, JWT token management.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_MINUTES


# ── Password Hashing ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def validate_password_strength(password: str) -> Optional[str]:
    """
    Validate password meets minimum strength requirements.
    Returns error message string if invalid, None if valid.
    """
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one digit"
    return None


# ── JWT Token Management ────────────────────────────────────────────────────

def create_access_token(
    user_id: str,
    tenant_id: str,
    role: str,
    expiry_minutes: int = None,
) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=expiry_minutes or JWT_EXPIRY_MINUTES)
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id) if tenant_id else "",
        "role": role,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": exp,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ── Aliases & Patient Auth Helpers ──────────────────────────────────────────

# Alias used by patient_auth routes
get_password_hash = hash_password


def check_login_rate_limit(db, email: str) -> bool:
    """
    Check whether login is allowed based on attempt count.
    Returns True if login attempt is allowed, False if locked out.
    """
    from models.models import LoginAttempt
    from config import MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_MINUTES

    now = datetime.now(timezone.utc)
    attempt = db.query(LoginAttempt).filter(LoginAttempt.email == email).first()
    if attempt and attempt.locked_until and attempt.locked_until > now:
        return False
    return True


def reset_login_attempts(db, email: str):
    """Clear login attempts after successful authentication."""
    from models.models import LoginAttempt

    attempt = db.query(LoginAttempt).filter(LoginAttempt.email == email).first()
    if attempt:
        db.delete(attempt)


