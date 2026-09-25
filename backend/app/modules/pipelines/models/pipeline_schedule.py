from sqlalchemy import Column, Integer, String, Text
from app.db.base import Base


class PipelineSchedule(Base):
    __tablename__ = "pipeline_schedules"

    pipeline_id = Column(String(255), primary_key=True)
    workspace_id = Column(String(255), index=True, nullable=True)
    pipeline_name = Column(String(255), nullable=True)
    enabled = Column(Integer, default=0)
    schedule_type = Column(String(50), nullable=True)
    next_run_time = Column(String(100), nullable=True)
    time_zone = Column(String(100), nullable=True)
    raw_configuration = Column(Text, nullable=True)
    updated_at = Column(String(100), nullable=True)
