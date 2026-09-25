from sqlalchemy import Column, String, Text
from app.db.base import Base


class TableLogMapping(Base):
    __tablename__ = "table_log_mappings"

    workspace_id = Column(String(255), primary_key=True)
    artifact_type = Column(String(50), nullable=True)
    artifact_id = Column(String(255), nullable=True)
    artifact_name = Column(String(255), nullable=True)
    server_fqdn = Column(String(255), nullable=True)
    database_name = Column(String(255), nullable=True)
    batch_header_schema = Column(String(100), nullable=True)
    batch_header_table = Column(String(100), nullable=True)
    batch_header_mapping = Column(Text, nullable=True)
    bronze_schema = Column(String(100), nullable=True)
    bronze_table = Column(String(100), nullable=True)
    bronze_mapping = Column(Text, nullable=True)
    silver_schema = Column(String(100), nullable=True)
    silver_table = Column(String(100), nullable=True)
    silver_mapping = Column(Text, nullable=True)
    updated_at = Column(String(100), nullable=True)
