// import { Link, useNavigate } from "react-router-dom";
// import { signOut } from "firebase/auth";
// import { auth } from "../firebase/firebase";
// import { useAuthUser } from "../auth/useAuthUser";
// import "./Navbar.css";

// export default function Navbar() {
//   const { fbUser, role, status } = useAuthUser();
//   const nav = useNavigate();

//   async function onLogout() {
//     await signOut(auth);
//     nav("/login");
//   }

//   return (
//     <div className="nav">
//       <div className="nav-inner container">
//         <div className="brand">
//           <span className="dot" />
//           Staff Manager
//         </div>

//         <div className="links">
//           {!fbUser && (
//             <>
//               <Link to="/login">Login</Link>
//               <Link to="/signup">Signup</Link>
//             </>
//           )}

//           {fbUser && role === "staff" && (
//             <>
//               <Link to="/staff/today">Home</Link>
//               <Link to="/staff/my-roster">Roster</Link>
//               <Link to="/staff/my-timesheets">Timesheets</Link>
//               <button className="btn" onClick={onLogout}>Logout</button>
//             </>
//           )}

//           {fbUser && role === "admin" && (
//             <>
//               <Link to="/admin/dashboard">Dashboard</Link>
//               <Link to="/admin/approvals">Approvals</Link>
//               <Link to="/admin/roster">Roster</Link>
//               <Link to="/admin/payroll">Payroll</Link>
//               <Link to="/admin/audit">Audit</Link>
//               <Link to="/admin/store-settings">Store Settings</Link>
//               <button className="btn" onClick={onLogout}>Logout</button>
//             </>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }





// import { Link, useNavigate, useLocation } from "react-router-dom";
// import { signOut } from "firebase/auth";
// import { auth } from "../firebase/firebase";
// import { useAuthUser } from "../auth/useAuthUser";
// import "./Navbar.css";

// export default function Navbar() {
//   const { fbUser, role } = useAuthUser();
//   const nav = useNavigate();
//   const location = useLocation();

//   async function onLogout() {
//     await signOut(auth);
//     nav("/login");
//   }

//   const isActive = (path) => location.pathname === path ? "active" : "";

//   return (
//     <>
//       {/* Top Brand Bar */}
//       <nav className="top-nav">
//         <div className="brand">
//           <span className="dot" />
//           <span>Staff Manager</span>
//         </div>
//         {fbUser && (
//           <button className="logout-icon-btn" onClick={onLogout} aria-label="Logout">
//             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
//           </button>
//         )}
//       </nav>

//       {/* Bottom Tab Bar (Staff Only) */}
//       {fbUser && role === "staff" && (
//         <nav className="bottom-tab-bar">
//           <Link to="/staff/today" className={`tab-item ${isActive("/staff/today")}`}>
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
//             <span>Home</span>
//           </Link>
//           <Link to="/staff/my-roster" className={`tab-item ${isActive("/staff/my-roster")}`}>
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
//             <span>Roster</span>
//           </Link>
//           <Link to="/staff/my-timesheets" className={`tab-item ${isActive("/staff/my-timesheets")}`}>
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
//             <span>Hours</span>
//           </Link>
//         </nav>
//       )}

//       {/* Admin Side-Scroll Menu (Optional Top Style) */}
//       {fbUser && role === "admin" && (
//         <nav className="admin-scroll-nav">
//           <Link to="/admin/dashboard">Dashboard</Link>
//           <Link to="/admin/approvals">Approvals</Link>
//           <Link to="/admin/roster">Roster</Link>
//           <Link to="/admin/payroll">Payroll</Link>
//           <Link to="/admin/audit">Audit</Link>
//           <Link to="/admin/store-settings">Store Settings</Link>
//         </nav>
//       )}
//     </>
//   );
// }













// import { Link, useNavigate, useLocation } from "react-router-dom";
// import { signOut } from "firebase/auth";
// import { auth } from "../firebase/firebase";
// import { useAuthUser } from "../auth/useAuthUser";
// import "./Navbar.css";

// export default function Navbar() {
//   const { fbUser, role, status } = useAuthUser();
//   const nav = useNavigate();
//   const location = useLocation();

//   async function onLogout() {
//     await signOut(auth);
//     nav("/login");
//   }

//   const isActive = (path) => location.pathname === path ? "active" : "";

//   return (
//     <>
//       {/* 1. Global Brand Header */}
//       <nav className="top-nav">
//         <div className="brand" onClick={() => nav("/")}>
//           <span className="dot" />
//           <span>MITHO MITHO || MVS</span>
//           {role === "admin" && <span className="admin-tag">ADMIN</span>}
//         </div>
//         {fbUser && (
//           <div className="top-nav-actions">
//              <span className="user-email">{fbUser.email?.split('@')[0]}</span>
//              <button className="logout-icon-btn" onClick={onLogout} title="Logout">
//               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
//             </button>
//           </div>
//         )}
//       </nav>

//       {/* 2. Admin Toolbar (Sub-header style) */}
//       {fbUser && role === "admin" && (
//         <nav className="admin-toolbar">
//           <div className="admin-scroll-container">
//             <Link to="/admin/dashboard" className={`admin-link ${isActive("/admin/dashboard")}`}>Dashboard</Link>
//             <Link to="/admin/approvals" className={`admin-link ${isActive("/admin/approvals")}`}>Approvals</Link>
//             <Link to="/admin/roster" className={`admin-link ${isActive("/admin/roster")}`}>Roster</Link>
//             <Link to="/admin/payroll" className={`admin-link ${isActive("/admin/payroll")}`}>Payroll</Link>
//             <Link to="/admin/admin-payroll" className={`admin-link ${isActive("/admin/admin-payroll")}`}>Pay Staff</Link>
//             <Link to="/admin/edit-timesheets" className={`admin-link ${isActive("/admin/edit-timesheets")}`}>Timesheets</Link>
//             <Link to="/admin/audit" className={`admin-link ${isActive("/admin/audit")}`}>Audit</Link>
//             <Link to="/admin/store-settings" className={`admin-link ${isActive("/admin/store-settings")}`}>Settings</Link>
//           </div>
//         </nav>
//       )}

//       {/* 3. Staff Tab Bar (Fixed Bottom) */}
//       {fbUser && role === "staff" && status === "approved" && (
//         <nav className="bottom-tab-bar">
//           <Link to="/staff/today" className={`tab-item ${isActive("/staff/today")}`}>
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
//             <span>Today</span>
//           </Link>
//           <Link to="/staff/my-roster" className={`tab-item ${isActive("/staff/my-roster")}`}>
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
//             <span>Roster</span>
//           </Link>
//           <Link to="/staff/my-timesheets" className={`tab-item ${isActive("/staff/my-timesheets")}`}>
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
//             <span>History</span>
//           </Link>
//         </nav>
//       )}
//     </>
//   );
// }












import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useAuthUser } from "../auth/useAuthUser";
import MyProfileModal from "./MyProfileModal.jsx";
import "./Navbar.css";

export default function Navbar() {
  const { fbUser, profile, role, status } = useAuthUser();
  const [showProfile, setShowProfile] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? "active" : "";

  return (
    <>
      <nav className="top-nav">
        <div className="brand" onClick={() => nav("/")}>
          <span className="dot" />
          <span>MITHO MITHO || MVS</span>
          {role === "admin" && <span className="admin-tag">ADMIN</span>}
        </div>

        {fbUser && (
          <div className="top-nav-actions">
             {/* Use userData if exists, fallback to fbUser display name */}
             <span 
               className="user-email clickable-user" 
               onClick={() => setShowProfile(true)}
             >
               {profile?.firstName || fbUser.displayName || "My Profile"}
             </span>
             
             <button className="logout-icon-btn" onClick={() => signOut(auth)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        )}
      </nav>

      {/* Admin Toolbar with Staff on Right */}
      {fbUser && role === "admin" && (
        <nav className="admin-toolbar">
          <div className="admin-scroll-container">
            <div className="admin-nav-group">
                <Link to="/admin/dashboard" className={`admin-link ${isActive("/admin/dashboard")}`}>Dashboard</Link>
                <Link to="/admin/approvals" className={`admin-link ${isActive("/admin/approvals")}`}>Approvals</Link>
                <Link to="/admin/roster" className={`admin-link ${isActive("/admin/roster")}`}>Roster</Link>
                <Link to="/admin/payroll" className={`admin-link ${isActive("/admin/payroll")}`}>Payroll</Link>
                <Link to="/admin/admin-payroll" className={`admin-link ${isActive("/admin/admin-payroll")}`}>Pay Staff</Link>
                <Link to="/admin/edit-timesheets" className={`admin-link ${isActive("/admin/edit-timesheets")}`}>Timesheets</Link>
                <Link to="/admin/audit" className={`admin-link ${isActive("/admin/audit")}`}>Audit</Link>
                <Link to="/admin/store-settings" className={`admin-link ${isActive("/admin/store-settings")}`}>Settings</Link>
            </div>
            <Link to="/admin/staff" className={`admin-link staff-right ${isActive("/admin/staff")}`}>Staff List</Link>
          </div>
        </nav>
      )}

    
       {fbUser && role === "staff" && (
        <nav className="bottom-tab-bar">
          <Link to="/staff/today" className={`tab-item ${isActive("/staff/today")}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Home</span>
          </Link>
          <Link to="/staff/my-roster" className={`tab-item ${isActive("/staff/my-roster")}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>Roster</span>
          </Link>
          <Link to="/staff/my-timesheets" className={`tab-item ${isActive("/staff/my-timesheets")}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <span>Hours</span>
          </Link>
        </nav>
      )}

      {/* Profile Modal - Only show if we have some data to work with */}
      {showProfile && fbUser && (
      <MyProfileModal 
        profile={profile} // Change 'user' to 'profile'
        uid={fbUser.uid} 
        onClose={() => setShowProfile(false)} 
      />
    )}
    </>
  );
}