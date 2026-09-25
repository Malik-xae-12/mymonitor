/**
 * useAdminUsers Hook
 * 
 * Manages state and asynchronous operations for the Entra ID / local support team roster.
 */

import { useState, useEffect, useCallback } from 'react';
import { listUsers, setUserRole, addUser, deleteUser } from '../api/adminApi';

/**
 * Custom hook to manage administrative users and support personnel.
 * 
 * @returns {Object} User management state and mutation functions.
 */
export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Fetches the latest users roster. */
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /**
   * Adds a new person to the support roster.
   *
   * @param {{ email: string, display_name: string, oid: string, role_id: string }} payload
   */
  const handleAddUser = useCallback(async (payload) => {
    const data = await addUser(payload);
    setUsers(Array.isArray(data?.users) ? data.users : []);
    return data;
  }, []);

  /**
   * Updates an existing user's assigned role.
   *
   * @param {string} email
   * @param {string} roleId
   */
  const handleUpdateRole = useCallback(async (email, roleId) => {
    const data = await setUserRole(email, roleId);
    setUsers(Array.isArray(data?.users) ? data.users : []);
    return data;
  }, []);

  /**
   * Removes a user from the support roster.
   *
   * @param {string} email
   */
  const handleDeleteUser = useCallback(async (email) => {
    const data = await deleteUser(email);
    setUsers(Array.isArray(data?.users) ? data.users : []);
    return data;
  }, []);

  return {
    users,
    isLoading,
    error,
    refresh: fetchUsers,
    addUser: handleAddUser,
    updateRole: handleUpdateRole,
    deleteUser: handleDeleteUser,
  };
}

export default useAdminUsers;
