import asyncio
from backend.app.core.config import settings

class FabricRateLimiter:
    """
    Limits concurrent outgoing HTTP requests to Microsoft Fabric REST APIs
    to avoid HTTP 429 Too Many Requests errors.
    """
    def __init__(self, max_concurrent: int = settings.MAX_PARALLEL_FABRIC_REQUESTS):
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def run(self, coro):
        async with self._semaphore:
            return await coro

rate_limiter = FabricRateLimiter()

