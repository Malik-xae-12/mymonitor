import datetime
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.modules.websocket.connection_manager import connection_manager

logger = logging.getLogger("fabric_monitor.ws")
router = APIRouter(tags=["websockets"])


@router.websocket("/ws/workspaces/{workspace_id}")
async def workspace_websocket_endpoint(websocket: WebSocket, workspace_id: str):
    from app.modules.pipelines.poller import leased_poller

    await connection_manager.connect(workspace_id, websocket)
    try:
        # Send an immediate snapshot right upon connection so user sees instant state
        initial_snapshot = await leased_poller.fetch_workspace_snapshot(workspace_id)
        await websocket.send_json({
            "type": "FULL_SNAPSHOT",
            "workspaceId": workspace_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "viewersCount": connection_manager.get_viewer_count(workspace_id),
            "data": initial_snapshot,
        })

        # Keep connection open and listen for client messages / heartbeats
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        connection_manager.disconnect(workspace_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error in workspace {workspace_id}: {e}")
        connection_manager.disconnect(workspace_id, websocket)
