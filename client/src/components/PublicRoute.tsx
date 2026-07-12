import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function PublicRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-center">
        <p>Loading session...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
