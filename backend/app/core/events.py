import asyncio
import logging

from app.db.session import create_db_and_tables
from app.core.scheduler import start_token_cleanup_scheduler

logger = logging.getLogger(__name__)


async def create_database() -> None:
    await create_db_and_tables()

    # Start the background token cleanup scheduler
    asyncio.create_task(start_token_cleanup_scheduler())
    logger.info("Token cleanup scheduler queued for background execution")
