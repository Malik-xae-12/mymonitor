from sqlalchemy import Column, Integer, String, Text
from app.db.base import Base


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(String(255), primary_key=True)
    pipeline_id = Column(String(255), index=True, nullable=True)
    workspace_id = Column(String(255), index=True, nullable=True)
    pipeline_name = Column(String(255), nullable=True)
    status = Column(String(50), index=True, nullable=True)
    start_time = Column(String(100), nullable=True)
    end_time = Column(String(100), nullable=True)
    duration_in_ms = Column(Integer, nullable=True)
    invoke_type = Column(String(50), nullable=True)
    is_child = Column(Integer, default=0)
    parent_run_id = Column(String(255), nullable=True)
    parent_activity_name = Column(String(255), nullable=True)
    failure_reason = Column(Text, nullable=True)
    updated_at = Column(String(100), nullable=True)
