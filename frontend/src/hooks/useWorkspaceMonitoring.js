import { useEffect, useState, useRef, useCallback } from 'react';

export function useWorkspaceMonitoring(
  workspaceId, 
  dateFilter = { preset: 'latest', startDate: null, endDate: null }
) {
  const [pipelineTree, setPipelineTree] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    notRun: 0,
    scheduled: 0,
    notScheduled: 0
  });
  const [dateFilterInfo, setDateFilterInfo] = useState({
    preset: 'latest',
    startDate: null,
    endDate: null,
    isFuture: false,
    availableRunDates: []
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewersCount, setViewersCount] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeWorkspaceIdRef = useRef(workspaceId);
  const dateFilterRef = useRef(dateFilter);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    activeWorkspaceIdRef.current = workspaceId;
    dateFilterRef.current = dateFilter;
  }, [workspaceId, dateFilter]);

  // Fetch REST snapshot with date filter
  const fetchSnapshot = useCallback((targetWorkspaceId, filter) => {
    if (!targetWorkspaceId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    const preset = filter?.preset || 'latest';
    const sDt = filter?.startDate || '';
    const eDt = filter?.endDate || '';
    const url = `/api/workspaces/${targetWorkspaceId}/snapshot?date_preset=${encodeURIComponent(preset)}&start_date=${encodeURIComponent(sDt)}&end_date=${encodeURIComponent(eDt)}`;

    fetch(url, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (activeWorkspaceIdRef.current === targetWorkspaceId) {
          setPipelineTree(json.pipelines || []);
          if (json.metrics) setMetrics(json.metrics);
          if (json.dateFilter) setDateFilterInfo(json.dateFilter);
          setLastUpdated(new Date().toISOString());
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn("Snapshot fetch warning:", err);
          if (activeWorkspaceIdRef.current === targetWorkspaceId) {
            setIsLoading(false);
          }
        }
      });
  }, []);

  const connectToWorkspace = useCallback((targetWorkspaceId) => {
    if (!targetWorkspaceId) {
      setPipelineTree([]);
      setMetrics({
        total: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
        notRun: 0,
        scheduled: 0,
        notScheduled: 0
      });
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    // Close previous WebSocket
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

    // Clear previous workspace state
    setPipelineTree([]);
    setIsConnected(false);
    setError(null);

    // Initial snapshot fetch
    fetchSnapshot(targetWorkspaceId, dateFilterRef.current);

    // Open WebSocket connection
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
            // Only update tree from live socket if on 'latest' view
            if (!dateFilterRef.current?.preset || dateFilterRef.current?.preset === 'latest') {
              const incoming = message.data || [];
              if (incoming.length > 0) {
                setPipelineTree(incoming);
                const running = incoming.filter((p) => ['inprogress', 'running'].includes((p.status || '').toLowerCase())).length;
                const succeeded = incoming.filter((p) => ['completed', 'succeeded', 'success'].includes((p.status || '').toLowerCase())).length;
                const failed = incoming.filter((p) => (p.status || '').toLowerCase() === 'failed').length;
                const cancelled = incoming.filter((p) => ['cancelled', 'canceled'].includes((p.status || '').toLowerCase())).length;
                const notRun = incoming.filter((p) => ['no runs', 'noruns', 'notstarted', 'never executed', 'not run'].includes((p.status || '').toLowerCase())).length;
                setMetrics({
                  total: incoming.length,
                  running,
                  succeeded,
                  failed,
                  cancelled,
                  notRun,
                  scheduled: 0,
                  notScheduled: 0,
                });
              }
              setLastUpdated(message.timestamp || new Date().toISOString());
              setViewersCount(message.viewersCount || 1);
              setIsLoading(false);
            }
          }
        } else if (message.type === 'INCIDENT_CREATED') {
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
  }, [fetchSnapshot]);

  // Connect on workspace change
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

  // Re-fetch snapshot when dateFilter changes
  useEffect(() => {
    if (workspaceId) {
      fetchSnapshot(workspaceId, dateFilter);
    }
  }, [workspaceId, dateFilter.preset, dateFilter.startDate, dateFilter.endDate, fetchSnapshot]);

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
      const preset = dateFilterRef.current?.preset || 'latest';
      const sDt = dateFilterRef.current?.startDate || '';
      const eDt = dateFilterRef.current?.endDate || '';
      fetch(`/api/workspaces/${workspaceId}/snapshot?force_sync=true&date_preset=${encodeURIComponent(preset)}&start_date=${encodeURIComponent(sDt)}&end_date=${encodeURIComponent(eDt)}`)
        .then((res) => res.json())
        .then((json) => {
          if (activeWorkspaceIdRef.current === workspaceId) {
            setPipelineTree(json.pipelines || []);
            if (json.metrics) setMetrics(json.metrics);
            if (json.dateFilter) setDateFilterInfo(json.dateFilter);
            setLastUpdated(new Date().toISOString());
            setIsLoading(false);
          }
        })
        .catch(() => setIsLoading(false));
    }
  };

  return {
    pipelineTree,
    metrics,
    dateFilterInfo,
    isConnected,
    lastUpdated,
    viewersCount,
    isLoading,
    error,
    refresh,
    resolveIncident
  };
}
