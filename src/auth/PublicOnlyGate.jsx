import { Navigate, Outlet } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";

export default function PublicOnlyGate({ children }) {
  const { fbUser, role, status, profileComplete, loading } = useAuthUser();

  if (loading) {
    return (
      <div className="container">
        <div className="card">Checking session...</div>
      </div>
    );
  }

  if (!fbUser) return children || <Outlet />;

  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (!profileComplete) return <Navigate to="/complete-profile" replace />;
  if (status === "approved") return <Navigate to="/staff/today" replace />;

  return <Navigate to="/pending" replace />;
}