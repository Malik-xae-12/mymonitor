from sqlalchemy import Column, Integer, String
from app.db.base import Base


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(String(255), primary_key=True)
    workspace_id = Column(String(255), index=True, nullable=True)
    displayName = Column(String(255), nullable=True)
    is_master = Column(Integer, default=1)
    prefix = Column(String(50), nullable=True)
    updated_at = Column(String(100), nullable=True)
