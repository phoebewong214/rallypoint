import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  /** When true (default), an authenticated-but-unverified user is sent to the
   *  verify-email-pending screen. Set false for the pending screen itself. */
  requireVerified?: boolean;
}> = ({ children, requireVerified = true }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "var(--text-dim)" }}>
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // Gate the app behind email verification.
  if (requireVerified && user && user.emailVerified === false) {
    return <Navigate to="/verify-pending" replace />;
  }

  return <>{children}</>;
};
