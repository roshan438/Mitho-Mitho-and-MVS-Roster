






import { Navigate, Outlet } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";

export default function ApprovalGate({ children }) {
  const { fbUser, profile, status, loading, role } = useAuthUser();

  if (loading || (fbUser && !profile)) {
    return (
      <div className="container">
        <div className="card">Verifying approval status...</div>
      </div>
    );
  }

  if (role === "admin") return children || <Outlet />;

  if (status !== "approved") return <Navigate to="/pending" replace />;

  return children || <Outlet />;
}