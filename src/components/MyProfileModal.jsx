import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db, auth } from "../firebase/firebase";
import "./MyProfileModal.css";

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
    emergencyRelationship: profile?.emergencyRelationship ?? ""
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
        emergencyRelationship: profile.emergencyRelationship ?? ""
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>My Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-content">
          <section className="profile-section">
            <div className="section-header">
              <h3>Personal & Contact</h3>
              <button className="text-btn" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>

            <div className="profile-grid">
              <div className="input-group">
                <label>First Name</label>
                {isEditing ? <input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} /> : <p>{profile?.firstName || "---"}</p>}
              </div>
              <div className="input-group">
                <label>Last Name</label>
                {isEditing ? <input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /> : <p>{profile?.lastName || "---"}</p>}
              </div>
              <div className="input-group">
                <label>Phone</label>
                {isEditing ? <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> : <p>{profile?.phone || "---"}</p>}
              </div>
              <div className="input-group">
                <label>Date of Birth</label>
                {isEditing ? <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} /> : <p>{profile?.dob || "---"}</p>}
              </div>
              <div className="input-group full-width">
                <label>Street Address</label>
                {isEditing ? <input value={formData.addressLine1} onChange={e => setFormData({...formData, addressLine1: e.target.value})} /> : <p>{profile?.addressLine1 || "---"}</p>}
              </div>
              <div className="input-group">
                <label>Suburb</label>
                {isEditing ? <input value={formData.suburb} onChange={e => setFormData({...formData, suburb: e.target.value})} /> : <p>{profile?.suburb || "---"}</p>}
              </div>
              <div className="input-group">
                <label>State</label>
                {isEditing ? <input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} /> : <p>{profile?.state || "---"}</p>}
              </div>
              <div className="input-group">
                <label>Postcode</label>
                {isEditing ? <input value={formData.postcode} onChange={e => setFormData({...formData, postcode: e.target.value})} /> : <p>{profile?.postcode || "---"}</p>}
              </div>
            </div>
          </section>

          <section className="profile-section">
            <h3>Emergency Contact</h3>
            <div className="profile-grid">
              <div className="input-group">
                <label>Name</label>
                {isEditing ? <input value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} /> : <p>{profile?.emergencyName || "---"}</p>}
              </div>
              <div className="input-group">
                <label>Relationship</label>
                {isEditing ? <input value={formData.emergencyRelationship} onChange={e => setFormData({...formData, emergencyRelationship: e.target.value})} /> : <p>{profile?.emergencyRelationship || "---"}</p>}
              </div>
              <div className="input-group">
                <label>Emergency Phone</label>
                {isEditing ? <input value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} /> : <p>{profile?.emergencyPhone || "---"}</p>}
              </div>
            </div>
            {isEditing && <button className="save-btn" onClick={handleSaveProfile} disabled={loading}>{loading ? "Saving..." : "Save Changes"}</button>}
          </section>

          <section className="profile-section security-box">
             <div className="section-header">
               <h3>Security</h3>
               {!isChangingPass && <button className="text-btn" onClick={() => setIsChangingPass(true)}>Change Password</button>}
             </div>
             {isChangingPass && (
               <form className="password-form" onSubmit={handlePasswordUpdate}>
                 <div className="input-group">
                   <label>Current Password</label>
                   <input type="password" required value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} />
                 </div>
                 <div className="input-group">
                   <label>New Password</label>
                   <input type="password" required value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                 </div>
                 <div className="input-group">
                   <label>Confirm New Password</label>
                   <input type="password" required value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                 </div>
                 <div className="form-actions">
                   <button type="submit" className="confirm-btn" disabled={loading}>{loading ? "Updating..." : "Update Password"}</button>
                   <button type="button" className="cancel-btn" onClick={() => setIsChangingPass(false)}>Cancel</button>
                 </div>
               </form>
             )}
          </section>
        </div>
      </div>
    </div>
  );
}