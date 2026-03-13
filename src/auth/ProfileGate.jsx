// import { Navigate, Outlet } from "react-router-dom";
// import { useAuthUser } from "./useAuthUser";

// export default function ProfileGate({ children }) {
//   const { fbUser, role, loading, profileComplete } = useAuthUser();

//   if (loading) {
//     return (
//       <div className="container">
//         <div className="card">Checking profile...</div>
//       </div>
//     );
//   }

//   if (!fbUser) return <Navigate to="/login" replace />;

//   if (role === "admin") return children || <Outlet />;

//   if (!profileComplete) return <Navigate to="/complete-profile" replace />;

//   return children || <Outlet />;
// }







import { Navigate, Outlet } from "react-router-dom";
import { useAuthUser } from "./useAuthUser";

export default function ProfileGate({ children }) {
  const { fbUser, role, loading, profileComplete, profile } = useAuthUser();

  if (loading || (fbUser && !profile)) {
    return (
      <div className="container">
        <div className="card">Checking profile...</div>
      </div>
    );
  }

  if (!fbUser) return <Navigate to="/login" replace />;

  if (role === "admin") return children || <Outlet />;

  if (!profileComplete) return <Navigate to="/complete-profile" replace />;

  return children || <Outlet />;
}