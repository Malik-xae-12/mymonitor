"""Microsoft Graph API Directory Service for Entra ID (Azure AD) User Lookup.

Powers the Microsoft Fabric People Picker for selecting L1 and L2 support
personnel on individual pipelines.
"""
import logging
import time
import urllib.parse
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger("fabric_monitor.directory")


def _get_initials(display_name: str, email: str) -> str:
    """Computes a clean 2-letter initials string for persona coins."""
    if display_name:
        parts = [p for p in display_name.strip().split() if p]
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        if len(parts) == 1 and len(parts[0]) >= 2:
            return parts[0][:2].upper()
    if email:
        return email[:2].upper()
    return "US"


class DirectoryService:
    def __init__(self):
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0
        self._active_client_type: str = "primary"

    async def _acquire_graph_token(self) -> Optional[str]:
        """Acquires a Microsoft Graph app-only access token with automatic failover."""
        now = time.time()
        if self._cached_token and now < self._token_expires_at - 60:
            return self._cached_token

        # 1. Attempt primary: USERS_AZURE_AD_* credentials
        tenant_id = settings.USERS_AZURE_AD_TENANT_ID or settings.AZURE_TENANT_ID
        client_id = settings.USERS_AZURE_AD_CLIENT_ID
        client_secret = settings.USERS_AZURE_AD_CLIENT_SECRET
        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

        async with httpx.AsyncClient(timeout=10.0) as client:
            if client_id and client_secret:
                try:
                    resp = await client.post(
                        token_url,
                        data={
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "grant_type": "client_credentials",
                            "scope": "https://graph.microsoft.com/.default",
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        self._cached_token = data.get("access_token")
                        self._token_expires_at = now + float(data.get("expires_in", 3600))
                        self._active_client_type = "primary"
                        logger.info("Acquired Graph API token via USERS_AZURE_AD client")
                        return self._cached_token
                    else:
                        logger.warning(
                            "Primary Graph client authentication returned %d: %s. Falling back to default Fabric client.",
                            resp.status_code,
                            resp.text,
                        )
                except Exception as exc:
                    logger.warning("Error acquiring token via primary client: %s", exc)

            # 2. Fallback: AZURE_CLIENT_ID / AZURE_CLIENT_SECRET (verified working on this tenant)
            fb_client_id = settings.AZURE_CLIENT_ID
            fb_client_secret = settings.AZURE_CLIENT_SECRET
            if fb_client_id and fb_client_secret:
                try:
                    resp = await client.post(
                        f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/oauth2/v2.0/token",
                        data={
                            "client_id": fb_client_id,
                            "client_secret": fb_client_secret,
                            "grant_type": "client_credentials",
                            "scope": "https://graph.microsoft.com/.default",
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        self._cached_token = data.get("access_token")
                        self._token_expires_at = now + float(data.get("expires_in", 3600))
                        self._active_client_type = "fallback"
                        logger.info("Acquired Graph API token via tenant fallback client")
                        return self._cached_token
                    else:
                        logger.error("Fallback Graph token acquisition failed: %d %s", resp.status_code, resp.text)
                except Exception as exc:
                    logger.error("Error acquiring fallback Graph token: %s", exc)

        return None

    async def search_users(self, query: str = "", top: int = 15, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Searches users in Entra ID (Azure AD) directory via Microsoft Graph API."""
        count = limit if limit is not None else top
        token = await self._acquire_graph_token()
        if not token:
            logger.error("Cannot search directory users: no valid Graph API access token")
            return []

        clean_q = query.strip()
        select_fields = "id,displayName,userPrincipalName,mail,jobTitle,department"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                "Authorization": f"Bearer {token}",
                "ConsistencyLevel": "eventual",
            }
            try:
                raw_users = []
                if clean_q:
                    # 1. Advanced Graph $search
                    terms = [t.strip().replace('"', '') for t in clean_q.split() if t.strip()]
                    if terms:
                        clauses = [
                            f'("displayName:{t}" OR "mail:{t}" OR "userPrincipalName:{t}")'
                            for t in terms
                        ]
                        search_expr = " AND ".join(clauses)
                        encoded_search = urllib.parse.quote(search_expr)
                        search_url = (
                            f"https://graph.microsoft.com/v1.0/users?$search={encoded_search}"
                            f"&$select={select_fields}&$top={count}"
                        )
                        resp = await client.get(search_url, headers=headers)
                        if resp.status_code == 200:
                            raw_users = resp.json().get("value", [])

                    # 2. Fallback to startswith filter if $search returned nothing
                    if not raw_users:
                        safe_q = clean_q.replace("'", "''")
                        filter_expr = (
                            f"startswith(displayName, '{safe_q}') or "
                            f"startswith(mail, '{safe_q}') or "
                            f"startswith(userPrincipalName, '{safe_q}')"
                        )
                        encoded_filter = urllib.parse.quote(filter_expr)
                        filter_url = (
                            f"https://graph.microsoft.com/v1.0/users?$filter={encoded_filter}"
                            f"&$select={select_fields}&$top={count}"
                        )
                        resp = await client.get(filter_url, headers=headers)
                        if resp.status_code == 200:
                            raw_users = resp.json().get("value", [])

                    # 3. Final fallback: fetch top 100 users and filter in-memory
                    if not raw_users:
                        fb_url = f"https://graph.microsoft.com/v1.0/users?$select={select_fields}&$top=100"
                        resp = await client.get(fb_url, headers=headers)
                        if resp.status_code == 200:
                            candidates = resp.json().get("value", [])
                            q_lower = clean_q.lower()
                            raw_users = [
                                u for u in candidates
                                if q_lower in (u.get("displayName") or "").lower()
                                or q_lower in (u.get("mail") or "").lower()
                                or q_lower in (u.get("userPrincipalName") or "").lower()
                            ]
                else:
                    url = f"https://graph.microsoft.com/v1.0/users?$select={select_fields}&$top={count}"
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        raw_users = resp.json().get("value", [])

                # Deduplicate and format user objects
                results = []
                seen_ids = set()
                for u in raw_users:
                    uid = u.get("id") or (u.get("mail") or u.get("userPrincipalName") or "").lower()
                    if uid in seen_ids:
                        continue
                    seen_ids.add(uid)

                    display_name = u.get("displayName") or ""
                    email = (u.get("mail") or u.get("userPrincipalName") or "").lower()
                    upn = u.get("userPrincipalName") or ""

                    results.append({
                        "id": u.get("id"),
                        "displayName": display_name or email,
                        "email": email,
                        "userPrincipalName": upn,
                        "jobTitle": u.get("jobTitle") or "",
                        "department": u.get("department") or "",
                        "initials": _get_initials(display_name, email),
                    })

                return results[:count]

            except Exception as exc:
                logger.error("Error querying Microsoft Graph users: %s", exc)

        return []


directory_service = DirectoryService()
directory_domain_service = directory_service
