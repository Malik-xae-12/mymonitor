import logging
from enum import StrEnum
from typing import Callable

from fastapi import Depends, HTTPException, status

from app.modules.users.models.user import User
from app.modules.auth.dependency import current_active_user

logger = logging.getLogger(__name__)


class RoleName(StrEnum):
    ADMIN = "admin"
    L1 = "l1"
    L2 = "l2"


def has_role(user: User, *role_names: str) -> bool:
    """Check if a user has at least one of the specified roles."""
    if not user.role_id:
        return False
    return user.role_id in role_names or (user.role and user.role.name in role_names)


def require_role(*allowed_roles: str) -> Callable:
    """FastAPI dependency that enforces role-based access.

    Raises 403 Forbidden if the authenticated user does not have
    at least one of the allowed roles.
    """

    async def _dependency(
        user: User = Depends(current_active_user),
    ) -> User:
        user_role_names = {user.role_id} if user.role_id else set()
        if user.role:
            user_role_names.add(user.role.name)
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
require_l1 = require_role(RoleName.L1, RoleName.ADMIN)
require_l2 = require_role(RoleName.L2, RoleName.ADMIN)
