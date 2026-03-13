// // import { Navigate } from "react-router-dom";
// // import { useAuthUser } from "./useAuthUser";

// // /**
// //  * For staff routes:
// //  * - approved staff -> OK
// //  * - pending -> /pending
// //  * - rejected -> /pending (we’ll show message there)
// //  */
// // export default function ApprovalGate({ children }) {
// //   const { role, status, loading } = useAuthUser();
// //   if (loading) return <div className="container"><div className="card">Loading...</div></div>;

// //   // admins don't need approval gate
// //   if (role === "admin") return children;

// //   if (status !== "approved") return <Navigate to="/pending" replace />;

// //   return children;
// // }












// import { Navigate, Outlet } from "react-router-dom";
// import { useAuthUser } from "./useAuthUser";

// export default function ApprovalGate({ children }) {
//   const { status, loading, role } = useAuthUser();

//   if (loading) {
//     return (
//       <div className="container">
//         <div className="card">Verifying approval status...</div>
//       </div>
//     );
//   }

//   // 1. Admins don't need to be checked by the staff approval gate
//   if (role === "admin") return children || <Outlet />;

//   // 2. If the user is approved, render the nested routes (Outlet) or children
//   if (status === "approved") {
//     return <Outlet />;
//   }

//   // 3. If they are staff but status is 'pending' or 'rejected', send to /pending
//   return <Navigate to="/pending" replace />;
// }







// import { Navigate, Outlet } from "react-router-dom";
// import { useAuthUser } from "./useAuthUser";

// export default function ApprovalGate({ children }) {
//   const { status, loading, role } = useAuthUser();

//   if (loading) {
//     return (
//       <div className="container">
//         <div className="card">Verifying approval status...</div>
//       </div>
//     );
//   }

//   if (role === "admin") return children || <Outlet />;

//   if (status !== "approved") return <Navigate to="/pending" replace />;

//   return children || <Outlet />;
// }







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