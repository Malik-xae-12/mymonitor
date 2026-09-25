import os
import json
import logging
import asyncio
import datetime
import time
from typing import List, Dict, Any, Optional, Set
import httpx
import pyodbc

from app.core.config import settings
from app.shared.clients.fabric_client import fabric_client
from app.modules.table_logs.repository import table_log_repository
from app.modules.table_logs.schema import (
    SaveTableConfigRequest,
    SaveTableLogMappingRequest,
    SqlColumnsRequest,
    SqlTablesRequest,
)

logger = logging.getLogger("fabric_monitor.table_logs")


class TableLogService:
    def __init__(self):
        """Initializes the table logs service with Azure authentication settings."""
        self.tenant_id = settings.AZURE_TENANT_ID
        self.client_id = settings.AZURE_CLIENT_ID
        self.client_secret = settings.AZURE_CLIENT_SECRET

    async def get_data_artifacts(self, workspace_id: str) -> List[Dict[str, Any]]:
        """
        Lists all Warehouses and Lakehouses inside the selected workspace
        by querying the Microsoft Fabric REST API.
        Dynamically searches inside workspace folders when the flat listing
        returns nothing (Fabric nests items inside folder hierarchies).
        Falls back to the saved mapping artifact as a last resort.
        """
        headers = await fabric_client._get_headers()
        artifacts = []
        seen_ids: Set[str] = set()

        async with httpx.AsyncClient(timeout=15.0) as client:
            await self._fetch_warehouses(client, headers, workspace_id, artifacts, seen_ids)
            await self._fetch_lakehouses(client, headers, workspace_id, artifacts, seen_ids)

            if not artifacts:
                logger.info(f"No artifacts from flat listing for workspace {workspace_id}. Searching folders...")
                await self._search_folders_for_artifacts(client, headers, workspace_id, artifacts, seen_ids)

        if not artifacts:
            saved = await table_log_repository.get_table_log_mapping(workspace_id)
            if saved and saved.get("artifact_id") and saved["artifact_id"] not in seen_ids:
                artifacts.append({
                    "id": saved["artifact_id"],
                    "displayName": saved.get("artifact_name", "Saved Data Source"),
                    "type": saved.get("artifact_type", "Warehouse"),
                    "description": "(Previously configured – not visible via REST API)",
                    "serverFqdn": saved.get("server_fqdn"),
                    "databaseName": saved.get("database_name"),
                })

        return artifacts

    async def _fetch_warehouses(self, client: httpx.AsyncClient, headers: dict,
                                workspace_id: str, artifacts: list, seen_ids: Set[str]):
        """Fetches available Warehouses in the workspace from Fabric API."""
        wh_url = f"{fabric_client.base_url}/workspaces/{workspace_id}/warehouses"
        try:
            res = await client.get(wh_url, headers=headers)
            if res.status_code == 200:
                for wh in res.json().get("value", []):
                    props = wh.get("properties", {})
                    conn_str = props.get("connectionString") or props.get("connectionInfo")
                    aid = wh.get("id")
                    if aid not in seen_ids:
                        seen_ids.add(aid)
                        artifacts.append({
                            "id": aid,
                            "displayName": wh.get("displayName"),
                            "type": "Warehouse",
                            "description": wh.get("description", ""),
                            "serverFqdn": conn_str,
                            "databaseName": wh.get("displayName"),
                        })
        except Exception as e:
            logger.warning(f"Failed to fetch warehouses for workspace {workspace_id}: {e}")

    async def _fetch_lakehouses(self, client: httpx.AsyncClient, headers: dict,
                                workspace_id: str, artifacts: list, seen_ids: Set[str]):
        """Fetches available Lakehouses in the workspace from Fabric API."""
        lh_url = f"{fabric_client.base_url}/workspaces/{workspace_id}/lakehouses"
        try:
            res = await client.get(lh_url, headers=headers)
            if res.status_code == 200:
                for lh in res.json().get("value", []):
                    props = lh.get("properties", {})
                    sql_props = props.get("sqlEndpointProperties", {})
                    conn_str = sql_props.get("connectionString")
                    aid = lh.get("id")
                    if aid not in seen_ids:
                        seen_ids.add(aid)
                        artifacts.append({
                            "id": aid,
                            "displayName": lh.get("displayName"),
                            "type": "Lakehouse",
                            "description": lh.get("description", ""),
                            "serverFqdn": conn_str,
                            "databaseName": lh.get("displayName"),
                        })
        except Exception as e:
            logger.warning(f"Failed to fetch lakehouses for workspace {workspace_id}: {e}")

    async def _search_folders_for_artifacts(self, client: httpx.AsyncClient, headers: dict,
                                            workspace_id: str, artifacts: list, seen_ids: Set[str]):
        """Searches nested workspace folders to discover Warehouses and Lakehouses."""
        try:
            folders_url = f"{fabric_client.base_url}/workspaces/{workspace_id}/folders"
            res = await client.get(folders_url, headers=headers)
            if res.status_code != 200:
                return

            folders = res.json().get("value", [])
            if not folders:
                return

            for folder in folders:
                folder_id = folder.get("id")
                folder_name = folder.get("displayName", "")
                if not folder_id:
                    continue

                for item_type in ["Warehouse", "Lakehouse"]:
                    try:
                        items_url = (
                            f"{fabric_client.base_url}/workspaces/{workspace_id}"
                            f"/items?type={item_type}&folderId={folder_id}"
                        )
                        item_res = await client.get(items_url, headers=headers)
                        if item_res.status_code == 200:
                            for item in item_res.json().get("value", []):
                                aid = item.get("id")
                                if aid and aid not in seen_ids:
                                    seen_ids.add(aid)
                                    conn_str = await self._get_artifact_connection(
                                        client, headers, workspace_id, aid, item_type
                                    )
                                    artifacts.append({
                                        "id": aid,
                                        "displayName": item.get("displayName"),
                                        "type": item_type,
                                        "description": item.get("description", f"Found in folder: {folder_name}"),
                                        "serverFqdn": conn_str,
                                        "databaseName": item.get("displayName"),
                                    })
                    except Exception as e:
                        logger.debug(f"Error querying {item_type} in folder {folder_name}: {e}")
        except Exception as e:
            logger.warning(f"Failed to search folders for artifacts in workspace {workspace_id}: {e}")

    async def _get_artifact_connection(self, client: httpx.AsyncClient, headers: dict,
                                       workspace_id: str, artifact_id: str,
                                       artifact_type: str) -> Optional[str]:
        """Extracts the SQL connection string and catalog name for an artifact."""
        try:
            if artifact_type == "Warehouse":
                url = f"{fabric_client.base_url}/workspaces/{workspace_id}/warehouses/{artifact_id}"
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    props = res.json().get("properties", {})
                    return props.get("connectionString") or props.get("connectionInfo")
            elif artifact_type == "Lakehouse":
                url = f"{fabric_client.base_url}/workspaces/{workspace_id}/lakehouses/{artifact_id}"
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    props = res.json().get("properties", {})
                    sql_props = props.get("sqlEndpointProperties", {})
                    return sql_props.get("connectionString")
        except Exception as e:
            logger.debug(f"Could not fetch connection for {artifact_type} {artifact_id}: {e}")
        return None

    def _get_driver_name(self) -> str:
        """Detects the installed ODBC driver for SQL Server connectivity."""
        available = pyodbc.drivers()
        for candidate in ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"]:
            if candidate in available:
                return candidate
        for d in available:
            if "ODBC Driver" in d and "SQL Server" in d:
                return d
        raise RuntimeError(
            f"No suitable ODBC Driver for SQL Server found. Installed drivers: {available}. "
            f"Please install Microsoft ODBC Driver 17 or 18 for SQL Server."
        )

    def _get_pyodbc_connection(self, server_fqdn: str, database_name: str) -> pyodbc.Connection:
        """Establishes an authenticated pyodbc connection using Azure credentials."""
        driver = self._get_driver_name()
        server = server_fqdn.strip()
        if not server.endswith(",1433") and ":" not in server:
            server = f"{server},1433"

        base_conn_str = (
            f"Driver={{{driver}}};"
            f"Server={server};"
            f"Database={database_name.strip()};"
            f"Authentication=ActiveDirectoryServicePrincipal;"
            f"UID={self.client_id};"
            f"PWD={self.client_secret};"
            f"Encrypt=yes;"
            f"Connection Timeout=30;"
        )

        max_retries = 3
        for attempt in range(max_retries):
            try:
                return pyodbc.connect(f"{base_conn_str}TrustServerCertificate=no;")
            except Exception as e:
                err_msg = str(e)
                is_transient = "system update" in err_msg.lower() or "18456" in err_msg
                if attempt == 0:
                    logger.warning(f"Connection attempt {attempt + 1} failed: {e}. Retrying with TrustServerCertificate=yes...")
                    try:
                        return pyodbc.connect(f"{base_conn_str}TrustServerCertificate=yes;")
                    except Exception as e2:
                        if is_transient and attempt < max_retries - 1:
                            wait_secs = 2 ** (attempt + 1)
                            logger.warning(f"Transient error on attempt {attempt + 1}: {e2}. Retrying in {wait_secs}s...")
                            time.sleep(wait_secs)
                            continue
                        raise
                elif is_transient and attempt < max_retries - 1:
                    wait_secs = 2 ** (attempt + 1)
                    logger.warning(f"Transient error on attempt {attempt + 1}: {e}. Retrying in {wait_secs}s...")
                    time.sleep(wait_secs)
                else:
                    raise

    async def get_schemas_and_tables(self, server_fqdn: str, database_name: str) -> List[Dict[str, str]]:
        """Queries user schemas and tables from the target SQL endpoint."""
        def _fetch():
            """Worker closure executing the schema discovery query synchronously."""
            conn = self._get_pyodbc_connection(server_fqdn, database_name)
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT TABLE_SCHEMA, TABLE_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
                      AND TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA', 'queryinsights')
                    ORDER BY TABLE_SCHEMA, TABLE_NAME
                """)
                tables = []
                for row in cursor.fetchall():
                    s = str(row[0])
                    t = str(row[1])
                    tables.append({
                        "schema": s,
                        "table": t,
                        "fullName": f"{s}.{t}"
                    })
                return tables
            finally:
                conn.close()

        return await asyncio.to_thread(_fetch)

    async def get_table_columns(self, server_fqdn: str, database_name: str, schema_name: str, table_name: str) -> List[Dict[str, str]]:
        """Queries column names and data types for a specific table."""
        def _fetch():
            """Worker closure executing the column metadata query synchronously."""
            conn = self._get_pyodbc_connection(server_fqdn, database_name)
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT COLUMN_NAME, DATA_TYPE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                    ORDER BY ORDINAL_POSITION
                """, (schema_name, table_name))
                columns = []
                for row in cursor.fetchall():
                    columns.append({
                        "name": str(row[0]),
                        "dataType": str(row[1])
                    })
                return columns
            finally:
                conn.close()

        return await asyncio.to_thread(_fetch)

    async def query_table_logs(
        self,
        workspace_id: str,
        pipeline_run_id: Optional[str] = None,
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Executes aggregated and granular log queries against the mapped table."""
        mapping = await table_log_repository.get_table_log_mapping(workspace_id)
        if not mapping:
            return {
                "configured": False,
                "message": "No Lakehouse or Warehouse table log mapping configured yet. Please configure your data source and column mappings first."
            }

        server_fqdn = mapping.get("server_fqdn")
        database_name = mapping.get("database_name")
        if not server_fqdn or not database_name:
            return {
                "configured": False,
                "message": "Lakehouse/Warehouse connection information is incomplete in saved configuration."
            }

        bh_schema = mapping.get("batch_header_schema")
        bh_table = mapping.get("batch_header_table")
        bh_map = mapping.get("batch_header_mapping") or {}

        br_schema = mapping.get("bronze_schema")
        br_table = mapping.get("bronze_table")
        br_map = mapping.get("bronze_mapping") or {}

        sl_schema = mapping.get("silver_schema")
        sl_table = mapping.get("silver_table")
        sl_map = mapping.get("silver_mapping") or {}

        if not bh_schema or not bh_table or not br_schema or not br_table or not sl_schema or not sl_table:
            return {
                "configured": False,
                "message": "Tables have not been mapped yet. Please open Table Log Config and select your Batch Header, Bronze, and Silver tables."
            }

        bh_batch_id_col = bh_map.get("batch_id_col")
        bh_pipe_run_id_col = bh_map.get("pipeline_run_id_col")
        bh_pipe_name_col = bh_map.get("pipeline_name_col")
        bh_status_col = bh_map.get("status_col")
        bh_start_col = bh_map.get("start_time_col")

        br_batch_id_col = br_map.get("batch_id_col")
        sl_batch_id_col = sl_map.get("batch_id_col")

        if not bh_batch_id_col:
            return {
                "configured": False,
                "message": "Batch ID column has not been mapped in Batch Header. Please configure column mapping."
            }

        def safe_str(val):
            """Safely casts any value to a trimmed string, returning empty string for None."""
            return str(val).strip() if val is not None else ""

        def _fetch_all():
            """Worker closure executing batch log queries synchronously over pyodbc."""
            conn = self._get_pyodbc_connection(server_fqdn, database_name)
            try:
                cursor = conn.cursor()

                recent_batches = []
                try:
                    cursor.execute(f"""
                        SELECT TOP 25 *
                        FROM [{bh_schema}].[{bh_table}]
                        ORDER BY [{bh_batch_id_col}] DESC
                    """)
                    bh_all_cols = [c[0] for c in cursor.description]
                    bh_all_rows = cursor.fetchall()

                    effective_run_id_col = bh_pipe_run_id_col
                    if not effective_run_id_col or effective_run_id_col == bh_pipe_name_col:
                        for cand in ["PipelineRunId", "pipeline_run_id", "RunId", "run_id", "PipelineRunID"]:
                            if cand in bh_all_cols:
                                effective_run_id_col = cand
                                break

                    for r in bh_all_rows:
                        row_dict = dict(zip(bh_all_cols, r))
                        bid = safe_str(row_dict.get(bh_batch_id_col))
                        pname = safe_str(row_dict.get(bh_pipe_name_col)) if bh_pipe_name_col else ""
                        prun = safe_str(row_dict.get(effective_run_id_col)) if effective_run_id_col else ""
                        if not prun or prun == pname:
                            for cand in ["PipelineRunId", "pipeline_run_id", "RunId", "run_id"]:
                                if row_dict.get(cand):
                                    prun = safe_str(row_dict.get(cand))
                                    break

                        st = safe_str(row_dict.get(bh_status_col)) if bh_status_col else ""
                        tm = safe_str(row_dict.get(bh_start_col)) if bh_start_col else ""

                        tbl_cnt = None
                        if br_batch_id_col and sl_batch_id_col:
                            try:
                                br_src = br_map.get("source_name_col") or "SourceName"
                                cursor.execute(f"""
                                    SELECT COUNT(*) FROM [{br_schema}].[{br_table}] 
                                    WHERE [{br_batch_id_col}] = ?
                                    AND ([{br_src}] LIKE '%Data Load%' OR NOT EXISTS (
                                        SELECT 1 FROM [{br_schema}].[{br_table}] 
                                        WHERE [{br_batch_id_col}] = ? AND [{br_src}] LIKE '%Data Load%'
                                    ))
                                """, (bid, bid))
                                br_cnt = cursor.fetchone()[0]
                                cursor.execute(f"SELECT COUNT(*) FROM [{sl_schema}].[{sl_table}] WHERE [{sl_batch_id_col}] = ?", (str(bid),))
                                sl_cnt = cursor.fetchone()[0]
                                tbl_cnt = br_cnt + sl_cnt
                            except Exception:
                                try:
                                    cursor.execute(f"SELECT COUNT(*) FROM [{br_schema}].[{br_table}] WHERE [{br_batch_id_col}] = ?", (bid,))
                                    br_cnt = cursor.fetchone()[0]
                                    cursor.execute(f"SELECT COUNT(*) FROM [{sl_schema}].[{sl_table}] WHERE [{sl_batch_id_col}] = ?", (str(bid),))
                                    sl_cnt = cursor.fetchone()[0]
                                    tbl_cnt = br_cnt + sl_cnt
                                except Exception:
                                    pass

                        recent_batches.append({
                            "batchId": bid,
                            "pipelineName": pname,
                            "pipelineRunId": prun,
                            "status": st,
                            "startTime": tm,
                            "tablesCount": tbl_cnt,
                        })
                except Exception as ex:
                    logger.warning(f"Failed to query recent batches from {bh_schema}.{bh_table}: {ex}")

                header_row_dict = None
                target_batch_id = batch_id

                if target_batch_id:
                    cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}] WHERE [{bh_batch_id_col}] = ?", (target_batch_id,))
                    row = cursor.fetchone()
                    if row:
                        col_names = [c[0] for c in cursor.description]
                        header_row_dict = dict(zip(col_names, row))
                elif pipeline_run_id:
                    if bh_pipe_run_id_col:
                        try:
                            cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}] WHERE [{bh_pipe_run_id_col}] = ?", (pipeline_run_id,))
                            row = cursor.fetchone()
                            if row:
                                col_names = [c[0] for c in cursor.description]
                                header_row_dict = dict(zip(col_names, row))
                                target_batch_id = str(header_row_dict.get(bh_batch_id_col))
                            else:
                                cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}] WHERE LOWER(TRIM(CAST([{bh_pipe_run_id_col}] AS VARCHAR(250)))) = LOWER(TRIM(?))", (pipeline_run_id,))
                                row = cursor.fetchone()
                                if row:
                                    col_names = [c[0] for c in cursor.description]
                                    header_row_dict = dict(zip(col_names, row))
                                    target_batch_id = str(header_row_dict.get(bh_batch_id_col))
                        except Exception as ex:
                            logger.warning(f"Error querying by mapped bh_pipe_run_id_col '{bh_pipe_run_id_col}': {ex}")

                    if not header_row_dict:
                        for cand in ["PipelineRunId", "pipeline_run_id", "RunId", "run_id", "PipelineRunID", "RunID"]:
                            if cand != bh_pipe_run_id_col:
                                try:
                                    cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}] WHERE [{cand}] = ?", (pipeline_run_id,))
                                    row = cursor.fetchone()
                                    if row:
                                        col_names = [c[0] for c in cursor.description]
                                        header_row_dict = dict(zip(col_names, row))
                                        target_batch_id = str(header_row_dict.get(bh_batch_id_col))
                                        break
                                except Exception:
                                    pass

                    if not header_row_dict:
                        try:
                            cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}]")
                            all_cols = [c[0] for c in cursor.description]
                            for c_name in all_cols:
                                if c_name != bh_batch_id_col and ("run" in c_name.lower() or "guid" in c_name.lower()):
                                    try:
                                        cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}] WHERE CAST([{c_name}] AS VARCHAR(100)) = ?", (pipeline_run_id,))
                                        row = cursor.fetchone()
                                        if row:
                                            header_row_dict = dict(zip(all_cols, row))
                                            target_batch_id = str(header_row_dict.get(bh_batch_id_col))
                                            break
                                    except Exception:
                                        pass
                        except Exception:
                            pass

                if not header_row_dict and not pipeline_run_id and not batch_id and recent_batches:
                    first_b = recent_batches[0]["batchId"]
                    cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}] WHERE [{bh_batch_id_col}] = ?", (first_b,))
                    row = cursor.fetchone()
                    if row:
                        col_names = [c[0] for c in cursor.description]
                        header_row_dict = dict(zip(col_names, row))
                        target_batch_id = str(header_row_dict.get(bh_batch_id_col))

                if not header_row_dict or target_batch_id is None:
                    return {
                        "configured": True,
                        "found": False,
                        "message": f"No batch found matching pipeline run ID '{pipeline_run_id or ''}' or batch ID '{batch_id or ''}'.",
                        "availableBatches": recent_batches
                    }

                bronze_rows = []
                if br_batch_id_col:
                    cursor.execute(f"SELECT * FROM [{br_schema}].[{br_table}] WHERE [{br_batch_id_col}] = ?", (target_batch_id,))
                    bronze_raw = cursor.fetchall()
                    bronze_cols = [c[0] for c in cursor.description]
                    bronze_rows = [dict(zip(bronze_cols, r)) for r in bronze_raw]

                silver_rows = []
                if sl_batch_id_col:
                    cursor.execute(f"SELECT * FROM [{sl_schema}].[{sl_table}] WHERE [{sl_batch_id_col}] = ?", (str(target_batch_id),))
                    silver_raw = cursor.fetchall()
                    silver_cols = [c[0] for c in cursor.description]
                    silver_rows = [dict(zip(silver_cols, r)) for r in silver_raw]

                return {
                    "configured": True,
                    "found": True,
                    "header": header_row_dict,
                    "targetBatchId": target_batch_id,
                    "recentBatches": recent_batches,
                    "bronzeRows": bronze_rows,
                    "silverRows": silver_rows,
                }
            finally:
                conn.close()

        raw_result = await asyncio.to_thread(_fetch_all)
        if not raw_result.get("configured") or not raw_result.get("found"):
            return raw_result

        header_data = raw_result["header"]
        bronze_rows = raw_result["bronzeRows"]
        silver_rows = raw_result["silverRows"]

        def resolve_table_and_schema(raw_tbl, raw_sch, raw_row):
            """Extracts and normalizes schema and table names from raw log fields."""
            tbl = safe_str(raw_tbl)
            sch = safe_str(raw_sch)
            if tbl.isdigit() or not tbl:
                for candidate in ["TableName", "table_name", "target_table", "table"]:
                    candidate_val = raw_row.get(candidate)
                    if candidate_val and not str(candidate_val).strip().isdigit():
                        tbl = str(candidate_val).strip()
                        break

            known_schemas = {"dbo", "public", "sys", "guest", "information_schema", "config", "log"}
            if tbl.lower() in known_schemas and sch.lower() not in known_schemas and sch:
                tbl, sch = sch, tbl
            elif not sch and raw_row.get("SchemaName"):
                sch = str(raw_row.get("SchemaName")).strip()

            return tbl, sch

        def parse_duration_seconds(dur_val, start_val, end_val):
            """Parses duration in seconds from elapsed time string or start/end timestamps."""
            if dur_val is not None:
                try:
                    s = str(dur_val).replace("s", "").strip()
                    return float(s)
                except Exception:
                    pass
            if start_val and end_val:
                try:
                    st = datetime.datetime.fromisoformat(str(start_val).replace("Z", "+00:00"))
                    et = datetime.datetime.fromisoformat(str(end_val).replace("Z", "+00:00"))
                    diff = (et - st).total_seconds()
                    if diff >= 0:
                        return diff
                except Exception:
                    pass
            return 0.0

        def format_dur_str(seconds):
            """Formats duration in seconds into a human-readable display string."""
            if seconds <= 0:
                return "0.00s"
            if seconds < 60:
                return f"{seconds:.2f}s"
            mins = int(seconds // 60)
            rem = seconds % 60
            return f"{mins}m {rem:.1f}s"

        def parse_row_count(val):
            """Safely parses row count values into an integer."""
            if val is None:
                return 0
            try:
                return int(val)
            except Exception:
                try:
                    return int(float(str(val).replace(",", "").strip()))
                except Exception:
                    return 0

        br_src_col = br_map.get("source_name_col") or "SourceName"
        has_bronze_data_load = any("data load" in safe_str(r.get(br_src_col, "")).lower() for r in bronze_rows)
        active_bronze_rows = [
            r for r in bronze_rows 
            if not has_bronze_data_load or "data load" in safe_str(r.get(br_src_col, "")).lower()
        ]

        bronze_items = []
        br_tbl_col = br_map.get("table_name_col")
        br_sch_col = br_map.get("schema_name_col")
        br_cnt_col = br_map.get("rows_processed_col")
        br_sts_col = br_map.get("status_col")
        br_st_col = br_map.get("start_time_col")
        br_et_col = br_map.get("end_time_col")
        br_err_col = br_map.get("error_message_col")
        br_dur_col = br_map.get("duration_col")

        def is_status_success(status_raw: str, err_raw: str) -> bool:
            """Determines whether a stage execution succeeded based on status and error message."""
            s = safe_str(status_raw).lower()
            e = safe_str(err_raw).lower()
            if any(f in s for f in ["fail", "error", "abort", "exception", "cancel"]):
                return False
            has_real_error = bool(
                e and 
                e not in ["no error", "none", "null", "0", "no errors", "success", "na", "n/a", ""] and 
                "no error" not in e
            )
            if has_real_error:
                return False
            if any(w in s for w in ["success", "succeed", "complete", "done", "ok"]):
                return True
            return not has_real_error

        for r in active_bronze_rows:
            st = safe_str(r.get(br_st_col)) if br_st_col else ""
            et = safe_str(r.get(br_et_col)) if br_et_col else ""
            dur_sec = parse_duration_seconds(r.get(br_dur_col) if br_dur_col else None, st, et)
            status_val = safe_str(r.get(br_sts_col)) if br_sts_col else "Success"
            err_val = safe_str(r.get(br_err_col)) if br_err_col else "No Error"
            is_success = is_status_success(status_val, err_val)
            
            tbl_name, sch_name = resolve_table_and_schema(r.get(br_tbl_col) if br_tbl_col else "", r.get(br_sch_col) if br_sch_col else "dbo", r)
            op_name = safe_str(r.get(br_src_col) or "Data Load")

            bronze_items.append({
                "tableName": tbl_name,
                "schema": sch_name,
                "layer": "Bronze",
                "operation": op_name,
                "startTime": st,
                "endTime": et,
                "durationSec": dur_sec,
                "duration": format_dur_str(dur_sec),
                "status": "Success" if is_success else "Failure",
                "rowsProcessed": parse_row_count(r.get(br_cnt_col)) if br_cnt_col else 0,
                "errorMessage": err_val if not is_success else "No Error",
                "rawData": {k: str(v) if v is not None else None for k, v in r.items()},
            })

        silver_items = []
        sl_tbl_col = sl_map.get("table_name_col")
        sl_sch_col = sl_map.get("schema_name_col")
        sl_cnt_col = sl_map.get("rows_processed_col")
        sl_sts_col = sl_map.get("status_col")
        sl_st_col = sl_map.get("start_time_col")
        sl_et_col = sl_map.get("end_time_col")
        sl_dur_col = sl_map.get("duration_col")
        sl_err_col = sl_map.get("error_message_col")

        for r in silver_rows:
            st = safe_str(r.get(sl_st_col)) if sl_st_col else ""
            et = safe_str(r.get(sl_et_col)) if sl_et_col else ""
            dur_sec = parse_duration_seconds(r.get(sl_dur_col) if sl_dur_col else None, st, et)
            status_val = safe_str(r.get(sl_sts_col)) if sl_sts_col else "Success"
            err_val = safe_str(r.get(sl_err_col)) if sl_err_col else "No Error"
            is_success = is_status_success(status_val, err_val)
            
            cnt = parse_row_count(r.get(sl_cnt_col)) if sl_cnt_col else 0
            tbl_name, sch_name = resolve_table_and_schema(r.get(sl_tbl_col) if sl_tbl_col else "", r.get(sl_sch_col) if sl_sch_col else "dbo", r)

            silver_items.append({
                "tableName": tbl_name,
                "schema": sch_name,
                "layer": "Silver",
                "operation": "Data Load",
                "startTime": st,
                "endTime": et,
                "durationSec": dur_sec,
                "duration": format_dur_str(dur_sec),
                "status": "Success" if is_success else "Failure",
                "rowsProcessed": cnt,
                "errorMessage": err_val if not is_success else "No Error",
                "rawData": {k: str(v) if v is not None else None for k, v in r.items()},
            })

        all_items = bronze_items + silver_items

        total_tables = len(all_items)
        success_tables = sum(1 for i in all_items if i["status"] == "Success")
        failed_tables = sum(1 for i in all_items if i["status"] != "Success")
        total_rows = sum(i["rowsProcessed"] for i in all_items)
        avg_dur_sec = (sum(i["durationSec"] for i in all_items) / total_tables) if total_tables > 0 else 0.0

        def format_rows(count):
            """Formats numeric row counts with K/M abbreviations for KPI cards."""
            if count >= 1_000_000:
                return f"{count / 1_000_000:.1f}M"
            if count >= 1_000:
                return f"{count / 1_000:.1f}K"
            return f"{count:,}"

        kpis = {
            "totalTables": total_tables,
            "successfullyLoaded": success_tables,
            "failedTables": failed_tables,
            "avgLoadDuration": format_dur_str(avg_dur_sec),
            "rowsProcessed": format_rows(total_rows),
            "rawRowsProcessed": total_rows,
        }

        br_total = len(bronze_items)
        br_succ = sum(1 for i in bronze_items if i["status"] == "Success")
        br_fail = sum(1 for i in bronze_items if i["status"] != "Success")
        br_rows = sum(i["rowsProcessed"] for i in bronze_items)
        br_avg_sec = (sum(i["durationSec"] for i in bronze_items) / br_total) if br_total > 0 else 0.0
        br_rate = (br_succ / br_total * 100.0) if br_total > 0 else 100.0

        bronze_overview = {
            "totalTables": br_total,
            "successfullyLoaded": br_succ,
            "failed": br_fail,
            "successRate": f"{br_rate:.1f}%",
            "avgLoadDuration": format_dur_str(br_avg_sec),
            "rowsProcessed": format_rows(br_rows),
        }

        sl_total = len(silver_items)
        sl_succ = sum(1 for i in silver_items if i["status"] == "Success")
        sl_fail = sum(1 for i in silver_items if i["status"] != "Success")
        sl_rows = sum(i["rowsProcessed"] for i in silver_items)
        sl_avg_sec = (sum(i["durationSec"] for i in silver_items) / sl_total) if sl_total > 0 else 0.0
        sl_rate = (sl_succ / sl_total * 100.0) if sl_total > 0 else 100.0

        silver_overview = {
            "totalTables": sl_total,
            "successfullyLoaded": sl_succ,
            "failed": sl_fail,
            "successRate": f"{sl_rate:.1f}%",
            "avgLoadDuration": format_dur_str(sl_avg_sec),
            "rowsProcessed": format_rows(sl_rows),
        }

        header_summary = {
            "batchId": safe_str(header_data.get(bh_map.get("batch_id_col")) if bh_map.get("batch_id_col") else ""),
            "pipelineName": safe_str(header_data.get(bh_map.get("pipeline_name_col")) if bh_map.get("pipeline_name_col") else ""),
            "pipelineRunId": safe_str(header_data.get(bh_map.get("pipeline_run_id_col")) if bh_map.get("pipeline_run_id_col") else ""),
            "status": safe_str(header_data.get(bh_map.get("status_col")) if bh_map.get("status_col") else ""),
            "startTime": safe_str(header_data.get(bh_map.get("start_time_col")) if bh_map.get("start_time_col") else ""),
            "endTime": safe_str(header_data.get(bh_map.get("end_time_col")) if bh_map.get("end_time_col") else ""),
            "duration": safe_str(header_data.get(bh_map.get("duration_col")) if bh_map.get("duration_col") else ""),
            "errorMessage": safe_str(header_data.get(bh_map.get("error_message_col")) if bh_map.get("error_message_col") else ""),
        }

        return {
            "configured": True,
            "found": True,
            "mapping": mapping,
            "batchHeader": header_summary,
            "availableBatches": raw_result.get("recentBatches", []),
            "kpis": kpis,
            "bronzeOverview": bronze_overview,
            "silverOverview": silver_overview,
            "tableDetails": all_items,
        }


    async def get_sql_tables(self, payload: SqlTablesRequest) -> List[Dict[str, Any]]:
        """List user schemas and tables from the target SQL connection endpoint."""
        server = (payload.serverFqdn or payload.server_fqdn or "").strip()
        db = (payload.databaseName or payload.database_name or "").strip()
        if not server or not db:
            return []
        return await self.get_schemas_and_tables(server, db)

    async def get_sql_columns(self, payload: SqlColumnsRequest) -> List[Dict[str, Any]]:
        """List column names and SQL data types for a given table."""
        server = (payload.serverFqdn or payload.server_fqdn or "").strip()
        db = (payload.databaseName or payload.database_name or "").strip()
        schema = (payload.schemaName or payload.schema_name or "").strip()
        table = (payload.tableName or payload.table_name or "").strip()
        if not server or not db or not schema or not table:
            return []
        return await self.get_table_columns(server, db, schema, table)

    async def get_table_log_mapping(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve persisted table log column mappings for a workspace."""
        return await table_log_repository.get_table_log_mapping(workspace_id)

    async def save_table_log_mapping(self, workspace_id: str, payload: SaveTableLogMappingRequest) -> Dict[str, Any]:
        """Save or update table log column configuration for a workspace."""
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        await table_log_repository.save_table_log_mapping(
            workspace_id=workspace_id,
            artifact_type=payload.artifactType or payload.artifact_type or "",
            artifact_id=payload.artifactId or payload.artifact_id or "",
            artifact_name=payload.artifactName or payload.artifact_name or "",
            server_fqdn=payload.serverFqdn or payload.server_fqdn or "",
            database_name=payload.databaseName or payload.database_name or "",
            batch_header_schema=payload.batchHeaderSchema or payload.batch_header_schema or "",
            batch_header_table=payload.batchHeaderTable or payload.batch_header_table or "",
            batch_header_mapping=payload.batchHeaderMapping or payload.batch_header_mapping or {},
            bronze_schema=payload.bronzeSchema or payload.bronze_schema or "",
            bronze_table=payload.bronzeTable or payload.bronze_table or "",
            bronze_mapping=payload.bronzeMapping or payload.bronze_mapping or {},
            silver_schema=payload.silverSchema or payload.silver_schema or "",
            silver_table=payload.silverTable or payload.silver_table or "",
            silver_mapping=payload.silverMapping or payload.silver_mapping or {},
            updated_at=now_iso,
        )
        return {"status": "success", "workspaceId": workspace_id, "updatedAt": now_iso}

    async def delete_table_log_mapping(self, workspace_id: str) -> Dict[str, Any]:
        """Clear table log configuration mapping for a workspace."""
        await table_log_repository.delete_table_log_mapping(workspace_id)
        return {"status": "success", "message": "Mapping cleared successfully."}


table_log_service = TableLogService()
# Compatibility alias
table_log_domain_service = table_log_service
