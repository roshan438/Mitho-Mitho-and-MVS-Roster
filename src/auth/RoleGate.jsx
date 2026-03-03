import { Navigate } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";

export default function RoleGate({ allow = [], children }) {
  const { role, loading } = useAuthUser();
  if (loading) return <div className="container"><div className="card">Loading...</div></div>;

  if (!role) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Navigate to="/" replace />;

  return children;
}