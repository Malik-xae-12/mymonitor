import os
from pathlib import Path
from typing import AsyncGenerator

from fastapi import Depends
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.db.base import Base
from app.db import models_import  # noqa: F401  — registers all models on Base.metadata
from app.modules.users.models.user import User

from sqlalchemy.exc import OperationalError, ProgrammingError
import logging



def _resolve_db_url(url: str) -> str:
    """Convert relative SQLite paths to absolute so --reload can't lose the DB."""
    if url.startswith("sqlite"):
        prefix, _, path = url.partition(":///")
        if path and not os.path.isabs(path):
            backend_dir = Path(__file__).resolve().parent.parent
            abs_path = str(backend_dir / path)
            return f"{prefix}:///{abs_path}"
    return url


def _get_db_url() -> str:
    """Return the database URL based on the PROD flag."""
    if settings.PROD and settings.PROD_DATABASE_URL:
        return settings.PROD_DATABASE_URL
    return _resolve_db_url(settings.DATABASE_URL)


_db_url = _get_db_url()
_is_mssql = "mssql" in _db_url

engine = create_async_engine(
    _db_url,
    echo=False,
    # Connection pool tuning for faster queries
    pool_size=20 if _is_mssql else 5,
    max_overflow=30 if _is_mssql else 10,
    pool_pre_ping=True,  # Detect stale connections early
    pool_recycle=300,     # Recycle connections every 5 min
)

async_session_maker = async_sessionmaker(
    engine, expire_on_commit=settings.EXPIRE_ON_COMMIT
)

async def create_db_and_tables() -> None:
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except (OperationalError, ProgrammingError) as e:
        # Ignore race conditions when multiple workers try to create the same tables simultaneously
        logging.warning(f"Ignored error during table creation (likely a multi-worker race condition): {e}")
    except Exception as e:
        logging.error(f"Unexpected error during table creation: {e}")


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)
