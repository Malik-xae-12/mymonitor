import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.core.config import settings

# Use PROD_DATABASE_URL if in production, otherwise fallback to DATABASE_URL
database_url = settings.PROD_DATABASE_URL if settings.PROD and settings.PROD_DATABASE_URL else settings.DATABASE_URL
if not database_url:
    database_url = ""

# Convert async drivers to sync for Alembic
database_url = str(database_url).replace("sqlite+aiosqlite", "sqlite")
database_url = database_url.replace("mssql+aioodbc", "mssql+pyodbc")

if database_url:
    # Escape % for configparser interpolation
    escaped_url = database_url.replace('%', '%%')
    config.set_main_option("sqlalchemy.url", escaped_url)

# Import models for autogenerate support
from app.db.models_import import *  # noqa: F401, F403
from app.db.base import Base

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

