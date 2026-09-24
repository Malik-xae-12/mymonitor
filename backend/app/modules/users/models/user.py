from sqlalchemy import Boolean, Column, Index, String, text
from sqlalchemy.orm import relationship
from fastapi_users.db import SQLAlchemyBaseUserTableUUID

from app.db.base import Base
from app.db.mixins import AuditMixin, SoftDeleteMixin


class User(SQLAlchemyBaseUserTableUUID, Base, AuditMixin, SoftDeleteMixin):
    is_sso = Column(Boolean, default=False, nullable=False, server_default=text("0"))
    azure_oid = Column(String(255), nullable=True, index=True)

    items = relationship(
        "Item",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Item.user_id",
    )
    roles = relationship(
        "Role",
        secondary="user_role",
        back_populates="users",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_user_email_lower", "email"),
        Index("ix_user_is_active", "is_active"),
    )
