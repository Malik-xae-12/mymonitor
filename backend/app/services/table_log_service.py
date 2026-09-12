import os
import json
import logging
import asyncio
import datetime
from typing import List, Dict, Any, Optional
import httpx
import pyodbc

from backend.app.core.config import settings
from backend.app.services.fabric_client import fabric_client
from backend.app.services.db_service import db_service

logger = logging.getLogger("fabric_monitor.table_log_service")

class TableLogService:
    def __init__(self):
        self.tenant_id = settings.AZURE_TENANT_ID
        self.client_id = settings.AZURE_CLIENT_ID
        self.client_secret = settings.AZURE_CLIENT_SECRET

    async def get_data_artifacts(self, workspace_id: str) -> List[Dict[str, Any]]:
        """
        Lists all Warehouses and Lakehouses inside the selected workspace
        by querying the Microsoft Fabric REST API.
        """
        headers = await fabric_client._get_headers()
        artifacts = []

        # 1. Fetch Warehouses
        wh_url = f"{fabric_client.base_url}/workspaces/{workspace_id}/warehouses"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(wh_url, headers=headers)
                if res.status_code == 200:
                    for wh in res.json().get("value", []):
                        props = wh.get("properties", {})
                        conn_str = props.get("connectionString") or props.get("connectionInfo")
                        artifacts.append({
                            "id": wh.get("id"),
                            "displayName": wh.get("displayName"),
                            "type": "Warehouse",
                            "description": wh.get("description", ""),
                            "serverFqdn": conn_str,
                            "databaseName": wh.get("displayName")
                        })
        except Exception as e:
            logger.warning(f"Failed to fetch warehouses for workspace {workspace_id}: {e}")

        # 2. Fetch Lakehouses
        lh_url = f"{fabric_client.base_url}/workspaces/{workspace_id}/lakehouses"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(lh_url, headers=headers)
                if res.status_code == 200:
                    for lh in res.json().get("value", []):
                        props = lh.get("properties", {})
                        sql_props = props.get("sqlEndpointProperties", {})
                        conn_str = sql_props.get("connectionString")
                        artifacts.append({
                            "id": lh.get("id"),
                            "displayName": lh.get("displayName"),
                            "type": "Lakehouse",
                            "description": lh.get("description", ""),
                            "serverFqdn": conn_str,
                            "databaseName": lh.get("displayName")
                        })
        except Exception as e:
            logger.warning(f"Failed to fetch lakehouses for workspace {workspace_id}: {e}")

        return artifacts

    def _get_pyodbc_connection(self, server_fqdn: str, database_name: str) -> pyodbc.Connection:
        """
        Establishes an ODBC connection to the Fabric SQL Endpoint using ActiveDirectoryServicePrincipal.
        """
        server = server_fqdn.strip()
        if not server.endswith(",1433") and ":" not in server:
            server = f"{server},1433"

        conn_str = (
            f"Driver={{ODBC Driver 18 for SQL Server}};"
            f"Server={server};"
            f"Database={database_name.strip()};"
            f"Authentication=ActiveDirectoryServicePrincipal;"
            f"UID={self.client_id};"
            f"PWD={self.client_secret};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;"
            f"Connection Timeout=30;"
        )
        return pyodbc.connect(conn_str)

    async def get_schemas_and_tables(self, server_fqdn: str, database_name: str) -> List[Dict[str, str]]:
        """
        Dynamically fetches all schemas and user tables in the given warehouse or lakehouse SQL endpoint.
        """
        def _fetch():
            conn = self._get_pyodbc_connection(server_fqdn, database_name)
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT TABLE_SCHEMA, TABLE_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_TYPE = 'BASE TABLE'
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
        """
        Dynamically fetches all columns and data types for the specified schema and table.
        """
        def _fetch():
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
        """
        Queries table-level logs for a given pipeline run ID or batch ID.
        Computes KPI summaries (without alert cards), layer breakdowns, and filtered table details.
        """
        mapping = await db_service.get_table_log_mapping(workspace_id)
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
            return str(val).strip() if val is not None else ""

        def _fetch_all():
            conn = self._get_pyodbc_connection(server_fqdn, database_name)
            try:
                cursor = conn.cursor()

                # 1. Fetch recent batches list for batch dropdown selection
                recent_batches = []
                try:
                    cursor.execute(f"""
                        SELECT TOP 25 *
                        FROM [{bh_schema}].[{bh_table}]
                        ORDER BY [{bh_batch_id_col}] DESC
                    """)
                    bh_all_cols = [c[0] for c in cursor.description]
                    bh_all_rows = cursor.fetchall()

                    # Find best candidate for pipeline run ID column in the table if mapping was wrong
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
                            "tablesCount": tbl_cnt
                        })
                except Exception as ex:
                    logger.warning(f"Failed to query recent batches from {bh_schema}.{bh_table}: {ex}")

                # 2. Locate Target Batch Header
                header_row_dict = None
                target_batch_id = batch_id

                if target_batch_id:
                    cursor.execute(f"SELECT TOP 1 * FROM [{bh_schema}].[{bh_table}] WHERE [{bh_batch_id_col}] = ?", (target_batch_id,))
                    row = cursor.fetchone()
                    if row:
                        col_names = [c[0] for c in cursor.description]
                        header_row_dict = dict(zip(col_names, row))
                elif pipeline_run_id:
                    # 1) Try mapped pipeline_run_id_col
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

                    # 2) Fallback: if not found, check known run ID columns (e.g. PipelineRunId, RunId)
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
                                        logger.info(f"Matched pipeline run ID '{pipeline_run_id}' using candidate column '{cand}'")
                                        break
                                except Exception:
                                    pass

                    # 3) Fallback: if still not found, check any column containing 'run' or 'guid'
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
                                            logger.info(f"Matched pipeline run ID '{pipeline_run_id}' using column '{c_name}'")
                                            break
                                    except Exception:
                                        pass
                        except Exception:
                            pass

                # Fallback: only if neither run ID nor batch ID was requested, default to most recent batch
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

                # 3. Query Bronze Details
                bronze_rows = []
                if br_batch_id_col:
                    cursor.execute(f"SELECT * FROM [{br_schema}].[{br_table}] WHERE [{br_batch_id_col}] = ?", (target_batch_id,))
                    bronze_raw = cursor.fetchall()
                    bronze_cols = [c[0] for c in cursor.description]
                    bronze_rows = [dict(zip(bronze_cols, r)) for r in bronze_raw]

                # 4. Query Silver Details
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
                    "silverRows": silver_rows
                }
            finally:
                conn.close()

        raw_result = await asyncio.to_thread(_fetch_all)
        if not raw_result.get("configured") or not raw_result.get("found"):
            return raw_result

        header_data = raw_result["header"]
        bronze_rows = raw_result["bronzeRows"]
        silver_rows = raw_result["silverRows"]

        # Parse normalized items
        def resolve_table_and_schema(raw_tbl, raw_sch, raw_row):
            tbl = safe_str(raw_tbl)
            sch = safe_str(raw_sch)

            # 1. If tbl is numeric (e.g. TableId mapped instead of TableName), find real table name
            if tbl.isdigit() or not tbl:
                for candidate in ["TableName", "table_name", "target_table", "table"]:
                    candidate_val = raw_row.get(candidate)
                    if candidate_val and not str(candidate_val).strip().isdigit():
                        tbl = str(candidate_val).strip()
                        break

            # 2. If tbl is a known database schema, and sch is the entity name (inverted columns in table)
            known_schemas = {"dbo", "public", "sys", "guest", "information_schema", "fabricacctest", "config", "log"}
            if tbl.lower() in known_schemas and sch.lower() not in known_schemas and sch:
                tbl, sch = sch, tbl
            elif not sch and raw_row.get("SchemaName"):
                sch = str(raw_row.get("SchemaName")).strip()

            return tbl, sch

        def parse_duration_seconds(dur_val, start_val, end_val):
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
            if seconds <= 0:
                return "0.00s"
            if seconds < 60:
                return f"{seconds:.2f}s"
            mins = int(seconds // 60)
            rem = seconds % 60
            return f"{mins}m {rem:.1f}s"

        def parse_row_count(val):
            if val is None:
                return 0
            try:
                return int(val)
            except Exception:
                try:
                    return int(float(str(val).replace(",", "").strip()))
                except Exception:
                    return 0

        # Dynamically determine the source_name column from mapping or default
        br_src_col = br_map.get("source_name_col") or "SourceName"

        # Filter Bronze to "Data Load" entries (user request: calculate from and show Data Load records)
        has_bronze_data_load = any("data load" in safe_str(r.get(br_src_col, "")).lower() for r in bronze_rows)
        active_bronze_rows = [
            r for r in bronze_rows 
            if not has_bronze_data_load or "data load" in safe_str(r.get(br_src_col, "")).lower()
        ]

        # Normalization - Bronze Items
        bronze_items = []
        br_tbl_col = br_map.get("table_name_col")
        br_sch_col = br_map.get("schema_name_col")
        br_cnt_col = br_map.get("rows_processed_col")
        br_sts_col = br_map.get("status_col")
        br_st_col = br_map.get("start_time_col")
        br_et_col = br_map.get("end_time_col")
        br_err_col = br_map.get("error_message_col")
        br_dur_col = br_map.get("duration_col")

        for r in active_bronze_rows:
            st = safe_str(r.get(br_st_col)) if br_st_col else ""
            et = safe_str(r.get(br_et_col)) if br_et_col else ""
            dur_sec = parse_duration_seconds(r.get(br_dur_col) if br_dur_col else None, st, et)
            status_val = safe_str(r.get(br_sts_col)) if br_sts_col else "Success"
            err_val = safe_str(r.get(br_err_col)) if br_err_col else "No Error"
            is_success = status_val.lower() in ["success", "succeeded", "completed"] and (err_val == "No Error" or not err_val)
            
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
                "rawData": {k: str(v) if v is not None else None for k, v in r.items()}
            })

        # Normalization - Silver Items
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
            is_success = status_val.lower() in ["success", "succeeded", "completed"] and (err_val == "No Error" or not err_val or err_val == "")
            
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
                "rawData": {k: str(v) if v is not None else None for k, v in r.items()}
            })

        all_items = bronze_items + silver_items

        # Calculations: Top KPIs (NOTE: NO "Tables with alerts")
        total_tables = len(all_items)
        success_tables = sum(1 for i in all_items if i["status"] == "Success")
        failed_tables = sum(1 for i in all_items if i["status"] != "Success")
        total_rows = sum(i["rowsProcessed"] for i in all_items)
        avg_dur_sec = (sum(i["durationSec"] for i in all_items) / total_tables) if total_tables > 0 else 0.0

        def format_rows(count):
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
            "rawRowsProcessed": total_rows
        }

        # Bronze Layer Overview
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
            "rowsProcessed": format_rows(br_rows)
        }

        # Silver Layer Overview
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
            "rowsProcessed": format_rows(sl_rows)
        }

        # Clean batch header data
        header_summary = {
            "batchId": safe_str(header_data.get(bh_map.get("batch_id_col")) if bh_map.get("batch_id_col") else ""),
            "pipelineName": safe_str(header_data.get(bh_map.get("pipeline_name_col")) if bh_map.get("pipeline_name_col") else ""),
            "pipelineRunId": safe_str(header_data.get(bh_map.get("pipeline_run_id_col")) if bh_map.get("pipeline_run_id_col") else ""),
            "status": safe_str(header_data.get(bh_map.get("status_col")) if bh_map.get("status_col") else ""),
            "startTime": safe_str(header_data.get(bh_map.get("start_time_col")) if bh_map.get("start_time_col") else ""),
            "endTime": safe_str(header_data.get(bh_map.get("end_time_col")) if bh_map.get("end_time_col") else ""),
            "duration": safe_str(header_data.get(bh_map.get("duration_col")) if bh_map.get("duration_col") else ""),
            "errorMessage": safe_str(header_data.get(bh_map.get("error_message_col")) if bh_map.get("error_message_col") else "")
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
            "tableDetails": all_items
        }

table_log_service = TableLogService()

