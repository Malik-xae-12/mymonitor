/**
 * useAdminAssignments Hook
 * 
 * Manages state and mutations for workspace assignments, pipeline discovery,
 * and SLA warning/breach configurations.
 */

import { useState, useEffect, useCallback } from 'react';
import { listWorkspaces, listAssignments, saveAssignment, listParentPipelines, savePipelineSla } from '../api/adminApi';

/**
 * Custom hook to manage workspace responsibility assignments and SLA configurations.
 * 
 * @returns {Object} Workspace assignments state and operations.
 */
export function useAdminAssignments() {
  const [workspaces, setWorkspaces] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Loads all workspaces and assignments simultaneously. */
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [wsList, asgnList] = await Promise.all([listWorkspaces(), listAssignments()]);
      setWorkspaces(Array.isArray(wsList) ? wsList : []);
      const map = {};
      (Array.isArray(asgnList) ? asgnList : []).forEach((a) => {
        map[a.workspace_id] = a;
      });
      setAssignments(map);
    } catch (err) {
      setError(err.message || 'Failed to load workspace assignments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Saves or updates a workspace assignment.
   *
   * @param {Object} payload
   */
  const handleSaveAssignment = useCallback(async (payload) => {
    const saved = await saveAssignment(payload);
    setAssignments((prev) => ({ ...prev, [saved.workspace_id]: saved }));
    return saved;
  }, []);

  /**
   * Fetches parent pipelines for a workspace.
   *
   * @param {string} workspaceId
   * @param {boolean} [forceSync=false]
   */
  const fetchPipelines = useCallback(async (workspaceId, forceSync = false) => {
    return await listParentPipelines(workspaceId, forceSync);
  }, []);

  /**
   * Saves custom SLA values for a parent pipeline.
   *
   * @param {string} workspaceId
   * @param {string} pipelineId
   * @param {Object} slaPayload
   */
  const handleSavePipelineSla = useCallback(async (workspaceId, pipelineId, slaPayload) => {
    return await savePipelineSla(workspaceId, pipelineId, slaPayload);
  }, []);

  return {
    workspaces,
    assignments,
    isLoading,
    error,
    refresh: fetchAll,
    saveAssignment: handleSaveAssignment,
    fetchPipelines,
    savePipelineSla: handleSavePipelineSla,
  };
}

export default useAdminAssignments;
