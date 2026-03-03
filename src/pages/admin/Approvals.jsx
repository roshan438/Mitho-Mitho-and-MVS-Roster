// import { useEffect, useState } from "react";
// import {
//   collection,
//   query,
//   where,
//   getDocs,
//   updateDoc,
//   doc,
//   serverTimestamp,
//   orderBy,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import "./Approvals.css";

// export default function Approvals() {
//   const [pendingUsers, setPendingUsers] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [err, setErr] = useState("");

//   useEffect(() => {
//     fetchPending();
//   }, []);

//   async function fetchPending() {
//     setLoading(true);
//     setErr("");
//     try {
//       const q = query(
//         collection(db, "users"),
//         where("status", "==", "pending"),
//         orderBy("createdAt", "desc")
//       );

//       const snap = await getDocs(q);

//       const list = snap.docs.map((d) => ({
//         id: d.id,
//         ...d.data(),
//         hourlyRateInput: "",
//       }));

//       setPendingUsers(list);
//     } catch (e) {
//       setErr(e.message);
//     } finally {
//       setLoading(false);
//     }
//   }

//   function updateRate(uid, val) {
//     setPendingUsers((prev) =>
//       prev.map((u) => (u.id === uid ? { ...u, hourlyRateInput: val } : u))
//     );
//   }

//   async function approveUser(user) {
//     const rate = Number(user.hourlyRateInput);
//     if (!rate || rate <= 0) {
//       alert("Enter a valid hourly rate");
//       return;
//     }

//     await updateDoc(doc(db, "users", user.id), {
//       status: "approved",
//       hourlyRate: rate,
//       updatedAt: serverTimestamp(),
//     });

//     await fetchPending();
//   }

//   async function rejectUser(user) {
//     await updateDoc(doc(db, "users", user.id), {
//       status: "rejected",
//       updatedAt: serverTimestamp(),
//     });

//     await fetchPending();
//   }

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="row approvals-header">
//           <div>
//             <h1 className="h1">Approvals</h1>
//             <p className="p">Approve staff signups and set their hourly rate.</p>
//           </div>

//           <button className="btn" onClick={fetchPending}>
//             Refresh
//           </button>
//         </div>

//         <div className="spacer" />

//         {err && <div className="errorBox">{err}</div>}

//         {loading && <p className="p">Loading pending users…</p>}

//         {!loading && pendingUsers.length === 0 && (
//           <p className="p">No pending users right now.</p>
//         )}

//         {!loading &&
//           pendingUsers.map((u) => (
//             <div key={u.id} className="approvalCard">
//               <div className="approvalLeft">
//                 <div className="title">
//                   {u.firstName || ""} {u.lastName || ""}
//                 </div>
//                 <div className="meta">{u.email}</div>
//                 <div className="meta">Phone: {u.phone || "-"}</div>
//                 <div className="meta">DOB: {u.dob || "-"}</div>
//                 <div className="meta">
//                   TFN/Tax in progress: {u.taxInProgress ? "Yes" : "No"}
//                 </div>
//               </div>

//               <div className="approvalRight">
//                 <input
//                   className="input"
//                   type="number"
//                   placeholder="Hourly rate (e.g. 28)"
//                   value={u.hourlyRateInput}
//                   onChange={(e) => updateRate(u.id, e.target.value)}
//                 />

//                 <button
//                   className="btn primary"
//                   disabled={!u.hourlyRateInput || Number(u.hourlyRateInput) <= 0}
//                   onClick={() => approveUser(u)}
//                 >
//                   Approve
//                 </button>

//                 <button className="btn" onClick={() => rejectUser(u)}>
//                   Reject
//                 </button>
//               </div>
//             </div>
//           ))}
//       </div>
//     </div>
//   );
// }











import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useToast } from "../../context/ToastContext"; // Import Toast Hook
import "./Approvals.css";

export default function Approvals() {
  const { showToast } = useToast(); // Initialize Toast
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const q = query(
        collection(db, "users"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        hourlyRateInput: "",
      }));

      setPendingUsers(list);
    } catch (e) {
      const errorMsg = "Index required: " + e.message;
      setErr(errorMsg);
      showToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  function updateRate(uid, val) {
    setPendingUsers((prev) =>
      prev.map((u) => (u.id === uid ? { ...u, hourlyRateInput: val } : u))
    );
  }

  async function approveUser(user) {
    const rate = Number(user.hourlyRateInput);
    if (!rate || rate <= 0) {
      showToast("Please enter a valid hourly rate", "error");
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.id), {
        status: "approved",
        hourlyRate: rate,
        updatedAt: serverTimestamp(),
      });
      showToast(`${user.firstName} approved successfully`, "success");
      fetchPending();
    } catch (e) {
      showToast("Error approving user", "error");
    }
  }

  async function rejectUser(user) {
    // Keeping confirm for safety, but toast for feedback
    if (!window.confirm(`Are you sure you want to reject ${user.firstName}?`)) return;
    
    try {
      await updateDoc(doc(db, "users", user.id), {
        status: "rejected",
        updatedAt: serverTimestamp(),
      });
      showToast("User rejected", "success");
      fetchPending();
    } catch (e) {
      showToast("Error rejecting user", "error");
    }
  }

  return (
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Approvals</h1>
          <span className="subtitle">Onboard new staff members</span>
        </div>
        <button className={`refresh-circle ${loading ? 'spinning' : ''}`} onClick={fetchPending}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </header>

      <main className="scroll-content">
        {err && <div className="error-banner">{err}</div>}

        <div className="timeline">
          {loading ? (
            <div className="loader-inline">
              <div className="spinner"></div>
              <span>Checking for signups...</span>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="empty-state-container">
              <div className="empty-icon">🎉</div>
              <p>All caught up! No pending signups.</p>
            </div>
          ) : (
            pendingUsers.map((u) => (
              <div key={u.id} className="approval-card">
                <div className="approval-info">
                  <div className="user-profile">
                    <div className="avatar">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                    <div className="user-main">
                      <span className="user-name">{u.firstName} {u.lastName}</span>
                      <span className="user-email">{u.email}</span>
                    </div>
                  </div>
                  
                  <div className="user-details-grid">
                    <div className="detail-box"><label>Phone</label><span>{u.phone || "-"}</span></div>
                    <div className="detail-box"><label>DOB</label><span>{u.dob || "-"}</span></div>
                    <div className="detail-box"><label>TFN</label><span>{u.taxInProgress ? "In Progress" : "Ready"}</span></div>
                  </div>
                </div>

                <div className="approval-actions">
                  <div className="rate-input-wrapper">
                    <span className="currency">$</span>
                    <input
                      className="rate-input"
                      type="number"
                      placeholder="Rate"
                      value={u.hourlyRateInput}
                      onChange={(e) => updateRate(u.id, e.target.value)}
                    />
                    <span className="per-hr">/hr</span>
                  </div>

                  <div className="action-buttons">
                    <button className="reject-btn" onClick={() => rejectUser(u)}>Reject</button>
                    <button
                      className="approve-btn"
                      disabled={!u.hourlyRateInput || Number(u.hourlyRateInput) <= 0}
                      onClick={() => approveUser(u)}
                    >
                      Approve Staff
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}