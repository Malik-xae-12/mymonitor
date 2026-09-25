/**
 * useTableLogs Hook
 * 
 * Manages fetching, pagination, layer switching (batch, bronze, silver),
 * and query filtering for Fabric Lakehouse / Warehouse table logs.
 */

import { useState, useEffect, useCallback } from 'react';
import { getTableLogs, getTableLogMapping } from '../api/tableLogsApi';

/**
 * Custom hook to manage table logs data query state and pagination.
 *
 * @param {string} workspaceId - Microsoft Fabric Workspace GUID.
 * @param {string} [initialLayer='batch'] - Initial layer ('batch', 'bronze', 'silver').
 * @returns {Object} Table logs query state and handlers.
 */
export function useTableLogs(workspaceId, initialLayer = 'batch') {
  const [layer, setLayer] = useState(initialLayer);
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [mapping, setMapping] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    batchId: '',
    pipelineName: '',
    status: '',
    limit: 50,
    offset: 0,
  });

  /** Fetches table log mapping configuration for the workspace. */
  const fetchMapping = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getTableLogMapping(workspaceId);
      setMapping(data);
    } catch (err) {
      console.warn('Failed to load table log mapping:', err);
    }
  }, [workspaceId]);

  /** Fetches logs for the active workspace, layer, and filter criteria. */
  const fetchLogs = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTableLogs(workspaceId, {
        layer,
        batchId: filters.batchId || undefined,
        pipelineName: filters.pipelineName || undefined,
        status: filters.status || undefined,
        limit: filters.limit,
        offset: filters.offset,
      });
      setLogs(Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : []);
      setTotalCount(data?.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to query table logs');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, layer, filters]);

  useEffect(() => {
    fetchMapping();
  }, [fetchMapping]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /**
   * Updates filter parameters and resets pagination offset.
   *
   * @param {Object} newFilters
   */
  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      offset: 0, // Reset to page 1 on filter update
    }));
  }, []);

  /**
   * Switches to a new table layer.
   *
   * @param {string} newLayer
   */
  const switchLayer = useCallback((newLayer) => {
    setLayer(newLayer);
    setFilters((prev) => ({ ...prev, offset: 0 }));
  }, []);

  /**
   * Updates the pagination page offset.
   *
   * @param {number} newOffset
   */
  const setPageOffset = useCallback((newOffset) => {
    setFilters((prev) => ({ ...prev, offset: newOffset }));
  }, []);

  return {
    layer,
    logs,
    totalCount,
    mapping,
    isLoading,
    error,
    filters,
    switchLayer,
    updateFilters,
    setPageOffset,
    refresh: fetchLogs,
  };
}

export default useTableLogs;
