from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class SaveTableConfigRequest(BaseModel):
    batchHeaderTable: Optional[str] = None
    batchDetailsTable: Optional[str] = None
    logStorageType: Optional[str] = 'lakehouse'
    lakehouseId: Optional[str] = None
    columnMappings: Optional[Dict[str, Any]] = None


class TestConnectionRequest(BaseModel):
    server: Optional[str] = None
    database: Optional[str] = None


class SqlTablesRequest(BaseModel):
    serverFqdn: Optional[str] = None
    server_fqdn: Optional[str] = None
    databaseName: Optional[str] = None
    database_name: Optional[str] = None


class SqlColumnsRequest(BaseModel):
    serverFqdn: Optional[str] = None
    server_fqdn: Optional[str] = None
    databaseName: Optional[str] = None
    database_name: Optional[str] = None
    schemaName: Optional[str] = None
    schema_name: Optional[str] = None
    tableName: Optional[str] = None
    table_name: Optional[str] = None


class SaveTableLogMappingRequest(BaseModel):
    artifactType: Optional[str] = None
    artifact_type: Optional[str] = None
    artifactId: Optional[str] = None
    artifact_id: Optional[str] = None
    artifactName: Optional[str] = None
    artifact_name: Optional[str] = None
    serverFqdn: Optional[str] = None
    server_fqdn: Optional[str] = None
    databaseName: Optional[str] = None
    database_name: Optional[str] = None
    batchHeaderSchema: Optional[str] = None
    batch_header_schema: Optional[str] = None
    batchHeaderTable: Optional[str] = None
    batch_header_table: Optional[str] = None
    batchHeaderMapping: Optional[Dict[str, Any]] = None
    batch_header_mapping: Optional[Dict[str, Any]] = None
    bronzeSchema: Optional[str] = None
    bronze_schema: Optional[str] = None
    bronzeTable: Optional[str] = None
    bronze_table: Optional[str] = None
    bronzeMapping: Optional[Dict[str, Any]] = None
    bronze_mapping: Optional[Dict[str, Any]] = None
    silverSchema: Optional[str] = None
    silver_schema: Optional[str] = None
    silverTable: Optional[str] = None
    silver_table: Optional[str] = None
    silverMapping: Optional[Dict[str, Any]] = None
    silver_mapping: Optional[Dict[str, Any]] = None
