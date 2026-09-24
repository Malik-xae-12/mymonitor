import logging
from enum import StrEnum
from typing import Callable

from fastapi import Depends, HTTPException, status

from app.modules.users.models.user import User
from app.modules.auth.dependency import current_active_user

logger = logging.getLogger(__name__)


class RoleName(StrEnum):
    ADMIN = "admin"
    USER = "user"


def has_role(user: User, *role_names: str) -> bool:
    """Check if a user has at least one of the specified roles.

    Use this for inline role checks (e.g. scoping queries).
    For hard-gating endpoints, use require_role() instead.
    """
    user_role_names = {role.name for role in user.roles}
    return bool(user_role_names & set(role_names))


def require_role(*allowed_roles: str) -> Callable:
    """FastAPI dependency that enforces role-based access.

    Raises 403 Forbidden if the authenticated user does not have
    at least one of the allowed roles.

    Usage:
        _require_admin = require_role("admin")

        @router.get("/admin-only")
        async def admin_endpoint(user=Depends(_require_admin)):
            ...
    """

    async def _dependency(
        user: User = Depends(current_active_user),
    ) -> User:
        user_role_names = {role.name for role in user.roles}
        if not user_role_names & set(allowed_roles):
            logger.warning(
                "Permission denied: user=%s roles=%s required=%s",
                user.id, user_role_names, allowed_roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _dependency


# ── Pre-built dependency instances ───────────────────────────────────
# Import and use these directly: user = Depends(require_admin)

require_admin = require_role(RoleName.ADMIN)
require_user = require_role(RoleName.USER, RoleName.ADMIN)
