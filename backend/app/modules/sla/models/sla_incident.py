from sqlalchemy import Column, String, Text
from app.db.base import Base


class SLAIncident(Base):
    __tablename__ = "sla_incidents"

    id = Column(String(255), primary_key=True)
    pipeline_id = Column(String(255), index=True, nullable=True)
    pipeline_name = Column(String(255), nullable=True)
    pipeline_run_id = Column(String(255), nullable=True)
    workspace_id = Column(String(255), index=True, nullable=True)
    status = Column(String(50), index=True, default="ACTIVE")
    failed_at = Column(String(100), nullable=True)
    sla_target_time = Column(String(100), nullable=True)
    l1_notified_at = Column(String(100), nullable=True)
    l2_escalated_at = Column(String(100), nullable=True)
    resolved_at = Column(String(100), nullable=True)
    resolved_by = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    updated_at = Column(String(100), nullable=True)
