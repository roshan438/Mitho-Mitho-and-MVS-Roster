// import React, { useEffect, useState } from "react";
// import { collection, getDocs, query, where } from "firebase/firestore";
// import { db } from "../../firebase/firebase"; // Adjust path to your firebase config
// import { toYMD } from "../../utils/dates"; // Adjust path to your date utils
// import "./AdminStaffList.css";

// export default function AdminStaffList() {
//   const [staff, setStaff] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState(null);
//   const today = toYMD(new Date());

//   useEffect(() => {
//     fetchStaffAndStatus();
//   }, []);

//   const fetchStaffAndStatus = async () => {
//     setLoading(true);
//     try {
//       // 1. Fetch all approved staff
//       const staffQuery = query(
//         collection(db, "users"),
//         where("role", "==", "staff"),
//         where("status", "==", "approved")
//       );
//       const staffSnap = await getDocs(staffQuery);
//       const staffList = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       // 2. Fetch today's timesheets to see who is currently "working"
//       const tsQuery = query(
//         collection(db, "timesheets"),
//         where("date", "==", today),
//         where("status", "==", "working")
//       );
//       const tsSnap = await getDocs(tsQuery);
//       const activeUids = tsSnap.docs.map((d) => d.data().uid);

//       // 3. Combine data
//       const finalData = staffList.map((s) => ({
//         ...s,
//         isWorking: activeUids.includes(s.id),
//       }));

//       setStaff(finalData.sort((a, b) => a.firstName.localeCompare(b.firstName)));
//     } catch (error) {
//       console.error("Error fetching staff:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="admin-staff-container">
//       <header className="staff-header">
//         <h1 style={{marginBottom: '0'}}>Staff Management</h1>
//         <p>Total Staff: {staff.length}</p>
//       </header>

//       {loading ? (
//         <div className="loading-spinner">Loading staff list...</div>
//       ) : (
//         <div className="staff-grid">
//           {staff.map((member) => (
//             <div 
//               key={member.id} 
//               className="staff-card" 
//               onClick={() => setSelectedProfile(member)}
//             >
//               <div className="staff-info">
//                 <span className="staff-name">
//                   {member.firstName} {member.lastName}
//                 </span>
//                 <span className="staff-email">{member.email}</span>
//               </div>
              
//               {member.isWorking && (
//                 <div className="working-badge">
//                   <span className="pulse-dot"></span>
//                   WORKING
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       )}

//       {/* Profile Detail Modal */}
//       {selectedProfile && (
//         <div className="modal-overlay" onClick={() => setSelectedProfile(null)}>
//           <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
//             <div className="modal-header">
//               <h2>Staff Profile</h2>
//               <button className="close-btn" onClick={() => setSelectedProfile(null)}>×</button>
//             </div>
            
//             <div className="modal-content">
//               <section>
//                 <h3>Personal Details</h3>
//                 <div className="detail-row"><span>Full Name:</span> {selectedProfile.firstName} {selectedProfile.lastName}</div>
//                 <div className="detail-row"><span>DOB:</span> {selectedProfile.dob}</div>
//                 <div className="detail-row"><span>Email:</span> {selectedProfile.email}</div>
//                 <div className="detail-row"><span>Phone:</span> {selectedProfile.phone}</div>
//                 <div className="detail-row"><span>Hourly Rate:</span> ${selectedProfile.hourlyRate}/hr</div>
//               </section>

//               <section>
//                 <h3>Address</h3>
//                 <div className="detail-row"><span>Street:</span> {selectedProfile.addressLine1}</div>
//                 <div className="detail-row"><span>Suburb:</span> {selectedProfile.suburb}, {selectedProfile.state} {selectedProfile.postcode}</div>
//               </section>

//               <section>
//                 <h3>Emergency Contact</h3>
//                 <div className="detail-row"><span>Name:</span> {selectedProfile.emergencyName} ({selectedProfile.emergencyRelationship})</div>
//                 <div className="detail-row"><span>Phone:</span> {selectedProfile.emergencyPhone}</div>
//               </section>

//               <section>
//                 <h3>System Info</h3>
//                 <div className="detail-row"><span>Status:</span> <span className="status-pill">{selectedProfile.status}</span></div>
//                 <div className="detail-row"><span>Tax File:</span> {selectedProfile.taxInProgress ? "In Progress" : "Completed"}</div>
//               </section>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }














// import React, { useEffect, useState } from "react";
// import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { toYMD } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext"; // Assuming you have this context
// import "./AdminStaffList.css";

// export default function AdminStaffList() {
//   const [staff, setStaff] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState(null);
//   const [isEditing, setIsEditing] = useState(false);
//   const [editData, setEditData] = useState({});
  
//   const { showToast } = useToast();
//   const today = toYMD(new Date());

//   useEffect(() => {
//     fetchStaffAndStatus();
//   }, []);

//   const fetchStaffAndStatus = async () => {
//     setLoading(true);
//     try {
//       const staffQuery = query(collection(db, "users"), where("role", "in", ["staff", "manager"]));
//       const staffSnap = await getDocs(staffQuery);
//       const staffList = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       const tsQuery = query(collection(db, "timesheets"), where("date", "==", today), where("status", "==", "working"));
//       const tsSnap = await getDocs(tsQuery);
//       const activeUids = tsSnap.docs.map((d) => d.data().uid);

//       const finalData = staffList.map((s) => ({
//         ...s,
//         isWorking: activeUids.includes(s.id),
//       }));

//       // LIVE SORT: Working staff first, then alphabetical
//     //   const sorted = finalData.sort((a, b) => {
//     //     if (a.isWorking === b.isWorking) return a.firstName.localeCompare(b.firstName);
//     //     return a.isWorking ? -1 : 1;
//     //   });


//     // LIVE SORT: Working staff first, then alphabetical
//     const sorted = finalData.sort((a, b) => {
//         // 1. Sort by working status first
//         if (a.isWorking !== b.isWorking) {
//         return a.isWorking ? -1 : 1;
//         }
    
//         // 2. Then sort by name, handling undefined/missing names safely
//         const nameA = a.firstName ?? ""; 
//         const nameB = b.firstName ?? "";
        
//         return nameA.localeCompare(nameB);
//     });

//       setStaff(sorted);
//     } catch (error) {
//       console.error(error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleEditOpen = (member) => {
//     setEditData({ 
//       hourlyRate: member.hourlyRate || 0, 
//       status: member.status || "approved",
//       role: member.role || "staff" 
//     });
//     setIsEditing(true);
//   };

//   const toggleEdit = () => {
//     if (isEditing) {
//       // If we are discarding, reset editData to current profile values
//       setEditData({ 
//         hourlyRate: selectedProfile.hourlyRate || 0, 
//         status: selectedProfile.status || "approved",
//         role: selectedProfile.role || "staff" 
//       });
//     }
//     setIsEditing(!isEditing);
//   };

//   const saveChanges = async () => {
//     try {
//       const userRef = doc(db, "users", selectedProfile.id);
//       await updateDoc(userRef, {
//         hourlyRate: Number(editData.hourlyRate),
//         status: editData.status,
//         role: editData.role,
//         updatedAt: new Date()
//       });
//       showToast("Profile updated successfully", "success");
//       setIsEditing(false);
//       setSelectedProfile(null);
//       fetchStaffAndStatus(); // Refresh list
//     } catch (e) {
//       showToast("Update failed", "error");
//     }
//   };

//   return (
//     <div className="admin-staff-container">
//       <header className="staff-header">
//         <div className="header-left header-staff-list">
//           <h1>Team Directory</h1>
//           <p>{staff.filter(s => s.isWorking).length} active now • {staff.length} total</p>
//         </div>
//         {/* <button className="refresh-btn" onClick={fetchStaffAndStatus}>↻ Refresh</button> */}
//       </header>

//       {loading ? <div className="loading-spinner">Syncing staff records...</div> : (
//         <div className="staff-grid">
//           {staff.map((member) => (
//             <div key={member.id} className={`staff-card ${member.isWorking ? 'working-border' : ''}`} onClick={() => setSelectedProfile(member)}>
//               <div className="staff-info">
//                 <span className="staff-name">{member.firstName} {member.lastName}</span>
//                 {/* <span className="staff-email">{member.email}</span> */}
//                 <span className="staff-email">{member.email || "No email provided"}</span>
//               </div>
//               {member.isWorking ? (
//                 <div className="working-badge"><span className="pulse-dot"></span> LIVE</div>
//               ) : (
//                 <span className={`status-dot-small ${member.status}`}></span>
//               )}
//             </div>
//           ))}
//         </div>
//       )}

//       {selectedProfile && (
//         <div className="modal-overlay" onClick={() => { setSelectedProfile(null); setIsEditing(false); }}>
//           <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
//             <div className="modal-header">
//               <div className="modal-title-group">
//                 <h2>{selectedProfile.firstName}'s Profile</h2>
//                 <span className={`badge-${selectedProfile.status}`}>{selectedProfile.status}</span>
//               </div>
//               <button className="close-btn" onClick={() => { setSelectedProfile(null); setIsEditing(false); }}>×</button>
//             </div>
            
//             <div className="modal-content">
//               {/* CLICK TO ACTION SECTION */}
//               {/* <div className="action-ribbon">
//                 <a href={`tel:${selectedProfile.phone}`} className="action-pill call">Call</a>
//                 <a href={`sms:${selectedProfile.phone}`} className="action-pill sms">SMS</a>
//                 <a href={`mailto:${selectedProfile.email}`} className="action-pill email">Email</a>
//               </div> */}
//               <section className="contact-actions-container">
//                 <h3>Contact & Communication</h3>
                
//                 <div className="contact-row">
//                     <div className="contact-info">
//                     <label>Mobile Number</label>
//                     <p>{selectedProfile.phone || "Not provided"}</p>
//                     </div>
//                     <div className="contact-buttons">
//                     <a href={`tel:${selectedProfile.phone}`} className="mini-btn call-bg">Call</a>
//                     <a href={`sms:${selectedProfile.phone}`} className="mini-btn sms-bg">SMS</a>
//                     </div>
//                 </div>

//                 <div className="contact-row">
//                     <div className="contact-info">
//                     <label>Email Address</label>
//                     <p>{selectedProfile.email}</p>
//                     </div>
//                     <div className="contact-buttons">
//                     <a href={`mailto:${selectedProfile.email}`} className="mini-btn email-bg">Email</a>
//                     </div>
//                 </div>

//                 <div className="contact-row">
//                     <div className="contact-info">
//                     <label>Emergency Contact</label>
//                     <p>{selectedProfile.emergencyName} ({selectedProfile.emergencyRelationship})</p>
//                     <p className="sub-text">{selectedProfile.emergencyPhone}</p>
//                     </div>
//                     <div className="contact-buttons">
//                     <a href={`tel:${selectedProfile.emergencyPhone}`} className="mini-btn emergency-bg">Call</a>
//                     </div>
//                 </div>
//                 </section>

//               <section className="admin-controls-box">
//                 <div className="section-header">
//                   <h3>Administrative Controls</h3>
//                   {/* <button className="edit-toggle-btn" onClick={() => handleEditOpen(selectedProfile)}>
//                     {isEditing ? "Discard" : "Manage Settings"}
//                   </button> */}
//                   {/* <button 
//                     className="edit-toggle-btn" 
//                     onClick={() => {
//                         setIsEditing(false); // This closes the edit form
//                         setEditData({        // This resets the local edit state to original values
//                         hourlyRate: selectedProfile.hourlyRate || 0, 
//                         status: selectedProfile.status || "approved",
//                         role: selectedProfile.role || "staff" 
//                         });
//                     }}
//                     >
//                     Discard
//                     </button> */}
//                     <button className="edit-toggle-btn" onClick={toggleEdit}>
//                         {isEditing ? "Discard" : "Manage Settings"}
//                     </button>
//                 </div>

//                 {isEditing ? (
//                   <div className="edit-form-grid">
//                     <div className="input-group">
//                       <label>Hourly Rate ($)</label>
//                       <input type="number" value={editData.hourlyRate} onChange={(e) => setEditData({...editData, hourlyRate: e.target.value})} />
//                     </div>
//                     <div className="input-group">
//                       <label>Account Status</label>
//                       <select value={editData.status} onChange={(e) => setEditData({...editData, status: e.target.value})}>
//                         <option value="approved">Approved</option>
//                         <option value="suspended">Suspended</option>
//                         <option value="inactive">Inactive</option>
//                       </select>
//                     </div>
//                     <div className="input-group">
//                       <label>System Role</label>
//                       <select value={editData.role} onChange={(e) => setEditData({...editData, role: e.target.value})}>
//                         <option value="staff">Staff</option>
//                         <option value="manager">Manager</option>
//                         <option value="admin">Admin</option>
//                       </select>
//                     </div>
//                     <button className="save-btn" onClick={saveChanges}>Save Changes</button>
//                   </div>
//                 ) : (
//                   <div className="readonly-stats">
//                     <div className="stat"><label>Rate</label><span>${selectedProfile.hourlyRate}/hr</span></div>
//                     <div className="stat"><label>Role</label><span className="capitalize">{selectedProfile.role}</span></div>
//                   </div>
//                 )}
//               </section>

//               {/* <section className="info-details">
//                 <h3>Contact & Personal</h3>
//                 <p><strong>Address:</strong> {selectedProfile.addressLine1}, {selectedProfile.suburb} {selectedProfile.postcode}</p>
//                 <p><strong>Emergency:</strong> {selectedProfile.emergencyName} ({selectedProfile.emergencyPhone})</p>
//               </section> */}
//               <section className="address-card">
//                 <div className="section-header">
//                     <h3>Residential Address</h3>
//                     <a 
//                     href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
//                         `${selectedProfile.addressLine1}, ${selectedProfile.suburb} ${selectedProfile.state} ${selectedProfile.postcode}`
//                     )}`}
//                     target="_blank" 
//                     rel="noopener noreferrer"
//                     className="map-link-btn"
//                     >
//                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
//                     View on Map
//                     </a>
//                 </div>

//                 <div className="address-content">
//                     <div className="address-main">
//                     <p className="street">{selectedProfile.addressLine1}</p>
//                     <p className="suburb-post">{selectedProfile.suburb}, {selectedProfile.state} {selectedProfile.postcode}</p>
//                     </div>
//                 </div>
//                 </section>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }















import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import "./AdminStaffList.css";

export default function AdminStaffList() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  
  const { showToast } = useToast();
  const today = toYMD(new Date());

  useEffect(() => {
    fetchStaffAndStatus();
  }, []);

  const fetchStaffAndStatus = async () => {
    setLoading(true);
    try {
      const staffQuery = query(collection(db, "users"), where("role", "in", ["staff", "manager"]));
      const staffSnap = await getDocs(staffQuery);
      const staffList = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const tsQuery = query(collection(db, "timesheets"), where("date", "==", today), where("status", "==", "working"));
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
    } finally {
      setLoading(false);
    }
  };

  const toggleEdit = () => {
    if (!isEditing) {
      // OPENING EDIT MODE: Load current values into editData
      setEditData({ 
        hourlyRate: selectedProfile.hourlyRate || 0, 
        status: selectedProfile.status || "approved",
        role: selectedProfile.role || "staff",
        department: selectedProfile.department || "shop" // 1. Added Department
      });
    }
    setIsEditing(!isEditing);
  };

  const saveChanges = async () => {
    try {
      const userRef = doc(db, "users", selectedProfile.id);
      if(editData.role === 'manager'){
        editData.department = "manager"
      }
      await updateDoc(userRef, {
        hourlyRate: Number(editData.hourlyRate),
        status: editData.status,
        role: editData.role,
        department: editData.department, // 2. Save Department
        updatedAt: new Date()
      });
      showToast("Profile updated successfully", "success");
      setIsEditing(false);
      setSelectedProfile(null);
      fetchStaffAndStatus();
    } catch (e) {
      showToast("Update failed", "error");
    }
  };

  return (
    <div className="admin-staff-container">
      <header className="staff-header">
        <div className="header-left header-staff-list">
          <h1>Team Directory</h1>
          <p>{staff.filter(s => s.isWorking).length} active now • {staff.length} total</p>
        </div>
      </header>

      {loading ? <div className="loading-spinner">Syncing staff records...</div> : (
        <div className="staff-grid">
          {staff.map((member) => (
            <div key={member.id} className={`staff-card ${member.isWorking ? 'working-border' : ''}`} onClick={() => setSelectedProfile(member)}>
              <div className="staff-info">
                <span className="staff-name">{member.firstName} {member.lastName}</span>
                <span className="staff-email">{member.email || "No email provided"}</span>
                {/* 3. Added Department Tag to card */}
                <span className="dept-tag-micro">{member.department || 'shop'}</span>
              </div>
              {member.isWorking ? (
                <div className="working-badge"><span className="pulse-dot"></span> LIVE</div>
              ) : (
                <span className={`status-dot-small ${member.status}`}></span>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedProfile && (
        <div className="modal-overlay" onClick={() => { setSelectedProfile(null); setIsEditing(false); }}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h2>{selectedProfile.firstName}'s Profile</h2>
                <span className={`badge-${selectedProfile.status}`}>{selectedProfile.status}</span>
              </div>
              <button className="close-btn" onClick={() => { setSelectedProfile(null); setIsEditing(false); }}>×</button>
            </div>
            
            <div className="modal-content">
              {/* <div className="action-ribbon">
                 <a href={`tel:${selectedProfile.phone}`} className="action-pill call">Call</a>
               <a href={`sms:${selectedProfile.phone}`} className="action-pill sms">SMS</a>
                 <a href={`mailto:${selectedProfile.email}`} className="action-pill email">Email</a>
               </div> */}

              <section className="contact-actions-container">
                <h3>Contact & Communication</h3>
                <div className="contact-row">
                    <div className="contact-info">
                        <label>Mobile Number</label>
                        <p>{selectedProfile.phone || "Not provided"}</p>
                    </div>
                    <div className="contact-buttons">
                        <a href={`tel:${selectedProfile.phone}`} className="mini-btn call-bg">Call</a>
                        <a href={`sms:${selectedProfile.phone}`} className="mini-btn sms-bg">SMS</a>
                    </div>
                </div>



                 <div className="contact-row">
                     <div className="contact-info">
                     <label>Email Address</label>
                     <p>{selectedProfile.email}</p>
                    </div>
                     <div className="contact-buttons">
                     <a href={`mailto:${selectedProfile.email}`} className="mini-btn email-bg">Email</a>
                     </div>
                 </div>

                 <div className="contact-row" style={{background: '#ef44441f'}}>
                     <div className="contact-info">
                     <label style={{color: '#ef4444'}}>Emergency Contact</label>
                     <p>{selectedProfile.emergencyName} ({selectedProfile.emergencyRelationship})</p>
                     <p className="sub-text">{selectedProfile.emergencyPhone}</p>
                     </div>
                     <div className="contact-buttons">
                     <a href={`tel:${selectedProfile.emergencyPhone}`} className="mini-btn emergency-bg">Call</a>
                     </div>
                 </div>

              </section>

              <section className="admin-controls-box">
                <div className="section-header">
                  <h3>Administrative Controls</h3>
                    <button className="edit-toggle-btn" onClick={toggleEdit}>
                        {isEditing ? "Discard" : "Manage Settings"}
                    </button>
                </div>

                {isEditing ? (
                  <div className="edit-form-grid">
                    {/* 4. DEPARTMENT TOGGLE UI */}
                    <div className="input-group full-width">
                      <label>Department Assignment</label>
                      <div className="dept-toggle-group">
                        <button 
                          className={`dept-btn ${editData.department === 'kitchen' ? 'active' : ''}`}
                          onClick={() => setEditData({...editData, department: 'kitchen'})}
                        >
                          🍳 Kitchen
                        </button>
                        <button 
                          className={`dept-btn ${editData.department === 'shop' ? 'active' : ''}`}
                          onClick={() => setEditData({...editData, department: 'shop'})}
                        >
                          🏪 Shop Front
                        </button>
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Hourly Rate ($)</label>
                      <input type="number" value={editData.hourlyRate} onChange={(e) => setEditData({...editData, hourlyRate: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>Account Status</label>
                      <select value={editData.status} onChange={(e) => setEditData({...editData, status: e.target.value})}>
                        <option value="approved">Approved</option>
                        <option value="suspended">Suspended</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>System Role</label>
                      <select value={editData.role} onChange={(e) => setEditData({...editData, role: e.target.value})}>
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <button className="save-btn" onClick={saveChanges}>Save Changes</button>
                  </div>
                ) : (
                  <div className="readonly-stats">
                    <div className="stat"><label>Dept</label><span className="capitalize">{selectedProfile.department || 'shop'}</span></div>
                    <div className="stat"><label>Rate</label><span>${selectedProfile.hourlyRate}/hr</span></div>
                    <div className="stat"><label>Role</label><span className="capitalize">{selectedProfile.role}</span></div>
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    View on Map
                    </a>
                </div>

                <div className="address-content">
                    <div className="address-main">
                    <p className="street">{selectedProfile.addressLine1}</p>
                    <p className="suburb-post">{selectedProfile.suburb}, {selectedProfile.state} {selectedProfile.postcode}</p>
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