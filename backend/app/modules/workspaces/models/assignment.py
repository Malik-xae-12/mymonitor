from sqlalchemy import Column, Integer, String
from app.db.base import Base


class WorkspaceAssignment(Base):
    __tablename__ = "workspace_assignments"

    workspace_id = Column(String(255), primary_key=True)
    workspace_name = Column(String(255), nullable=True)
    l1_email = Column(String(255), nullable=True)
    l2_email = Column(String(255), nullable=True)
    sla1_minutes = Column(Integer, default=30)
    sla2_minutes = Column(Integer, default=60)
    table_config_done = Column(Integer, default=0)
    assigned_by = Column(String(255), nullable=True)
    updated_at = Column(String(100), nullable=True)
