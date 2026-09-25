import logging

from app.db.session import create_db_and_tables

logger = logging.getLogger(__name__)


async def create_database() -> None:
    """Initializes the database engine and tables on startup."""
    await create_db_and_tables()
    logger.info("Database initialized successfully.")
