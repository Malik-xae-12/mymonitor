import uuid
from sqlalchemy import Boolean, Column, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    display_name = Column(String(255), nullable=True)
    oid = Column(String(255), nullable=True)
    role_id = Column(String(50), ForeignKey("roles.id"), index=True, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    hashed_password = Column(String(1024), nullable=True)
    created_at = Column(String(100), nullable=True)
    last_login_at = Column(String(100), nullable=True)

    role = relationship("Role", back_populates="users", lazy="selectin")

    @property
    def roles(self):
        return [self.role] if self.role else []
