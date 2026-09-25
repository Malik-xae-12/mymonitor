from sqlalchemy import Column, String
from app.db.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(255), primary_key=True)
    displayName = Column(String(255), nullable=True)
    last_polled_at = Column(String(100), nullable=True)
