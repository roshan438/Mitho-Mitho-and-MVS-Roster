



















import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import AuthGate from "../auth/AuthGate.jsx";
import RoleGate from "../auth/RoleGate.jsx";
import ApprovalGate from "../auth/ApprovalGate.jsx";
import ProfileGate from "../auth/ProfileGate.jsx";
import PublicOnlyGate from "../auth/PublicOnlyGate.jsx";
import AvailabilityGate from "../auth/AvailabilityGate.jsx";
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
import StaffAvailability from "../pages/staff/StaffAvailability.jsx";
import LeaveRequests from "../pages/staff/LeaveRequests.jsx";
import KitchenQuickStockTake from "../pages/staff/KitchenQuickStockTake.jsx";
import NotificationsCenter from "../pages/staff/NotificationsCenter.jsx";

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
import LeaveRequestsAdmin from "../pages/admin/LeaveRequestsAdmin.jsx";
import ShiftRequestsAdmin from "../pages/admin/ShiftRequestsAdmin.jsx";

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
              <RoleGate allow={["staff", "manager"]}>
                <ProfileGate>
                  <ApprovalGate />
                </ProfileGate>
              </RoleGate>
            </AuthGate>
          }
        >
          <Route path="availability/setup" element={<StaffAvailability />} />

          <Route element={<AvailabilityGate />}>
            <Route path="today" element={<StaffToday />} />
            <Route path="my-roster" element={<MyRoster />} />
            <Route path="my-timesheets" element={<MyTimesheets />} />
            <Route path="availability" element={<StaffAvailability />} />
            <Route path="leave" element={<LeaveRequests />} />
            <Route path="notifications" element={<NotificationsCenter />} />
            <Route path="kitchen-stock-take" element={<KitchenQuickStockTake />} />
            <Route index element={<Navigate to="today" replace />} />
          </Route>
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
          <Route path="leave" element={<LeaveRequestsAdmin />} />
          <Route path="shift-requests" element={<ShiftRequestsAdmin />} />
          <Route path="notifications" element={<NotificationsCenter />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
