// import { Navigate } from "react-router-dom";
// import { useAuthUser } from "./useAuthUser";

// export default function AuthGate({ children }) {
//   const { fbUser, loading } = useAuthUser();
//   if (loading) return <div className="container"><div className="card">Loading...</div></div>;
//   if (!fbUser) return <Navigate to="/login" replace />;
//   return children;
// }









import { Navigate, Outlet } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";

export default function AuthGate({ children }) {
  const { fbUser, loading } = useAuthUser();

  if (loading) {
    return (
      <div className="container">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (!fbUser) return <Navigate to="/login" replace />;

  return children || <Outlet />;
}