import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db, auth } from "../firebase/firebase";
import { normalizeNotificationSettings } from "../utils/notificationSettings";
import "./MyProfileModal.css";

const NOTIFICATION_CATEGORY_OPTIONS = [
  { key: "roster", label: "Roster changes" },
  { key: "shiftRequests", label: "Shift requests" },
  { key: "leave", label: "Leave updates" },
  { key: "timesheet", label: "Timesheet reviews" },
  { key: "reminders", label: "Break reminders" },
  { key: "kitchen", label: "Kitchen operations" },
  { key: "general", label: "General updates" },
];

export default function MyProfileModal({ profile, uid, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    phone: profile?.phone ?? "",
    dob: profile?.dob ?? "",
    addressLine1: profile?.addressLine1 ?? "",
    suburb: profile?.suburb ?? "",
    state: profile?.state ?? "",
    postcode: profile?.postcode ?? "",
    emergencyName: profile?.emergencyName ?? "",
    emergencyPhone: profile?.emergencyPhone ?? "",
    emergencyRelationship: profile?.emergencyRelationship ?? "",
    notificationSettings: normalizeNotificationSettings(profile?.notificationSettings),
  });

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        phone: profile.phone ?? "",
        dob: profile.dob ?? "",
        addressLine1: profile.addressLine1 ?? "",
        suburb: profile.suburb ?? "",
        state: profile.state ?? "",
        postcode: profile.postcode ?? "",
        emergencyName: profile.emergencyName ?? "",
        emergencyPhone: profile.emergencyPhone ?? "",
        emergencyRelationship: profile.emergencyRelationship ?? "",
        notificationSettings: normalizeNotificationSettings(profile.notificationSettings),
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { ...formData, updatedAt: new Date() });
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (e) {
      alert("Update failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const notificationSettings = formData.notificationSettings;

  const updateNotificationSetting = (patch) => {
    setFormData((prev) => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        ...patch,
      },
    }));
  };

  const toggleNotificationCategory = (key) => {
    setFormData((prev) => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        categories: {
          ...prev.notificationSettings.categories,
          [key]: !prev.notificationSettings.categories[key],
        },
      },
    }));
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return alert("New passwords do not match");
    }
    if (passwords.new.length < 6) {
      return alert("New password must be at least 6 characters");
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, passwords.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, passwords.new);
      alert("Password updated!");
      setIsChangingPass(false);
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="ps-modal-overlay" onClick={onClose}>
      <div className="ps-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="ps-modal-header">
          <div className="ps-header-titles">
            <h2>Account Settings</h2>
            <p>Manage your personal information and security</p>
          </div>
          <button className="ps-close-x" onClick={onClose}>&times;</button>
        </div>

        <div className="ps-modal-body">
          <section className="ps-section">
            <div className="ps-section-header">
              <h3>Personal Details</h3>
              <button className={`ps-edit-toggle ${isEditing ? 'active' : ''}`} onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? "Cancel" : "Edit Profile"}
              </button>
            </div>

            <div className="ps-grid">
              <div className="ps-field">
                <label>First Name</label>
                {isEditing ? <input className="ps-input" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} /> : <p className="ps-value">{profile?.firstName || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>Last Name</label>
                {isEditing ? <input className="ps-input" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /> : <p className="ps-value">{profile?.lastName || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>Phone Number</label>
                {isEditing ? <input className="ps-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> : <p className="ps-value">{profile?.phone || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>Date of Birth</label>
                {isEditing ? <input type="date" className="ps-input" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} /> : <p className="ps-value">{profile?.dob || "---"}</p>}
              </div>
              <div className="ps-field full-width">
                <label>Street Address</label>
                {isEditing ? <input className="ps-input" value={formData.addressLine1} onChange={e => setFormData({...formData, addressLine1: e.target.value})} /> : <p className="ps-value">{profile?.addressLine1 || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>Suburb</label>
                {isEditing ? <input className="ps-input" value={formData.suburb} onChange={e => setFormData({...formData, suburb: e.target.value})} /> : <p className="ps-value">{profile?.suburb || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>State</label>
                {isEditing ? <input className="ps-input" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} /> : <p className="ps-value">{profile?.state || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>Postcode</label>
                {isEditing ? <input className="ps-input" value={formData.postcode} onChange={e => setFormData({...formData, postcode: e.target.value})} /> : <p className="ps-value">{profile?.postcode || "---"}</p>}
              </div>
            </div>
          </section>

          <section className="ps-section">
            <h3 className="ps-sub-title">Emergency Contact</h3>
            <div className="ps-grid">
              <div className="ps-field">
                <label>Full Name</label>
                {isEditing ? <input className="ps-input" value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} /> : <p className="ps-value">{profile?.emergencyName || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>Relationship</label>
                {isEditing ? <input className="ps-input" value={formData.emergencyRelationship} onChange={e => setFormData({...formData, emergencyRelationship: e.target.value})} /> : <p className="ps-value">{profile?.emergencyRelationship || "---"}</p>}
              </div>
              <div className="ps-field">
                <label>Phone Number</label>
                {isEditing ? <input className="ps-input" value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} /> : <p className="ps-value">{profile?.emergencyPhone || "---"}</p>}
              </div>
            </div>
          </section>

          <section className="ps-section">
            <div className="ps-section-header">
              <h3>Notification Settings</h3>
            </div>

            <div className="ps-settings-stack">
              <div className="ps-toggle-row">
                <div>
                  <strong>Browser alerts</strong>
                  <p>Allow live roster alerts on this device when important updates arrive.</p>
                </div>
                <button
                  type="button"
                  className={`ps-switch ${notificationSettings.browserEnabled ? "active" : ""}`}
                  onClick={() => updateNotificationSetting({ browserEnabled: !notificationSettings.browserEnabled })}
                >
                  <span />
                </button>
              </div>

              <div className="ps-toggle-row">
                <div>
                  <strong>Installed app push alerts</strong>
                  <p>Allow Home Screen push notifications for priority updates when the app is closed.</p>
                </div>
                <button
                  type="button"
                  className={`ps-switch ${notificationSettings.pushEnabled ? "active" : ""}`}
                  onClick={() => updateNotificationSetting({ pushEnabled: !notificationSettings.pushEnabled })}
                >
                  <span />
                </button>
              </div>

              <div className="ps-setting-card">
                <label className="ps-setting-label">Bell badge mode</label>
                <div className="ps-inline-choice">
                  <button
                    type="button"
                    className={`ps-choice-btn ${notificationSettings.badgeMode === "priority" ? "active" : ""}`}
                    onClick={() => updateNotificationSetting({ badgeMode: "priority" })}
                  >
                    Priority only
                  </button>
                  <button
                    type="button"
                    className={`ps-choice-btn ${notificationSettings.badgeMode === "all" ? "active" : ""}`}
                    onClick={() => updateNotificationSetting({ badgeMode: "all" })}
                  >
                    All unread
                  </button>
                </div>
              </div>

              <div className="ps-setting-card">
                <div className="ps-toggle-row compact">
                  <div>
                    <strong>Quiet hours</strong>
                    <p>Pause browser popups during your off-hours.</p>
                  </div>
                  <button
                    type="button"
                    className={`ps-switch ${notificationSettings.quietHoursEnabled ? "active" : ""}`}
                    onClick={() => updateNotificationSetting({ quietHoursEnabled: !notificationSettings.quietHoursEnabled })}
                  >
                    <span />
                  </button>
                </div>

                <div className="ps-grid ps-grid-tight">
                  <div className="ps-field">
                    <label>Quiet From</label>
                    <input
                      type="time"
                      className="ps-input"
                      value={notificationSettings.quietHoursStart}
                      onChange={(e) => updateNotificationSetting({ quietHoursStart: e.target.value })}
                      disabled={!notificationSettings.quietHoursEnabled}
                    />
                  </div>
                  <div className="ps-field">
                    <label>Quiet Until</label>
                    <input
                      type="time"
                      className="ps-input"
                      value={notificationSettings.quietHoursEnd}
                      onChange={(e) => updateNotificationSetting({ quietHoursEnd: e.target.value })}
                      disabled={!notificationSettings.quietHoursEnabled}
                    />
                  </div>
                </div>
              </div>

              <div className="ps-setting-card">
                <label className="ps-setting-label">Muted categories</label>
                <div className="ps-chip-grid">
                  {NOTIFICATION_CATEGORY_OPTIONS.map((option) => {
                    const enabled = notificationSettings.categories[option.key] !== false;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`ps-chip-toggle ${enabled ? "active" : "muted"}`}
                        onClick={() => toggleNotificationCategory(option.key)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {isEditing && (
              <button className="ps-save-main-btn" onClick={handleSaveProfile} disabled={loading}>
                {loading ? "Syncing Data..." : "Save Profile Changes"}
              </button>
            )}
          </section>

          <section className="ps-section ps-security-zone">
             <div className="ps-section-header">
               <h3>Login Security</h3>
               {!isChangingPass && <button className="ps-link-btn" onClick={() => setIsChangingPass(true)}>Update Password</button>}
             </div>
             {isChangingPass && (
               <form className="ps-pass-form" onSubmit={handlePasswordUpdate}>
                 <div className="ps-field">
                   <label>Current Password</label>
                   <input className="ps-input" type="password" required value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} />
                 </div>
                 <div className="ps-grid">
                    <div className="ps-field">
                      <label>New Password</label>
                      <input className="ps-input" type="password" required value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                    </div>
                    <div className="ps-field">
                      <label>Confirm New Password</label>
                      <input className="ps-input" type="password" required value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                    </div>
                 </div>
                 <div className="ps-form-actions">
                   <button type="submit" className="ps-confirm-btn" disabled={loading}>
                     {loading ? "Updating..." : "Update Password"}
                   </button>
                   <button type="button" className="ps-cancel-btn" onClick={() => setIsChangingPass(false)}>Cancel</button>
                 </div>
               </form>
             )}
          </section>
        </div>
      </div>
    </div>
  );

}
