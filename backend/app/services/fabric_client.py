import time
import datetime
import httpx
from typing import List, Dict, Any, Optional
from backend.app.core.config import settings
from backend.app.core.rate_limiter import rate_limiter

import logging

logger = logging.getLogger("fabric_monitor.client")

class FabricClient:
    def __init__(self):
        self.tenant_id = settings.AZURE_TENANT_ID
        self.client_id = settings.AZURE_CLIENT_ID
        self.client_secret = settings.AZURE_CLIENT_SECRET
        self.base_url = "https://api.fabric.microsoft.com/v1"
        self._token: Optional[str] = None
        self._token_expiry: float = 0.0

    async def get_token(self) -> str:
        """
        Acquires or re-uses a cached OAuth2 access token for Microsoft Fabric.
        Refreshes proactively 120 seconds before expiration.
        """
        now = time.time()
        if self._token and now < self._token_expiry - 120:
            return self._token

        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://api.fabric.microsoft.com/.default"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(token_url, data=data)
                resp.raise_for_status()
                res_json = resp.json()
                self._token = res_json["access_token"]
                self._token_expiry = now + res_json.get("expires_in", 3600)
                return self._token
        except Exception as e:
            logger.error(f"Error acquiring Fabric OAuth2 token: {e}")
            return self._token or ""

    async def _get_headers(self) -> Dict[str, str]:
        token = await self.get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    async def get_workspaces(self) -> List[Dict[str, Any]]:
        """List all workspaces accessible to the Service Principal."""
        headers = await self._get_headers()
        url = f"{self.base_url}/workspaces"
        
        async def _call():
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        return res.json().get("value", [])
                    return []
            except Exception as e:
                logger.warning(f"Failed to get workspaces: {e}")
                return []

        return await rate_limiter.run(_call())

    async def get_pipelines(self, workspace_id: str) -> List[Dict[str, Any]]:
        """List all Data Pipelines inside a workspace."""
        headers = await self._get_headers()
        url = f"{self.base_url}/workspaces/{workspace_id}/items?type=DataPipeline"

        async def _call():
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        return res.json().get("value", [])
                    return []
            except Exception as e:
                logger.warning(f"Failed to get pipelines for {workspace_id}: {e}")
                return []

        return await rate_limiter.run(_call())

    async def get_job_instances(self, workspace_id: str, pipeline_id: str) -> List[Dict[str, Any]]:
        """List recent execution runs (instances) for a given pipeline."""
        headers = await self._get_headers()
        url = f"{self.base_url}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances"

        async def _call():
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        return res.json().get("value", [])
                    return []
            except Exception as e:
                logger.warning(f"Failed to get job instances for pipeline {pipeline_id}: {e}")
                return []

        return await rate_limiter.run(_call())

    async def query_activity_runs(
        self, 
        workspace_id: str, 
        pipeline_id: str, 
        run_id: str,
        start_time_utc: Optional[str] = None,
        end_time_utc: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query granular activity executions and error diagnostics for a pipeline run.
        Fabric /queryactivityruns requires lastUpdatedAfter and lastUpdatedBefore.
        """
        headers = await self._get_headers()
        
        now = datetime.datetime.now(datetime.timezone.utc)
        if start_time_utc:
            clean_start = str(start_time_utc).replace("Z", "+00:00")
            try:
                st = datetime.datetime.fromisoformat(clean_start)
                last_updated_after = (st - datetime.timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
            except Exception:
                last_updated_after = (now - datetime.timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")
        else:
            last_updated_after = (now - datetime.timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")

        if end_time_utc:
            clean_end = str(end_time_utc).replace("Z", "+00:00")
            try:
                et = datetime.datetime.fromisoformat(clean_end)
                last_updated_before = (et + datetime.timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z")
            except Exception:
                last_updated_before = (now + datetime.timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z")
        else:
            last_updated_before = (now + datetime.timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z")

        payload = {
            "lastUpdatedAfter": last_updated_after,
            "lastUpdatedBefore": last_updated_before,
            "filters": [],
            "orderBy": [{"orderBy": "ActivityRunStart", "order": "ASC"}]
        }

        url1 = f"{self.base_url}/workspaces/{workspace_id}/datapipelines/pipelineruns/{run_id}/queryactivityruns"
        url2 = f"{self.base_url}/workspaces/{workspace_id}/datapipelines/{pipeline_id}/pipelineruns/{run_id}/queryActivityRuns"

        async def _call():
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(url1, headers=headers, json=payload)
                    if res.status_code == 200:
                        return res.json().get("value", [])
                    
                    res2 = await client.post(url2, headers=headers, json=payload)
                    if res2.status_code == 200:
                        return res2.json().get("value", [])
                    return []
            except Exception as e:
                logger.warning(f"Failed to query activities for run {run_id}: {e}")
                return []

        return await rate_limiter.run(_call())

    async def get_pipeline_schedules(self, workspace_id: str, pipeline_id: str) -> Optional[Dict[str, Any]]:
        """Get the schedule configuration for a pipeline (if configured)."""
        headers = await self._get_headers()
        url = f"{self.base_url}/workspaces/{workspace_id}/items/{pipeline_id}/schedules"

        async def _call():
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.json()
                return None

        return await rate_limiter.run(_call())

fabric_client = FabricClient()

