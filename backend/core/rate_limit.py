import time
import redis
from fastapi import Request, HTTPException, Depends
from typing import Optional, Callable
from config import REDIS_URL
from core.dependencies import get_current_user, UserContext
import logging

logger = logging.getLogger(__name__)

# Initialize Redis client
# Decode responses=True so we get strings instead of bytes
r = redis.from_url(REDIS_URL, decode_responses=True)

class RateLimiter:
    """
    Redis-backed Rate Limiter using Fixed Window algorithm.
    Structure:
      Key: prefix:identifier (e.g., "lim:ip:127.0.0.1")
      Value: count
      TTL: window_seconds
    """
    def __init__(self, key_prefix: str, limit: int, window: int):
        self.key_prefix = key_prefix
        self.limit = limit
        self.window = window

    def is_allowed(self, identifier: str) -> tuple[bool, int, int]:
        """
        Checks if request is allowed.
        Returns: (allowed, current_count, ttl)
        """
        key = f"{self.key_prefix}:{identifier}"
        
        try:
            # Pipeline for atomicity
            pipe = r.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            result = pipe.execute()
            
            current_count = result[0]
            ttl = result[1]
            
            # If key didn't exist, set expiry
            if current_count == 1:
                r.expire(key, self.window)
                ttl = self.window
            
            if current_count > self.limit:
                return False, current_count, ttl
            
            return True, current_count, ttl
            
        except redis.RedisError as e:
            logger.error(f"Redis error in rate limiter: {e}")
            # Fail open if Redis is down logic could be here, but usually better to fail open in production?
            # For now, let's log and allow to avoid blocking valid traffic if Redis blips
            return True, 0, 0

class RateLimitDependency:
    """
    FastAPI Dependency for Per-Route Rate Limiting.
    """
    def __init__(self, limit: int, window: int, scope_func: Callable[[Request], str], key_prefix: str = "lim"):
        self.limiter = RateLimiter(key_prefix, limit, window)
        self.scope_func = scope_func

    async def __call__(self, request: Request):
        identifier = self.scope_func(request)
        allowed, count, ttl = self.limiter.is_allowed(identifier)
        
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after": ttl
                },
                headers={"Retry-After": str(ttl)}
            )

class AuthenticatedRateLimit:
    """
    Rate Limit depending on Authenticated User/Tenant.
    Scope can be "user" or "tenant".
    """
    def __init__(self, limit: int, window: int, scope: str = "user", key_prefix: str = "lim"):
        self.limiter = RateLimiter(key_prefix, limit, window)
        self.scope = scope

    async def __call__(self, user: UserContext = Depends(get_current_user)):
        if self.scope == "tenant":
            identifier = str(user.tenant_id)
            prefix = f"{self.limiter.key_prefix}:tenant"
        else:
            identifier = str(user.user_id)
            prefix = f"{self.limiter.key_prefix}:user"
            
        # Use underlying limiter with modified key? 
        # RateLimiter expects key_prefix + identifier.
        # I passed key_prefix in init.
        # So "lim:tenant-uuid" or "lim:user-uuid".
        # But if scope is tenant, I want keys to be distinct from user scope if IDs clash (unlikely for UUIDs but good practice).
        # Actually simplest: "lim:user:USER_ID" or "lim:tenant:TENANT_ID".
        # RateLimiter uses f"{self.key_prefix}:{identifier}"
        # So if I pass identifier="user:USER_ID", key becomes "lim:user:USER_ID".
        
        prefix_id = f"{self.scope}:{identifier}"
        allowed, count, ttl = self.limiter.is_allowed(prefix_id)
        
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after": ttl
                },
                headers={"Retry-After": str(ttl)}
            )

# ── Scope Helpers ───────────────────────────────────────────────────────────

def get_ip(request: Request) -> str:
    """Extracts IP address from request."""
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

def get_user_id(request: Request) -> str:
    """
    Extracts user_id from Validated UserContext.
    Assumes `request.state.user` is populated by auth middleware/dependency if available.
    Use with caution: Ensure this dependency runs AFTER auth.
    Alternatively, extract from JWT manually if needed, but cleaner to rely on auth dependency.
    """
    # This relies on the fact that `get_current_user` dependency puts user in request.state?
    # Or we can just use the user object if we inject it.
    # For a dependency class, accessing other dependencies is tricky.
    # Simplest approach: Use request.state or look for Authorization header.
    # Logic: If user is authenticated, use user ID. Else fallback to IP.
    
    # Check if user is already attached to request state (common pattern)
    if hasattr(request, "state") and hasattr(request.state, "user"):
        return str(request.state.user.id)
        
    # Fallback to IP if not authenticated yet (or if applied to public endpoint)
    return get_ip(request)

def get_tenant_id(request: Request) -> str:
    """Extracts tenant_id from user context."""
    if hasattr(request, "state") and hasattr(request.state, "user"):
        return str(request.state.user.tenant_id)
    return "unknown_tenant"
