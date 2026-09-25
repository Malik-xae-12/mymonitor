from sqlalchemy import Column, Integer, String, Text
from app.db.base import Base


class ActivityRun(Base):
    __tablename__ = "activity_runs"

    activity_run_id = Column(String(255), primary_key=True)
    pipeline_run_id = Column(String(255), index=True, nullable=True)
    activity_name = Column(String(255), nullable=True)
    activity_type = Column(String(100), nullable=True)
    status = Column(String(50), nullable=True)
    start_time = Column(String(100), nullable=True)
    end_time = Column(String(100), nullable=True)
    duration_in_ms = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    output = Column(Text, nullable=True)
    child_pipeline_run_id = Column(String(255), nullable=True)
    child_pipeline_data = Column(Text, nullable=True)
    updated_at = Column(String(100), nullable=True)
