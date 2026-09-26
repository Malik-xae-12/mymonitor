from sqlalchemy import Column, Integer, String
from app.db.base import Base


class SLAConfig(Base):
    __tablename__ = "sla_configs"

    pipeline_id = Column(String(255), primary_key=True)
    workspace_id = Column(String(255), index=True, nullable=True)
    pipeline_name = Column(String(255), nullable=True)
    l1_email = Column(String(255), nullable=True)
    l2_email = Column(String(255), nullable=True)
    l1_name = Column(String(255), nullable=True)
    l2_name = Column(String(255), nullable=True)
    sla_minutes = Column(Integer, default=30)
    sla1_minutes = Column(Integer, default=30)
    sla2_minutes = Column(Integer, default=60)
    assigned_by = Column(String(255), nullable=True)
    updated_at = Column(String(100), nullable=True)
