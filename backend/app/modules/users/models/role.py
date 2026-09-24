"""Role domain model + default role catalog.

DB access uses the shared ``aiosqlite`` layer (see ``users/repository.py``); these
are lightweight domain representations rather than an ORM mapping.
"""
from pydantic import BaseModel

# Canonical role ids used across the app (also mirrored in the frontend roles constant).
ROLE_ADMIN = "admin"
ROLE_L1 = "l1"
ROLE_L2 = "l2"

DEFAULT_ROLES = [
    {
        "id": ROLE_ADMIN,
        "name": "Administrator",
        "description": "Full access; manages users, workspace assignments, SLA and table config.",
    },
    {
        "id": ROLE_L1,
        "name": "L1 Support",
        "description": "First responder for assigned workspaces.",
    },
    {
        "id": ROLE_L2,
        "name": "L2 Support",
        "description": "Escalation owner for assigned workspaces.",
    },
]


class Role(BaseModel):
    id: str
    name: str
    description: str | None = None
