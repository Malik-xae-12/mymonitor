"""
Background scheduler for periodic cleanup of expired/revoked refresh tokens.

Uses a simple asyncio background task — no external dependencies needed.
Runs inside the FastAPI event loop, started on app startup.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, and_, or_

from app.core.config import settings
from app.db.session import async_session_maker
from app.modules.auth.models.refresh_token import RefreshToken

logger = logging.getLogger(__name__)


async def cleanup_expired_tokens() -> int:
    """Delete refresh tokens that are revoked or expired and older than the
    configured retention period.

    Returns the number of deleted rows.
    """
    now = datetime.now(timezone.utc)
    retention_cutoff = now - timedelta(days=settings.TOKEN_CLEANUP_RETENTION_DAYS)

    async with async_session_maker() as session:
        result = await session.execute(
            delete(RefreshToken).where(
                and_(
                    RefreshToken.created_at < retention_cutoff,
                    or_(
                        RefreshToken.revoked == True,   # noqa: E712
                        RefreshToken.expires_at < now,  # naturally expired
                    ),
                )
            )
        )
        await session.commit()
        deleted = result.rowcount
        if deleted:
            logger.info(
                "Token cleanup: deleted %d expired/revoked tokens (cutoff=%s)",
                deleted,
                retention_cutoff.isoformat(),
            )
        else:
            logger.debug("Token cleanup: no tokens to clean up")
        return deleted


async def start_token_cleanup_scheduler() -> None:
    """Long-running background coroutine that periodically cleans up tokens.

    Designed to be started via ``asyncio.create_task()`` during app startup.
    Runs directly inside the FastAPI event loop.
    """
    interval_seconds = settings.TOKEN_CLEANUP_INTERVAL_HOURS * 3600

    # Small initial delay to let the app finish bootstrapping
    await asyncio.sleep(30)

    logger.info(
        "Token cleanup scheduler started (every %dh, retain %dd)",
        settings.TOKEN_CLEANUP_INTERVAL_HOURS,
        settings.TOKEN_CLEANUP_RETENTION_DAYS,
    )

    while True:
        try:
            await cleanup_expired_tokens()
        except Exception:
            logger.exception("Token cleanup scheduler encountered an error")

        await asyncio.sleep(interval_seconds)
