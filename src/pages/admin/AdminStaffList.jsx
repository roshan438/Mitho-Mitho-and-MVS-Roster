














import React, { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import "./AdminStaffList.css";

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function labelize(day) {
  return day.charAt(0).toUpperCase() + day.slice(1, 3);
}

export default function AdminStaffList() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const { showToast } = useToast();
  const today = toYMD(new Date());

  const fetchStaffAndStatus = useCallback(async () => {
    setLoading(true);
    try {
      const staffQuery = query(
        collection(db, "users"),
        where("role", "in", ["staff", "manager"])
      );
      const staffSnap = await getDocs(staffQuery);

      const staffList = staffSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          availabilitySubmitted: !!data.availabilitySubmitted,
          availability: data.availability || null,
        };
      });

      const tsQuery = query(
        collection(db, "timesheets"),
        where("date", "==", today),
        where("status", "==", "working")
      );
      const tsSnap = await getDocs(tsQuery);
      const activeUids = tsSnap.docs.map((d) => d.data().uid);

      const finalData = staffList.map((s) => ({
        ...s,
        isWorking: activeUids.includes(s.id),
      }));

      const sorted = finalData.sort((a, b) => {
        if (a.isWorking !== b.isWorking) return a.isWorking ? -1 : 1;
        const nameA = a.firstName ?? "";
        const nameB = b.firstName ?? "";
        return nameA.localeCompare(nameB);
      });

      setStaff(sorted);
    } catch (error) {
      console.error(error);
      showToast("Failed to load staff list", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, today]);

  useEffect(() => {
    fetchStaffAndStatus();
  }, [fetchStaffAndStatus]);

  const toggleEdit = () => {
    if (!isEditing) {
      setEditData({
        hourlyRate: selectedProfile.hourlyRate || 0,
        status: selectedProfile.status || "approved",
        role: selectedProfile.role || "staff",
        department: selectedProfile.department || "shop",
      });
    }
    setIsEditing(!isEditing);
  };

  const saveChanges = async () => {
    try {
      const userRef = doc(db, "users", selectedProfile.id);

      const payload = {
        hourlyRate: Number(editData.hourlyRate),
        status: editData.status,
        role: editData.role,
        department: editData.department,
        updatedAt: new Date(),
      };

      if (payload.role === "manager" && !payload.department) {
        payload.department = "shop";
      }

      await updateDoc(userRef, payload);

      showToast("Profile updated successfully", "success");
      setIsEditing(false);
      setSelectedProfile(null);
      fetchStaffAndStatus();
    } catch (e) {
      console.error(e);
      showToast("Update failed", "error");
    }
  };

  return (
    <div className="admin-staff-container">
      <header className="staff-header">
        <div className="header-left header-staff-list">
          <h1>Team Directory</h1>
          <p>{staff.filter((s) => s.isWorking).length} active now • {staff.length} total</p>
        </div>
      </header>

      {loading ? (
        <div className="loading-spinner">Syncing staff records...</div>
      ) : (
        <div className="staff-grid">
          {staff.map((member) => (
            <div
              key={member.id}
              className={`staff-card ${member.isWorking ? "working-border" : ""}`}
              onClick={() => setSelectedProfile(member)}
            >
              <div className="staff-row-primary">
                <div className="staff-info">
                  <span className="staff-name">
                    {member.firstName} {member.lastName}
                  </span>
                  <span className="staff-email">{member.email || "No email provided"}</span>
                </div>

                <div className="staff-row-status">
                  <span className="dept-tag-micro">{member.department || "shop"}</span>
                  <span
                    className={`availability-badge ${
                      member.availabilitySubmitted ? "is-complete" : "is-missing"
                    }`}
                  >
                    {member.availabilitySubmitted ? "Avail" : "Missing"}
                  </span>
                  {member.isWorking ? (
                    <div className="working-badge">
                      <span className="pulse-dot"></span> LIVE
                    </div>
                  ) : (
                    <span className={`staff-status-pill ${member.status || "approved"}`}>
                      {member.status || "approved"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProfile && (
        <div
          className="modal-overlay"
          onClick={() => {
            setSelectedProfile(null);
            setIsEditing(false);
          }}
        >
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h2>{selectedProfile.firstName}'s Profile</h2>
                <div className="profile-meta-bar">
                  <span className="dept-tag-micro">
                    {selectedProfile.department || "shop"}
                  </span>
                  <span
                    className={`availability-badge ${
                      selectedProfile.availabilitySubmitted ? "is-complete" : "is-missing"
                    }`}
                  >
                    {selectedProfile.availabilitySubmitted ? "Avail" : "Missing"}
                  </span>
                  <span className={`badge-${selectedProfile.status}`}>
                    {selectedProfile.status}
                  </span>
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => {
                  setSelectedProfile(null);
                  setIsEditing(false);
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <section className="contact-actions-container">
                <div className="section-header compact-head">
                  <h3>Reach</h3>
                </div>

                <div className="contact-row">
                  <div className="contact-icon">P</div>
                  <div className="contact-info compact contact-inline">
                    <p>{selectedProfile.phone || "Not provided"}</p>
                  </div>
                  <div className="contact-buttons">
                    <a href={`tel:${selectedProfile.phone}`} className="mini-btn call-bg">
                      Call
                    </a>
                    <a href={`sms:${selectedProfile.phone}`} className="mini-btn sms-bg">
                      SMS
                    </a>
                  </div>
                </div>

                <div className="contact-row">
                  <div className="contact-icon">E</div>
                  <div className="contact-info compact contact-inline">
                    <p>{selectedProfile.email}</p>
                  </div>
                  <div className="contact-buttons">
                    <a
                      href={`mailto:${selectedProfile.email}`}
                      className="mini-btn email-bg"
                    >
                      Email
                    </a>
                  </div>
                </div>

                <div className="contact-row" style={{ background: "#ef44441f" }}>
                  <div className="contact-icon emergency">!</div>
                  <div className="contact-info compact">
                    <label style={{ color: "#ef4444" }}>Emergency</label>
                    <p>
                      {selectedProfile.emergencyName} (
                      {selectedProfile.emergencyRelationship})
                    </p>
                    <p className="sub-text">{selectedProfile.emergencyPhone}</p>
                  </div>
                  <div className="contact-buttons">
                    <a
                      href={`tel:${selectedProfile.emergencyPhone}`}
                      className="mini-btn emergency-bg"
                    >
                      Call
                    </a>
                  </div>
                </div>
              </section>

              <section className="availability-box">
                <div className="section-header">
                  <h3>Weekly Avail</h3>
                  <span
                    className={`availability-badge ${
                      selectedProfile.availabilitySubmitted ? "is-complete" : "is-missing"
                    }`}
                  >
                    {selectedProfile.availabilitySubmitted
                      ? "Submitted"
                      : "Not Submitted"}
                  </span>
                </div>
                <div className="availability-summary-bar">
                  <span className="availability-summary-pill">
                    {DAY_KEYS.filter((day) => selectedProfile?.availability?.[day]?.enabled).length} open
                  </span>
                  <span className="availability-summary-text">
                    Tap-free overview for the full week
                  </span>
                </div>
                <div className="availability-week-grid">
                  {DAY_KEYS.map((day) => {
                    const row = selectedProfile?.availability?.[day];
                    const enabled = !!row?.enabled;

                    return (
                      <div
                        key={day}
                        className={`availability-day-card ${enabled ? "enabled" : "disabled"}`}
                      >
                        <div className="availability-day-name">{labelize(day)}</div>
                        <div className="availability-day-time">
                          {enabled && row?.start && row?.end
                            ? `${row.start} - ${row.end}`
                            : "Unavailable"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="admin-controls-box">
                <div className="section-header">
                  <h3>Admin</h3>
                  <button className="edit-toggle-btn" onClick={toggleEdit}>
                    {isEditing ? "Discard" : "Manage Settings"}
                  </button>
                </div>

                {isEditing ? (
                  <div className="edit-form-grid">
                    <div className="input-group full-width">
                      <label>Department Assignment</label>
                      <div className="dept-toggle-group">
                        <button
                          type="button"
                          className={`dept-btn ${
                            editData.department === "kitchen" ? "active" : ""
                          }`}
                          onClick={() =>
                            setEditData({ ...editData, department: "kitchen" })
                          }
                        >
                          🍳 Kitchen
                        </button>
                        <button
                          type="button"
                          className={`dept-btn ${
                            editData.department === "shop" ? "active" : ""
                          }`}
                          onClick={() =>
                            setEditData({ ...editData, department: "shop" })
                          }
                        >
                          🏪 Shop Front
                        </button>
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Hourly Rate ($)</label>
                      <input
                        type="number"
                        value={editData.hourlyRate}
                        onChange={(e) =>
                          setEditData({ ...editData, hourlyRate: e.target.value })
                        }
                      />
                    </div>

                    <div className="input-group">
                      <label>Account Status</label>
                      <select
                        value={editData.status}
                        onChange={(e) =>
                          setEditData({ ...editData, status: e.target.value })
                        }
                      >
                        <option value="approved">Approved</option>
                        <option value="suspended">Suspended</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label>System Role</label>
                      <select
                        value={editData.role}
                        onChange={(e) =>
                          setEditData({ ...editData, role: e.target.value })
                        }
                      >
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <button className="save-btn" onClick={saveChanges}>
                      Save Changes
                    </button>
                  </div>
                ) : (
                  <div className="readonly-stats">
                    <div className="stat">
                      <label>Dept</label>
                      <span className="capitalize">
                        {selectedProfile.department || "shop"}
                      </span>
                    </div>
                    <div className="stat">
                      <label>Rate</label>
                      <span>${selectedProfile.hourlyRate}/hr</span>
                    </div>
                    <div className="stat">
                      <label>Role</label>
                      <span className="capitalize">{selectedProfile.role}</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="address-card">
                <div className="section-header">
                  <h3>Residential Address</h3>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedProfile.addressLine1}, ${selectedProfile.suburb} ${selectedProfile.state} ${selectedProfile.postcode}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="map-link-btn"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    View on Map
                  </a>
                </div>

                <div className="address-content">
                  <div className="address-main">
                    <p className="street">{selectedProfile.addressLine1}</p>
                    <p className="suburb-post">
                      {selectedProfile.suburb}, {selectedProfile.state}{" "}
                      {selectedProfile.postcode}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
