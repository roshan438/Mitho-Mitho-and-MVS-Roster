// import { Navigate } from "react-router-dom";
// import { useAuthUser } from "../auth/useAuthUser";

// export default function HomeRedirect() {
//   const { fbUser, role, status, loading } = useAuthUser();

//   // IMPORTANT: Wait for Firebase to finish loading the profile
//   if (loading) return <div className="container">Loading...</div>;

//   if (!fbUser) return <Navigate to="/login" replace />;
//   console.log('login google failed'); 

//   if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
//   console.log('admin login success'); 

//   if (role === "staff" && status === "approved") return <Navigate to="/staff/today" replace />;
//   console.log('staff login success'); 

//   // Default for staff who are pending or rejected
//   return <Navigate to="/pending" replace />;
// }









import { Navigate } from "react-router-dom";
import { useAuthUser } from "../auth/useAuthUser";

export default function HomeRedirect() {
  const { fbUser, role, status, loading } = useAuthUser();

  // 1. Wait for Firebase Auth AND Firestore Profile to resolve
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

  // 2. If no user, go to login
  if (!fbUser) {
    console.log("No active session, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // 3. Safety: If we have a user but Firestore profile isn't ready yet
  if (!role) {
     return <div className="container">Finalizing session...</div>;
  }

  // 4. Role-based Routing
  if (role === "admin") {
    console.log("Admin verified, entering dashboard");
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (role === "staff" && status === "approved") {
    console.log("Staff approved, entering workspace");
    return <Navigate to="/staff/today" replace />;
  }

  // 5. Default for Pending or Rejected
  console.log("Status check: ", status || "pending");
  return <Navigate to="/pending" replace />;
}