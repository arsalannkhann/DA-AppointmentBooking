"""
FastAPI dependency injection — authentication, authorization, tenant scoping.
"""
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

import jwt as pyjwt

from core.auth import decode_token
from core.db import SessionLocal


# ── Security Scheme ──────────────────────────────────────────────────────────

security = HTTPBearer()


# ── User Context ─────────────────────────────────────────────────────────────

@dataclass
class UserContext:
    """Authenticated user context injected into route handlers."""
    user_id: UUID
    tenant_id: Optional[UUID]  # None for global patients
    role: str
    jti: str


# ── Database Session Dependency ──────────────────────────────────────────────

def get_db_session():
    """Yield a database session, auto-closing after request."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Auth Dependencies ────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db_session),
) -> UserContext:
    """
    Decode JWT from Authorization header and return UserContext.
    Also checks token is not blacklisted.
    """
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    # Check blacklist
    from models.models import TokenBlacklist
    jti = payload.get("jti")
    if jti and db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    # Parse tenant_id — may be empty for global patients
    raw_tenant = payload.get("tenant_id", "")
    tenant_id = UUID(raw_tenant) if raw_tenant else None

    return UserContext(
        user_id=UUID(payload["sub"]),
        tenant_id=tenant_id,
        role=payload["role"],
        jti=jti or "",
    )


def require_role(*allowed_roles: str):
    """
    Factory: returns a dependency that enforces role-based access.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
    """
    def _checker(user: UserContext = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(allowed_roles)}",
            )
        return user
    return _checker
