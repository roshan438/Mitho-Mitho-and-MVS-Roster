




















import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useAuthUser } from "../auth/useAuthUser";
import { useNotificationsCenter } from "../notifications/NotificationsProvider.jsx";
import MyProfileModal from "./MyProfileModal.jsx";
import "./Navbar.css";

export default function Navbar() {
  const { fbUser, profile, role } = useAuthUser();
  const { badgeCount } = useNotificationsCenter();
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  const isActive = (path) => (location.pathname === path ? "active" : "");
  const notificationsPath = role === "admin" ? "/admin/notifications" : "/staff/notifications";

  const closeMenu = () => setMenuOpen(false);

  const adminGroups = [
    {
      title: "Operations",
      links: [
        { to: "/admin/dashboard", label: "Dashboard" },
        { to: "/admin/analytics", label: "Analytics" },
        { to: "/admin/approvals", label: "Approvals" },
        { to: "/admin/roster", label: "Roster" },
        { to: "/admin/stock-manager", label: "Stock" },
        { to: "/admin/audit", label: "Audit" },
      ],
    },
    {
      title: "People",
      links: [
        { to: "/admin/staff", label: "Staff List" },
        { to: "/admin/leave", label: "Leave" },
        { to: "/admin/shift-requests", label: "Shift Requests" },
        { to: "/admin/edit-timesheets", label: "Timesheets" },
      ],
    },
    {
      title: "Finance",
      links: [
        { to: "/admin/payroll", label: "Payroll" },
        { to: "/admin/admin-payroll", label: "Pay Staff" },
        { to: "/admin/store-settings", label: "Settings" },
      ],
    },
  ];

  const staffDesktopLinks = [
    { to: "/staff/today", label: "Today" },
    { to: "/staff/my-roster", label: "Roster" },
    { to: "/staff/my-timesheets", label: "Timesheets" },
    { to: "/staff/leave", label: "Leave" },
    { to: "/staff/notifications", label: "Alerts" },
    ...(profile?.department === "kitchen" || role === "manager"
      ? [{ to: "/staff/kitchen-stock-take", label: "Kitchen Stock" }]
      : []),
    { to: "/staff/availability", label: "Availability" },
  ];

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
            {(role === "staff" || role === "manager" || role === "admin") && (
              <button
                className="nav-icon-btn notification-trigger"
                onClick={() => nav(notificationsPath)}
                type="button"
                aria-label="Open notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 01-3.46 0"></path>
                </svg>
                {badgeCount > 0 && <span className="notification-badge">{badgeCount > 9 ? "9+" : badgeCount}</span>}
              </button>
            )}

            <button
              className="user-email clickable-user"
              onClick={() => setShowProfile(true)}
              type="button"
            >
              {profile?.firstName || fbUser.displayName || "My Profile"}
            </button>

            <button
              className="hamburger-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              type="button"
            >
              ☰
            </button>

            <button
              className="logout-icon-btn hamburger"
              onClick={() => signOut(auth)}
              type="button"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        )}
      </nav>

      {fbUser && role === "admin" && (
        <nav className="admin-toolbar desktop-subnav">
          <div className="admin-scroll-container compact">
            {adminGroups.map((group) => (
              <section key={group.title} className="admin-nav-section compact">
                <button type="button" className="admin-group-trigger">
                  {group.title}
                </button>
                <div className="admin-nav-group dropdown">
                  {group.links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`admin-link ${isActive(link.to)}`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </nav>
      )}

      {fbUser && (role === "staff" || role === "manager") && (
        <nav className="staff-desktop-nav desktop-subnav">
          <div className="staff-desktop-nav-inner">
            {staffDesktopLinks.map((link) => (
              <Link key={link.to} to={link.to} className={`staff-desktop-link ${isActive(link.to)}`}>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {fbUser && (role === "staff" || role === "manager") && (
        <nav className="bottom-tab-bar">
          <Link to="/staff/today" className={`tab-item ${isActive("/staff/today")}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Home</span>
          </Link>

          <Link to="/staff/my-roster" className={`tab-item ${isActive("/staff/my-roster")}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Roster</span>
          </Link>

          <Link
            to="/staff/my-timesheets"
            className={`tab-item ${isActive("/staff/my-timesheets")}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span>Hours</span>
          </Link>
          <Link to="/staff/leave" className={`tab-item ${isActive("/staff/leave")}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z"></path>
              <path d="M9 15l2 2 4-4"></path>
            </svg>
            <span>Leave</span>
          </Link>

          <Link
            to="/staff/notifications"
            className={`tab-item notification-tab ${isActive("/staff/notifications")}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 01-3.46 0"></path>
            </svg>
            <span>Alerts</span>
            {badgeCount > 0 && <em className="tab-badge">{badgeCount > 9 ? "9+" : badgeCount}</em>}
          </Link>
        </nav>
      )}

      {menuOpen && (
        <div className="side-menu-overlay" onClick={closeMenu}>
          <div className="side-menu" onClick={(e) => e.stopPropagation()}>
            <div className="side-menu-header">
              <h3>Menu</h3>
              <button className="close-menu-btn" onClick={closeMenu} type="button">
                ✕
              </button>
            </div>

            <div className="side-menu-links">
              {(role === "staff" || role === "manager") && (
                <>
                  <div className="menu-group">
                    <div className="menu-group-title">Work</div>
                    <Link to="/staff/today" onClick={closeMenu}>
                      Home
                    </Link>
                    <Link to="/staff/my-roster" onClick={closeMenu}>
                      My Roster
                    </Link>
                    <Link to="/staff/my-timesheets" onClick={closeMenu}>
                      My Timesheets
                    </Link>
                    <Link to="/staff/leave" onClick={closeMenu}>
                      Leave Requests
                    </Link>
                    <Link to="/staff/notifications" onClick={closeMenu}>
                      Notifications
                    </Link>
                    {(profile?.department === "kitchen" || role === "manager") && (
                      <Link to="/staff/kitchen-stock-take" onClick={closeMenu}>
                        Kitchen Stock Take
                      </Link>
                    )}
                    <Link to="/staff/availability" onClick={closeMenu}>
                      Edit Availability
                    </Link>
                  </div>
                  <button
                    className="logout-icon-btn side"
                    onClick={() => signOut(auth)}
                    type="button"
                  >
                    Logout
                  </button>
                </>
              )}

              {role === "admin" && (
                <>
                  <div className="menu-group">
                    <div className="menu-group-title">Updates</div>
                    <Link to="/admin/notifications" onClick={closeMenu}>
                      Notifications
                    </Link>
                  </div>
                  {adminGroups.map((group) => (
                    <div key={group.title} className="menu-group">
                      <div className="menu-group-title">{group.title}</div>
                      {group.links.map((link) => (
                        <Link key={link.to} to={link.to} onClick={closeMenu}>
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                  <button
                    className="logout-icon-btn side"
                    onClick={() => signOut(auth)}
                    type="button"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showProfile && fbUser && (
        <MyProfileModal
          profile={profile}
          uid={fbUser.uid}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}
