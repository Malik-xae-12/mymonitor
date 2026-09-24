import React from 'react';
import { useAuth } from '../features/auth';
import { LoginPage } from '../features/auth';

export default function PrivateRoute({ children, requiredRoles = [] }) {
  const { isAuthenticated, role, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#faf9f8]">
        <div className="text-xs text-[#605e5c]">Authenticating...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (requiredRoles.length > 0) {
    const hasRole = isAdmin || requiredRoles.includes(role);
    if (!hasRole) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#faf9f8]">
          <h2 className="text-base font-semibold text-[#242424]">Access Denied</h2>
          <p className="text-xs text-[#605e5c] mt-1">You do not have permission to view this view.</p>
        </div>
      );
    }
  }

  return children;
}
