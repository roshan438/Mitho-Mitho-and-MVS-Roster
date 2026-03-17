





import { Navigate } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";

export default function RoleGate({ allow = [], children }) {
  const { fbUser, profile, role, loading } = useAuthUser();

  if (loading || (fbUser && !profile)) {
    return (
      <div className="container">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (!fbUser) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/" replace />;
  if (!allow.includes(role)) return <Navigate to="/" replace />;

  return children;
}