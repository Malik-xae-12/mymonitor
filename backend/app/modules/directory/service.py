import logging
from typing import Any, Dict, List
from app.services.directory_service import directory_service

logger = logging.getLogger("fabric_monitor.directory")


class DirectoryDomainService:
    async def search_users(self, query: str = "", limit: int = 15) -> List[Dict[str, Any]]:
        return await directory_service.search_users(query=query, top=limit)


directory_domain_service = DirectoryDomainService()
