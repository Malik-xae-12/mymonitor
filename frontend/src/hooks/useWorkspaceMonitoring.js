import { useEffect, useState, useRef, useCallback } from 'react';

export function useWorkspaceMonitoring(workspaceId) {
  const [pipelineTree, setPipelineTree] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewersCount, setViewersCount] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeWorkspaceIdRef = useRef(workspaceId);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    activeWorkspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  const connectToWorkspace = useCallback((targetWorkspaceId) => {
    if (!targetWorkspaceId) {
      setPipelineTree([]);
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    // 1. Immediately abort previous REST fetch if in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 2. Immediately close previous WebSocket
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "Switching workspace");
      } catch (e) {
        console.warn("Socket close error:", e);
      }
      wsRef.current = null;
    }

    // 3. Clear out previous workspace data so no stale pipelines show
    setPipelineTree([]);
    setIsConnected(false);
    setIsLoading(true);
    setError(null);

    // 4. Fetch initial fast REST snapshot from SQLite
    fetch(`/api/workspaces/${targetWorkspaceId}/snapshot`, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (activeWorkspaceIdRef.current === targetWorkspaceId) {
          setPipelineTree(json.pipelines || []);
          setLastUpdated(new Date().toISOString());
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn("Initial snapshot fetch warning:", err);
          if (activeWorkspaceIdRef.current === targetWorkspaceId) {
            setIsLoading(false);
          }
        }
      });

    // 5. Open new WebSocket connection for the selected workspace
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/workspaces/${targetWorkspaceId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (activeWorkspaceIdRef.current === targetWorkspaceId) {
        setIsConnected(true);
        setError(null);
      } else {
        ws.close();
      }
    };

    ws.onmessage = (event) => {
      if (activeWorkspaceIdRef.current !== targetWorkspaceId) return;

      try {
        const message = JSON.parse(event.data);
        if (message.type === 'FULL_SNAPSHOT') {
          if (message.workspaceId === targetWorkspaceId) {
            setPipelineTree(message.data || []);
            setLastUpdated(message.timestamp || new Date().toISOString());
            setViewersCount(message.viewersCount || 1);
            setIsLoading(false);
          }
        } else if (message.type === 'INCIDENT_CREATED') {
          // Update incident on matching pipeline
          const inc = message.incident;
          setPipelineTree((prev) =>
            prev.map((p) => {
              if (p.pipelineId === inc.pipelineId || p.id === inc.pipelineRunId) {
                return { ...p, incident: inc };
              }
              return p;
            })
          );
        } else if (message.type === 'SLA_BREACHED') {
          setPipelineTree((prev) =>
            prev.map((p) => {
              if (p.incident && p.incident.id === message.incidentId) {
                return {
                  ...p,
                  incident: {
                    ...p.incident,
                    status: 'ESCALATED_L2',
                    l2EscalatedAt: message.l2EscalatedAt
                  }
                };
              }
              return p;
            })
          );
        } else if (message.type === 'INCIDENT_RESOLVED') {
          setPipelineTree((prev) =>
            prev.map((p) => {
              if (p.incident && p.incident.id === message.incidentId) {
                return {
                  ...p,
                  incident: {
                    ...p.incident,
                    status: 'RESOLVED',
                    resolvedBy: message.resolvedBy,
                    resolvedAt: message.resolvedAt
                  }
                };
              }
              return p;
            })
          );
        }
      } catch (err) {
        console.error("Error parsing WebSocket payload:", err);
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket error for workspace", targetWorkspaceId, err);
      if (activeWorkspaceIdRef.current === targetWorkspaceId) {
        setIsConnected(false);
      }
    };

    ws.onclose = (event) => {
      if (activeWorkspaceIdRef.current === targetWorkspaceId) {
        setIsConnected(false);
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (activeWorkspaceIdRef.current === targetWorkspaceId) {
              connectToWorkspace(targetWorkspaceId);
            }
          }, 3000);
        }
      }
    };
  }, []);

  useEffect(() => {
    connectToWorkspace(workspaceId);

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, "Unmounting/Changing");
        } catch {}
      }
    };
  }, [workspaceId, connectToWorkspace]);

  const resolveIncident = async (incidentId) => {
    if (!workspaceId || !incidentId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/incidents/${incidentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy: 'Operator' })
      });
      if (res.ok) {
        setPipelineTree((prev) =>
          prev.map((p) => {
            if (p.incident && p.incident.id === incidentId) {
              return {
                ...p,
                incident: {
                  ...p.incident,
                  status: 'RESOLVED',
                  resolvedBy: 'Operator',
                  resolvedAt: new Date().toISOString()
                }
              };
            }
            return p;
          })
        );
      }
    } catch (e) {
      console.error('Resolve incident error:', e);
    }
  };

  const refresh = () => {
    if (workspaceId) {
      setIsLoading(true);
      fetch(`/api/workspaces/${workspaceId}/snapshot?force_sync=true`)
        .then((res) => res.json())
        .then((json) => {
          if (activeWorkspaceIdRef.current === workspaceId) {
            setPipelineTree(json.pipelines || []);
            setLastUpdated(new Date().toISOString());
            setIsLoading(false);
          }
        })
        .catch(() => setIsLoading(false));
    }
  };

  return {
    pipelineTree,
    isConnected,
    lastUpdated,
    viewersCount,
    isLoading,
    error,
    refresh,
    resolveIncident
  };
}
