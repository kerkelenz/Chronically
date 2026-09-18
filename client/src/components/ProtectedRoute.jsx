import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * `requireAdmin` hides admin-only pages from the router. It is a convenience,
 * not a security boundary — the cached user in localStorage is client state and
 * could be edited by hand. The real gate is requireAdmin on the server, which
 * re-reads the user row on every request; this only avoids showing a page that
 * would fail every one of its API calls anyway.
 */
function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requireAdmin && user.isAdmin !== true) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
