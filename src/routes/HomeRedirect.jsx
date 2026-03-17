








import { Navigate } from "react-router-dom";
import { useAuthUser } from "../auth/useAuthUser";

export default function HomeRedirect() {
  const { fbUser, role, status, loading, profileComplete } = useAuthUser();

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Syncing profile...</p>
        </div>
      </div>
    );
  }

  if (!fbUser) return <Navigate to="/login" replace />;

  if (!role) {
    return <div className="container">Finalizing session...</div>;
  }

  if (role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!profileComplete) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (status === "approved") {
    return <Navigate to="/staff/today" replace />;
  }

  return <Navigate to="/pending" replace />;
}