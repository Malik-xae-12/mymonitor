from sqlalchemy import Column, String, Text
from app.db.base import Base


class AIErrorDiagnostic(Base):
    __tablename__ = "ai_error_diagnostics"

    error_hash = Column(String(64), primary_key=True, index=True)
    error_code = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    activity_type = Column(String(100), nullable=True)
    pipeline_name = Column(String(255), nullable=True)
    diagnosis_json = Column(Text, nullable=True)
    created_at = Column(String(100), nullable=True)
