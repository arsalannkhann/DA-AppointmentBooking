
import pytest
import time
import redis
from core.rate_limit import RateLimiter
from config import REDIS_URL

# Check if Redis is available
try:
    r = redis.from_url(REDIS_URL)
    r.ping()
    redis_available = True
except redis.RedisError:
    redis_available = False

@pytest.mark.skipif(not redis_available, reason="Redis not available")
class TestRateLimiter:
    def setup_method(self):
        self.r = redis.from_url(REDIS_URL, decode_responses=True)
        self.prefix = "test_lim"
        # Clean up keys before test
        keys = self.r.keys(f"{self.prefix}:*")
        if keys:
            self.r.delete(*keys)

    def test_allow_request(self):
        limiter = RateLimiter(self.prefix, limit=10, window=60)
        allowed, count, ttl = limiter.is_allowed("user1")
        assert allowed is True
        assert count == 1
        assert ttl <= 60

    def test_block_excess_requests(self):
        # Limit 2 requests per minute
        limiter = RateLimiter(self.prefix, limit=2, window=60)
        
        # 1st request
        allowed, count, _ = limiter.is_allowed("user2")
        assert allowed is True
        assert count == 1
        
        # 2nd request
        allowed, count, _ = limiter.is_allowed("user2")
        assert allowed is True
        assert count == 2
        
        # 3rd request (Should verify strictly > limit)
        # Wait, implementation says: if current_count > self.limit
        # So if limit is 2, 3rd request makes count 3. 3 > 2 is True -> Block.
        allowed, count, _ = limiter.is_allowed("user2")
        assert allowed is False
        assert count == 3

    def test_window_expiry(self):
        # Limit 1 request per 1 second
        limiter = RateLimiter(self.prefix, limit=1, window=1)
        
        # 1st
        limiter.is_allowed("user3")
        
        # 2nd (blocked)
        allowed, _, _ = limiter.is_allowed("user3")
        assert allowed is False
        
        # Wait for expiry
        time.sleep(1.1)
        
        # Should be allowed again (new window or expired key)
        # Note: Fixed Window means key expires.
        allowed, count, _ = limiter.is_allowed("user3")
        assert allowed is True
        assert count == 1
