// // import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// // import AuthGate from "../auth/AuthGate.jsx";
// // import RoleGate from "../auth/RoleGate.jsx";
// // import ApprovalGate from "../auth/ApprovalGate.jsx";

// // import Navbar from "../components/Navbar.jsx";

// // import Login from "../pages/public/Login.jsx";
// // import Signup from "../pages/public/Signup.jsx";
// // import Pending from "../pages/public/Pending.jsx";

// // import StaffToday from "../pages/staff/StaffToday.jsx";
// // import MyRoster from "../pages/staff/MyRoster.jsx";
// // import MyTimesheets from "../pages/staff/MyTimesheets.jsx";

// // import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
// // import Approvals from "../pages/admin/Approvals.jsx";
// // import RosterManager from "../pages/admin/RosterManager.jsx";
// // import Payroll from "../pages/admin/Payroll.jsx";
// // import Audit from "../pages/admin/Audit.jsx";
// // import StoreSettings from "../pages/admin/StoreSettings.jsx"

// // export default function Router() {
// //   return (
// //     <BrowserRouter>
// //       <Navbar />
// //       <Routes>
// //         <Route path="/" element={<HomeRedirect />} />

// //         <Route path="/login" element={<Login />} />
// //         <Route path="/signup" element={<Signup />} />
// //         <Route
// //           path="/pending"
// //           element={
// //             <AuthGate>
// //               <Pending />
// //             </AuthGate>
// //           }
// //         />

// //         {/* STAFF */}
// //         <Route
// //           path="/staff/today"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["staff"]}>
// //                 <ApprovalGate>
// //                   <StaffToday />
// //                 </ApprovalGate>
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />
// //         <Route
// //           path="/staff/my-roster"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["staff"]}>
// //                 <ApprovalGate>
// //                   <MyRoster />
// //                 </ApprovalGate>
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />
// //         <Route
// //           path="/staff/my-timesheets"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["staff"]}>
// //                 <ApprovalGate>
// //                   <MyTimesheets />
// //                 </ApprovalGate>
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />

// //         {/* ADMIN */}
// //         <Route
// //           path="/admin/dashboard"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["admin"]}>
// //                 <AdminDashboard />
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />
// //         <Route
// //           path="/admin/approvals"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["admin"]}>
// //                 <Approvals />
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />
// //         <Route 
// //           path="/admin/store-settings" 
// //           element={
// //             <StoreSettings />
// //           }
// //         />
// //         <Route
// //           path="/admin/roster"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["admin"]}>
// //                 <RosterManager />
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />
// //         <Route
// //           path="/admin/payroll"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["admin"]}>
// //                 <Payroll />
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />
// //         <Route
// //           path="/admin/audit"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["admin"]}>
// //                 <Audit />
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         />

// //         <Route path="*" element={<Navigate to="/" replace />} />
// //       </Routes>
// //     </BrowserRouter>
// //   );
// // }

// // function HomeRedirect() {
// //   // simple landing: send user to login; after login, navbar will guide them
// //   return <Navigate to="/login" replace />;
// // }









// // import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// // import { useAuthUser } from "../auth/useAuthUser";
// // import AuthGate from "../auth/AuthGate.jsx";
// // import RoleGate from "../auth/RoleGate.jsx";
// // import ApprovalGate from "../auth/ApprovalGate.jsx";

// // import Navbar from "../components/Navbar.jsx";

// // // Pages
// // import Login from "../pages/public/Login.jsx";
// // import Signup from "../pages/public/Signup.jsx";
// // import Pending from "../pages/public/Pending.jsx";
// // import StaffToday from "../pages/staff/StaffToday.jsx";
// // import MyRoster from "../pages/staff/MyRoster.jsx";
// // import MyTimesheets from "../pages/staff/MyTimesheets.jsx";
// // import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
// // import Approvals from "../pages/admin/Approvals.jsx";
// // import RosterManager from "../pages/admin/RosterManager.jsx";
// // import Payroll from "../pages/admin/Payroll.jsx";
// // import Audit from "../pages/admin/Audit.jsx";
// // import StoreSettings from "../pages/admin/StoreSettings.jsx";

// // export default function Router() {
// //   return (
// //     <BrowserRouter>
// //       <Navbar />
// //       <Routes>
// //         {/* Smart Home Redirect */}
// //         <Route path="/" element={<HomeRedirect />} />

// //         {/* Public Routes */}
// //         <Route path="/login" element={<Login />} />
// //         <Route path="/signup" element={<Signup />} />
        
// //         {/* Pending Route: Auth required, but NO ApprovalGate to prevent loops */}
// //         <Route
// //           path="/pending"
// //           element={
// //             <AuthGate>
// //               <Pending />
// //             </AuthGate>
// //           }
// //         />

// //         {/* STAFF NESTED ROUTES: Protected by Auth, Role, AND Approval */}
// //         <Route
// //           path="/staff"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["staff"]}>
// //                 <ApprovalGate />
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         >
// //           <Route path="today" element={<StaffToday />} />
// //           <Route path="my-roster" element={<MyRoster />} />
// //           <Route path="my-timesheets" element={<MyTimesheets />} />
// //           <Route index element={<Navigate to="today" replace />} />
// //         </Route>

// //         {/* ADMIN NESTED ROUTES: Protected by Auth and Role (Admin bypasses ApprovalGate) */}
// //         <Route
// //           path="/admin"
// //           element={
// //             <AuthGate>
// //               <RoleGate allow={["admin"]}>
// //                 <AdminRoutesWrapper />
// //               </RoleGate>
// //             </AuthGate>
// //           }
// //         >
// //           <Route path="dashboard" element={<AdminDashboard />} />
// //           <Route path="approvals" element={<Approvals />} />
// //           <Route path="store-settings" element={<StoreSettings />} />
// //           <Route path="roster" element={<RosterManager />} />
// //           <Route path="payroll" element={<Payroll />} />
// //           <Route path="audit" element={<Audit />} />
// //           <Route index element={<Navigate to="dashboard" replace />} />
// //         </Route>

// //         {/* 404 Catch-all */}
// //         <Route path="*" element={<Navigate to="/" replace />} />
// //       </Routes>
// //     </BrowserRouter>
// //   );
// // }

// // /**
// //  * Acts as a traffic controller for the root URL "/"
// //  */
// // function HomeRedirect() {
// //   const { fbUser, role, status, loading } = useAuthUser();

// //   if (loading) return <div className="container">Loading...</div>;

// //   if (!fbUser) return <Navigate to="/login" replace />;

// //   if (role === "admin") return <Navigate to="/admin/dashboard" replace />;

// //   if (status === "approved") return <Navigate to="/staff/today" replace />;

// //   // If logged in as staff but not approved or rejected
// //   return <Navigate to="/pending" replace />;
// // }

// // /**
// //  * Simple wrapper for Admin nesting
// //  */
// // import { Outlet } from "react-router-dom";
// // function AdminRoutesWrapper() {
// //   return <Outlet />;
// // }














// import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
// import { useAuthUser } from "../auth/useAuthUser";
// import AuthGate from "../auth/AuthGate.jsx";
// import RoleGate from "../auth/RoleGate.jsx";
// import ApprovalGate from "../auth/ApprovalGate.jsx";
// import HomeRedirect from "./HomeRedirect.jsx"; // Move logic to own file if preferred

// import AdminPayroll from "../pages/admin/AdminPayroll.jsx";
// import PayrollHistory from "../pages/admin/PayrollHistory.jsx"

// import Navbar from "../components/Navbar.jsx";
// import Login from "../pages/public/Login.jsx";
// import Signup from "../pages/public/Signup.jsx";
// import Pending from "../pages/public/Pending.jsx";
// import StaffToday from "../pages/staff/StaffToday.jsx";
// import MyRoster from "../pages/staff/MyRoster.jsx";
// import MyTimesheets from "../pages/staff/MyTimesheets.jsx";
// import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
// import Approvals from "../pages/admin/Approvals.jsx";
// import RosterManager from "../pages/admin/RosterManager.jsx";
// import Payroll from "../pages/admin/Payroll.jsx";
// import Audit from "../pages/admin/Audit.jsx";
// import StoreSettings from "../pages/admin/StoreSettings.jsx";
// import ForgotPassword from "../pages/public/Forgot.jsx"
// import AdminEditTimesheets from "../pages/admin/AdminEditTimesheets.jsx";

// export default function Router() {
//   return (
//     <BrowserRouter>
//       <Navbar />
//       <Routes>
//         {/* LANDING */}
//         <Route path="/" element={<HomeRedirect />} />
//         <Route path="/login" element={<Login />} />
//         <Route path="/signup" element={<Signup />} />
//         <Route path="/forgot" element={<ForgotPassword />}/>
        
//         <Route path="/pending" element={
//           <AuthGate>
//             <Pending />
//           </AuthGate>
//         } />

//         {/* STAFF NESTED */}
//         <Route path="/staff" element={
//           <AuthGate>
//             <RoleGate allow={["staff"]}>
//               <ApprovalGate /> 
//             </RoleGate>
//           </AuthGate>
//         }>
//           <Route path="today" element={<StaffToday />} />
//           <Route path="my-roster" element={<MyRoster />} />
//           <Route path="my-timesheets" element={<MyTimesheets />} />
//           <Route index element={<Navigate to="today" replace />} />
//         </Route>

//         {/* ADMIN NESTED */}
//         <Route path="/admin" element={
//           <AuthGate>
//             <RoleGate allow={["admin"]}>
//               <Outlet /> 
//             </RoleGate>
//           </AuthGate>
//         }>
//           <Route path="dashboard" element={<AdminDashboard />} />
//           <Route path="store-settings" element={<StoreSettings />} />
//           <Route path="approvals" element={<Approvals />} />
//           <Route path="roster" element={<RosterManager />} />
//           <Route path="payroll" element={<Payroll />} />
//           <Route path="audit" element={<Audit />} />
//           <Route path="edit-timesheets" element={<AdminEditTimesheets />} />
//           <Route path="admin-payroll" element={<AdminPayroll />} />
//           <Route path="payroll/:weekStart/:uid" element={<PayrollHistory />} />
//           <Route index element={<Navigate to="dashboard" replace />} />
//         </Route>

//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }







// import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
// import AuthGate from "../auth/AuthGate.jsx";
// import RoleGate from "../auth/RoleGate.jsx";
// import ApprovalGate from "../auth/ApprovalGate.jsx";
// import ProfileGate from "../auth/ProfileGate.jsx";
// import HomeRedirect from "./HomeRedirect.jsx";

// import Navbar from "../components/Navbar.jsx";

// import Login from "../pages/public/Login.jsx";
// import Signup from "../pages/public/Signup.jsx";
// import Pending from "../pages/public/Pending.jsx";
// import ForgotPassword from "../pages/public/Forgot.jsx";
// import CompleteProfile from "../pages/public/CompleteProfile.jsx";

// import StaffToday from "../pages/staff/StaffToday.jsx";
// import MyRoster from "../pages/staff/MyRoster.jsx";
// import MyTimesheets from "../pages/staff/MyTimesheets.jsx";

// import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
// import Approvals from "../pages/admin/Approvals.jsx";
// import RosterManager from "../pages/admin/RosterManager.jsx";
// import Payroll from "../pages/admin/Payroll.jsx";
// import Audit from "../pages/admin/Audit.jsx";
// import StoreSettings from "../pages/admin/StoreSettings.jsx";
// import AdminEditTimesheets from "../pages/admin/AdminEditTimesheets.jsx";
// import AdminPayroll from "../pages/admin/AdminPayroll.jsx";
// import PayrollHistory from "../pages/admin/PayrollHistory.jsx";

// export default function Router() {
//   return (
//     <BrowserRouter>
//       <Navbar />
//       <Routes>
//         <Route path="/" element={<HomeRedirect />} />
//         <Route path="/login" element={<Login />} />
//         <Route path="/signup" element={<Signup />} />
//         <Route path="/forgot" element={<ForgotPassword />} />

//         <Route
//           path="/pending"
//           element={
//             <AuthGate>
//               <Pending />
//             </AuthGate>
//           }
//         />

//         <Route
//           path="/complete-profile"
//           element={
//             <AuthGate>
//               <CompleteProfile />
//             </AuthGate>
//           }
//         />

//         <Route
//           path="/staff"
//           element={
//             <AuthGate>
//               <RoleGate allow={["staff"]}>
//                 <ProfileGate>
//                   <ApprovalGate />
//                 </ProfileGate>
//               </RoleGate>
//             </AuthGate>
//           }
//         >
//           <Route path="today" element={<StaffToday />} />
//           <Route path="my-roster" element={<MyRoster />} />
//           <Route path="my-timesheets" element={<MyTimesheets />} />
//           <Route index element={<Navigate to="today" replace />} />
//         </Route>

//         <Route
//           path="/admin"
//           element={
//             <AuthGate>
//               <RoleGate allow={["admin"]}>
//                 <Outlet />
//               </RoleGate>
//             </AuthGate>
//           }
//         >
//           <Route path="dashboard" element={<AdminDashboard />} />
//           <Route path="store-settings" element={<StoreSettings />} />
//           <Route path="approvals" element={<Approvals />} />
//           <Route path="roster" element={<RosterManager />} />
//           <Route path="payroll" element={<Payroll />} />
//           <Route path="audit" element={<Audit />} />
//           <Route path="edit-timesheets" element={<AdminEditTimesheets />} />
//           <Route path="admin-payroll" element={<AdminPayroll />} />
//           <Route path="payroll/:weekStart/:uid" element={<PayrollHistory />} />
//           <Route index element={<Navigate to="dashboard" replace />} />
//         </Route>

//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }











// import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
// import AuthGate from "../auth/AuthGate.jsx";
// import RoleGate from "../auth/RoleGate.jsx";
// import ApprovalGate from "../auth/ApprovalGate.jsx";
// import ProfileGate from "../auth/ProfileGate.jsx";
// import HomeRedirect from "./HomeRedirect.jsx";

// import Navbar from "../components/Navbar.jsx";

// import Login from "../pages/public/Login.jsx";
// import Signup from "../pages/public/Signup.jsx";
// import Pending from "../pages/public/Pending.jsx";
// import ForgotPassword from "../pages/public/Forgot.jsx";
// import CompleteProfile from "../pages/public/CompleteProfile.jsx";

// import StaffToday from "../pages/staff/StaffToday.jsx";
// import MyRoster from "../pages/staff/MyRoster.jsx";
// import MyTimesheets from "../pages/staff/MyTimesheets.jsx";

// import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
// import Approvals from "../pages/admin/Approvals.jsx";
// import RosterManager from "../pages/admin/RosterManager.jsx";
// import Payroll from "../pages/admin/Payroll.jsx";
// import Audit from "../pages/admin/Audit.jsx";
// import StoreSettings from "../pages/admin/StoreSettings.jsx";
// import AdminEditTimesheets from "../pages/admin/AdminEditTimesheets.jsx";
// import AdminPayroll from "../pages/admin/AdminPayroll.jsx";
// import PayrollHistory from "../pages/admin/PayrollHistory.jsx";
// // NEW IMPORT
// import AdminStaffList from "../pages/admin/AdminStaffList.jsx"; 
// import StockManager from "../pages/admin/StockManager.jsx";

// export default function Router() {
//   return (
//     <BrowserRouter>
//       <Navbar />
//       <Routes>
//         <Route path="/" element={<HomeRedirect />} />
//         <Route path="/login" element={<Login />} />
//         <Route path="/signup" element={<Signup />} />
//         <Route path="/forgot" element={<ForgotPassword />} />

//         <Route
//           path="/pending"
//           element={
//             <AuthGate>
//               <Pending />
//             </AuthGate>
//           }
//         />

//         <Route
//           path="/complete-profile"
//           element={
//             <AuthGate>
//               <CompleteProfile />
//             </AuthGate>
//           }
//         />

//         <Route
//           path="/staff"
//           element={
//             <AuthGate>
//               <RoleGate allow={["staff"]}>
//                 <ProfileGate>
//                   <ApprovalGate />
//                 </ProfileGate>
//               </RoleGate>
//             </AuthGate>
//           }
//         >
//           <Route path="today" element={<StaffToday />} />
//           <Route path="my-roster" element={<MyRoster />} />
//           <Route path="my-timesheets" element={<MyTimesheets />} />
//           <Route index element={<Navigate to="today" replace />} />
//         </Route>

//         <Route
//           path="/admin"
//           element={
//             <AuthGate>
//               <RoleGate allow={["admin"]}>
//                 <Outlet />
//               </RoleGate>
//             </AuthGate>
//           }
//         >
//           <Route path="dashboard" element={<AdminDashboard />} />
//           <Route path="store-settings" element={<StoreSettings />} />
//           <Route path="approvals" element={<Approvals />} />
//           <Route path="staff" element={<AdminStaffList />} /> {/* NEW ROUTE */}
//           <Route path="roster" element={<RosterManager />} />
//           <Route path="payroll" element={<Payroll />} />
//           <Route path="audit" element={<Audit />} />
//           <Route path="edit-timesheets" element={<AdminEditTimesheets />} />
//           <Route path="admin-payroll" element={<AdminPayroll />} />
//           <Route path="payroll/:weekStart/:uid" element={<PayrollHistory />} />
//           <Route path="stock-manager" element={<StockManager />} />
//           <Route index element={<Navigate to="dashboard" replace />} />
          
//         </Route>

//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }









import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import AuthGate from "../auth/AuthGate.jsx";
import RoleGate from "../auth/RoleGate.jsx";
import ApprovalGate from "../auth/ApprovalGate.jsx";
import ProfileGate from "../auth/ProfileGate.jsx";
import PublicOnlyGate from "../auth/PublicOnlyGate.jsx";
import HomeRedirect from "./HomeRedirect.jsx";

import Navbar from "../components/Navbar.jsx";

import Login from "../pages/public/Login.jsx";
import Signup from "../pages/public/Signup.jsx";
import Pending from "../pages/public/Pending.jsx";
import ForgotPassword from "../pages/public/Forgot.jsx";
import CompleteProfile from "../pages/public/CompleteProfile.jsx";

import StaffToday from "../pages/staff/StaffToday.jsx";
import MyRoster from "../pages/staff/MyRoster.jsx";
import MyTimesheets from "../pages/staff/MyTimesheets.jsx";

import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
import Approvals from "../pages/admin/Approvals.jsx";
import RosterManager from "../pages/admin/RosterManager.jsx";
import Payroll from "../pages/admin/Payroll.jsx";
import Audit from "../pages/admin/Audit.jsx";
import StoreSettings from "../pages/admin/StoreSettings.jsx";
import AdminEditTimesheets from "../pages/admin/AdminEditTimesheets.jsx";
import AdminPayroll from "../pages/admin/AdminPayroll.jsx";
import PayrollHistory from "../pages/admin/PayrollHistory.jsx";
import AdminStaffList from "../pages/admin/AdminStaffList.jsx";
import StockManager from "../pages/admin/StockManager.jsx";

export default function Router() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/login"
          element={
            <PublicOnlyGate>
              <Login />
            </PublicOnlyGate>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicOnlyGate>
              <Signup />
            </PublicOnlyGate>
          }
        />

        <Route
          path="/forgot"
          element={
            <PublicOnlyGate>
              <ForgotPassword />
            </PublicOnlyGate>
          }
        />

        <Route
          path="/pending"
          element={
            <AuthGate>
              <Pending />
            </AuthGate>
          }
        />

        <Route
          path="/complete-profile"
          element={
            <AuthGate>
              <CompleteProfile />
            </AuthGate>
          }
        />

        <Route
          path="/staff"
          element={
            <AuthGate>
              <RoleGate allow={["staff"]}>
                <ProfileGate>
                  <ApprovalGate />
                </ProfileGate>
              </RoleGate>
            </AuthGate>
          }
        >
          <Route path="today" element={<StaffToday />} />
          <Route path="my-roster" element={<MyRoster />} />
          <Route path="my-timesheets" element={<MyTimesheets />} />
          <Route index element={<Navigate to="today" replace />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AuthGate>
              <RoleGate allow={["admin"]}>
                <Outlet />
              </RoleGate>
            </AuthGate>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="store-settings" element={<StoreSettings />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="staff" element={<AdminStaffList />} />
          <Route path="roster" element={<RosterManager />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="audit" element={<Audit />} />
          <Route path="edit-timesheets" element={<AdminEditTimesheets />} />
          <Route path="admin-payroll" element={<AdminPayroll />} />
          <Route path="payroll/:weekStart/:uid" element={<PayrollHistory />} />
          <Route path="stock-manager" element={<StockManager />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}