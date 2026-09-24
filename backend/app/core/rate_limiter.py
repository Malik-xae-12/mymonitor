import asyncio
from app.core.config import settings


class FabricRateLimiter:
    """
    Limits concurrent outgoing HTTP requests to Microsoft Fabric REST APIs
    to avoid HTTP 429 Too Many Requests errors.
    """
    def __init__(self, max_concurrent: int | None = None):
        limit = max_concurrent or getattr(settings, "MAX_PARALLEL_FABRIC_REQUESTS", 5)
        self._semaphore = asyncio.Semaphore(limit)

    async def run(self, coro):
        async with self._semaphore:
            return await coro


rate_limiter = FabricRateLimiter()
