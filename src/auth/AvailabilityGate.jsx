










import { Navigate, Outlet } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";

export default function AvailabilityGate({ children }) {
  const { fbUser, role, status, loading, profile } = useAuthUser();

  if (loading || (fbUser && !profile)) {
    return (
      <div className="container">
        <div className="card">Checking availability...</div>
      </div>
    );
  }

  if (!fbUser) return <Navigate to="/login" replace />;

  if (role === "admin") return children || <Outlet />;

  if (status !== "approved") return <Navigate to="/pending" replace />;

  if (!profile?.availabilitySubmitted) {
    return <Navigate to="/staff/availability/setup" replace />;
  }

  return children || <Outlet />;
}