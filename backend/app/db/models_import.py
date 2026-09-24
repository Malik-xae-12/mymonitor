# Import all models here so that Base.metadata.create_all() has them registered
# This is also used by Alembic to autogenerate migrations

from app.modules.users.models.user import User  # noqa
from app.modules.users.models.role import Role, UserRole  # noqa
from app.modules.auth.models.refresh_token import RefreshToken  # noqa
