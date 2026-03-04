// // src/pages/admin/AdminEditTimesheets.jsx
// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   collection,
//   doc,
//   getDocs,
//   query,
//   where,
//   updateDoc,
//   serverTimestamp,
//   Timestamp,
//   deleteField,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import { useToast } from "../../context/ToastContext";
// import "./Audit.css"; // reuse same styling (or create EditTimesheets.css later)

// // ---------- Helpers ----------
// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function fmtTime(ts) {
//   if (!ts || !ts.toDate) return "-";
//   const d = ts.toDate();
//   return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// }

// function minutesBetween(a, b) {
//   if (!a?.toDate || !b?.toDate) return null;
//   const ms = b.toDate().getTime() - a.toDate().getTime();
//   return Math.max(0, Math.round(ms / 60000));
// }

// function inputBreakMinutes(bStart, bEnd) {
//   const toMin = (hm) => {
//     if (!hm) return null;
//     const [h, m] = String(hm).split(":").map(Number);
//     if (Number.isNaN(h) || Number.isNaN(m)) return null;
//     return h * 60 + m;
//   };
//   const s = toMin(bStart);
//   const e = toMin(bEnd);
//   if (s == null || e == null) return null;
//   let diff = e - s;
//   if (diff < 0) diff += 1440;
//   return Math.max(0, diff);
// }

// function tsToLocalInput(ts) {
//   if (!ts?.toDate) return "";
//   const d = ts.toDate();
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
//     d.getHours()
//   )}:${pad(d.getMinutes())}`;
// }

// function localInputToTimestamp(v) {
//   if (!v) return null;
//   const d = new Date(v);
//   return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
// }

// function effective(t, key) {
//   // prefer admin override if present
//   return t?.actualOverrides?.[key] || t?.[key] || null;
// }

// export default function AdminEditTimesheets() {
//   const { fbUser } = useAuth();
//   const { showToast } = useToast();

//   // Filters
//   const [preset, setPreset] = useState("week");
//   const [dateFrom, setDateFrom] = useState(toYMD(getWeekStartMonday(new Date())));
//   const [dateTo, setDateTo] = useState(toYMD(addDays(getWeekStartMonday(new Date()), 7)));
//   const [storeId, setStoreId] = useState("all");
//   const [employeeUid, setEmployeeUid] = useState("all");

//   // Data
//   const [loading, setLoading] = useState(true);
//   const [timesheets, setTimesheets] = useState([]);
//   const [staffList, setStaffList] = useState([]);
//   const [staffByUid, setStaffByUid] = useState({});

//   // Editor
//   const [openEditorId, setOpenEditorId] = useState(null);
//   const [savingId, setSavingId] = useState(null);
//   const [edit, setEdit] = useState({
//     auditStatus: "none",
//     adminNote: "",
//     start: "",
//     breakStart: "",
//     breakEnd: "",
//     end: "",
//   });

//   // Load staff list
//   const loadStaffList = useCallback(async () => {
//     try {
//       const qs = query(
//         collection(db, "users"),
//         where("role", "==", "staff"),
//         where("status", "==", "approved")
//       );
//       const snap = await getDocs(qs);
//       const list = snap.docs
//         .map((d) => ({
//           uid: d.id,
//           name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.data().email || d.id,
//         }))
//         .sort((a, b) => a.name.localeCompare(b.name));

//       const map = {};
//       list.forEach((x) => (map[x.uid] = x.name));
//       setStaffList(list);
//       setStaffByUid(map);
//     } catch (e) {
//       console.error(e);
//       showToast("Staff load failed", "error");
//     }
//   }, [showToast]);

//   // Load timesheets
//   const loadRows = useCallback(
//     async (isManual = false) => {
//       setLoading(true);
//       try {
//         // base query by date range
//         let qTs = query(
//           collection(db, "timesheets"),
//           where("date", ">=", dateFrom),
//           where("date", "<", dateTo)
//         );

//         // optional filter by employee
//         if (employeeUid !== "all") {
//           qTs = query(
//             collection(db, "timesheets"),
//             where("uid", "==", employeeUid),
//             where("date", ">=", dateFrom),
//             where("date", "<", dateTo)
//           );
//         }

//         const snap = await getDocs(qTs);
//         let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

//         // optional filter by store (client-side)
//         if (storeId !== "all") list = list.filter((x) => x.storeId === storeId);

//         // enrich
//         list = list
//           .map((t) => {
//             const start = effective(t, "startActual");
//             const bStart = effective(t, "breakStartActual");
//             const bEnd = effective(t, "breakEndActual");
//             const end = effective(t, "endActual");

//             return {
//               ...t,
//               staffName: staffByUid[t.uid] || t.staffName || "Unknown",
//               startActualFmt: fmtTime(start),
//               breakMinutes: minutesBetween(bStart, bEnd),
//               endActualFmt: fmtTime(end),
//               effStart: start,
//               effBreakStart: bStart,
//               effBreakEnd: bEnd,
//               effEnd: end,
//               breakInputMinutes: inputBreakMinutes(t.breakStartInput, t.breakEndInput),
//             };
//           })
//           .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.staffName || "").localeCompare(b.staffName || ""));

//         setTimesheets(list);

//         if (isManual) showToast("Updated", "success");
//       } catch (e) {
//         console.error(e);
//         showToast("Error fetching timesheets", "error");
//       } finally {
//         setLoading(false);
//       }
//     },
//     [dateFrom, dateTo, storeId, employeeUid, staffByUid, showToast]
//   );

//   useEffect(() => {
//     loadStaffList();
//   }, [loadStaffList]);

//   useEffect(() => {
//     loadRows();
//   }, [loadRows]);

//   // Presets
//   useEffect(() => {
//     const now = new Date();
//     if (preset === "day") {
//       setDateFrom(toYMD(now));
//       setDateTo(toYMD(addDays(now, 1)));
//     } else if (preset === "week") {
//       const ws = getWeekStartMonday(now);
//       setDateFrom(toYMD(ws));
//       setDateTo(toYMD(addDays(ws, 7)));
//     }
//   }, [preset]);

//   const openEditor = (t) => {
//     setOpenEditorId(t.id);
//     setEdit({
//       auditStatus: t.auditStatus || "none",
//       adminNote: t.adminNote || "",
//       start: tsToLocalInput(t.effStart),
//       breakStart: tsToLocalInput(t.effBreakStart),
//       breakEnd: tsToLocalInput(t.effBreakEnd),
//       end: tsToLocalInput(t.effEnd),
//     });
//   };

//   const saveEditor = async (t) => {
//     if (!fbUser) return showToast("Unauthorized", "error");
//     setSavingId(t.id);

//     try {
//       // write overrides, deleting keys if empty
//       const overrides = {};
//       const setOrDelete = (key, v) => {
//         const ts = localInputToTimestamp(v);
//         overrides[key] = ts ? ts : deleteField();
//       };

//       setOrDelete("startActual", edit.start);
//       setOrDelete("breakStartActual", edit.breakStart);
//       setOrDelete("breakEndActual", edit.breakEnd);
//       setOrDelete("endActual", edit.end);

//       const patch = {
//         auditStatus: edit.auditStatus,
//         adminNote: edit.adminNote,
//         auditUpdatedAt: serverTimestamp(),
//         auditUpdatedBy: fbUser.uid,
//         actualOverrides: overrides,
//         updatedAt: serverTimestamp(),
//       };

//       await updateDoc(doc(db, "timesheets", t.id), patch);

//       showToast("Saved", "success");
//       setOpenEditorId(null);
//       loadRows();
//     } catch (e) {
//       console.error(e);
//       showToast("Save failed", "error");
//     } finally {
//       setSavingId(null);
//     }
//   };

//   const clearOverrides = async (t) => {
//     if (!fbUser) return showToast("Unauthorized", "error");
//     setSavingId(t.id);

//     try {
//       await updateDoc(doc(db, "timesheets", t.id), {
//         actualOverrides: deleteField(),
//         auditUpdatedAt: serverTimestamp(),
//         auditUpdatedBy: fbUser.uid,
//         updatedAt: serverTimestamp(),
//       });
//       showToast("Overrides cleared", "success");
//       setOpenEditorId(null);
//       loadRows();
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to clear overrides", "error");
//     } finally {
//       setSavingId(null);
//     }
//   };

//   return (
//     <div className="mobile-app-wrapper">
//       <header className="app-header">
//         <div className="header-text">
//           <h1 className="main-title">Edit Timesheets</h1>
//           <span className="subtitle">Admin override timestamps & notes</span>
//         </div>
//         <button className={`refresh-circle ${loading ? "spinning" : ""}`} onClick={() => loadRows(true)}>
//           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//             <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//           </svg>
//         </button>
//       </header>

//       <main className="scroll-content">
//         {/* Filters */}
//         <section className="audit-filters-container">
//           <div className="preset-tabs">
//             {["day", "week", "custom"].map((p) => (
//               <button key={p} className={`tab-item ${preset === p ? "active" : ""}`} onClick={() => setPreset(p)}>
//                 {p.toUpperCase()}
//               </button>
//             ))}
//           </div>

//           {preset === "custom" && (
//             <div className="custom-date-row animate-slide-down">
//               <div className="filter-field">
//                 <label>From</label>
//                 <input type="date" className="app-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
//               </div>
//               <div className="filter-field">
//                 <label>To (Excl)</label>
//                 <input type="date" className="app-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
//               </div>
//             </div>
//           )}

//           <div className="filters-grid">
//             <div className="filter-field">
//               <label>Store</label>
//               <select className="app-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
//                 <option value="all">All Stores</option>
//                 {STORES.map((s) => (
//                   <option key={s.id} value={s.id}>
//                     {s.label}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="filter-field">
//               <label>Staff</label>
//               <select className="app-input" value={employeeUid} onChange={(e) => setEmployeeUid(e.target.value)}>
//                 <option value="all">All Staff</option>
//                 {staffList.map((s) => (
//                   <option key={s.uid} value={s.uid}>
//                     {s.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>
//         </section>

//         {/* Stats */}
//         <section className="stats-bar">
//           <div className="stat-item">
//             <label>Total</label>
//             <div className="value">{timesheets.length}</div>
//           </div>
//           <div className="stat-divider" />
//           <div className="stat-item">
//             <label>Finished</label>
//             <div className="value warn">{timesheets.filter((t) => t.effEnd).length}</div>
//           </div>
//         </section>

//         {/* List */}
//         <div className="audit-list timeline">
//           {loading ? (
//             <div className="loader-inline">
//               <div className="spinner"></div>
//               <span>Loading...</span>
//             </div>
//           ) : timesheets.length === 0 ? (
//             <div className="empty-state-container">
//               <p>No data found.</p>
//             </div>
//           ) : (
//             timesheets.map((t) => (
//               <div key={t.id} className={`audit-card ${openEditorId === t.id ? "is-editing" : ""}`}>
//                 <div
//                   className="audit-card-header"
//                   onClick={() => {
//                     if (openEditorId === t.id) setOpenEditorId(null);
//                     else openEditor(t);
//                   }}
//                 >
//                   <div className="staff-info">
//                     <span className="staff-name">{t.staffName}</span>
//                     <span className="shift-date">
//                       {t.date} • {storeLabel(t.storeId)}
//                     </span>
//                   </div>
//                   <div className="status-area">
//                     <span className={`chip ${t.auditStatus === "approved" ? "ok" : t.auditStatus === "reviewed" ? "warn" : ""}`}>
//                       {t.auditStatus || "Unmarked"}
//                     </span>
//                   </div>
//                 </div>

//                 <div className="audit-card-body">
//                   <div className="comparison-grid">
//                     <div className="comp-box">
//                       <label>Clock On</label>
//                       <span className="actual">{t.startActualFmt}</span>
//                       <span className="input-val">Typed: {t.startInput || "--"}</span>
//                     </div>

//                     <div className="comp-box">
//                       <label>Break</label>
//                       <span className="actual">{t.breakMinutes ?? 0}m</span>
//                       <span className="input-val">Typed: {t.breakInputMinutes ?? 0}m</span>
//                     </div>

//                     <div className="comp-box">
//                       <label>Clock Off</label>
//                       <span className="actual">{t.endActualFmt}</span>
//                       <span className="input-val">Typed: {t.endInput || "--"}</span>
//                     </div>
//                   </div>

//                   {openEditorId === t.id && (
//                     <div className="admin-editor animate-slide-down">
//                       <div className="edit-field">
//                         <label>Status</label>
//                         <select
//                           className="app-input"
//                           value={edit.auditStatus}
//                           onChange={(e) => setEdit((p) => ({ ...p, auditStatus: e.target.value }))}
//                         >
//                           <option value="none">Unmarked</option>
//                           <option value="reviewed">Reviewed</option>
//                           <option value="approved">Approved</option>
//                         </select>
//                       </div>

//                       <div className="edit-field">
//                         <label>Admin Note</label>
//                         <textarea
//                           className="app-input"
//                           value={edit.adminNote}
//                           onChange={(e) => setEdit((p) => ({ ...p, adminNote: e.target.value }))}
//                           placeholder="Internal notes..."
//                         />
//                       </div>

//                       {/* Overrides */}
//                       <div className="override-grid">
//                         <div className="field-box">
//                           <label>Start</label>
//                           <input type="datetime-local" className="app-input" value={edit.start} onChange={(e) => setEdit((p) => ({ ...p, start: e.target.value }))} />
//                         </div>

//                         <div className="field-box">
//                           <label>Break Start</label>
//                           <input
//                             type="datetime-local"
//                             className="app-input"
//                             value={edit.breakStart}
//                             onChange={(e) => setEdit((p) => ({ ...p, breakStart: e.target.value }))}
//                           />
//                         </div>

//                         <div className="field-box">
//                           <label>Break End</label>
//                           <input
//                             type="datetime-local"
//                             className="app-input"
//                             value={edit.breakEnd}
//                             onChange={(e) => setEdit((p) => ({ ...p, breakEnd: e.target.value }))}
//                           />
//                         </div>

//                         <div className="field-box">
//                           <label>End</label>
//                           <input type="datetime-local" className="app-input" value={edit.end} onChange={(e) => setEdit((p) => ({ ...p, end: e.target.value }))} />
//                         </div>
//                       </div>

//                       <div className="editor-actions">
//                         <button className="btn-sec" onClick={() => setOpenEditorId(null)} disabled={savingId === t.id}>
//                           Cancel
//                         </button>

//                         <button className="btn-sec" onClick={() => clearOverrides(t)} disabled={savingId === t.id}>
//                           {savingId === t.id ? "Working..." : "Clear Overrides"}
//                         </button>

//                         <button className="btn-primary" onClick={() => saveEditor(t)} disabled={savingId === t.id}>
//                           {savingId === t.id ? "Saving..." : "Apply"}
//                         </button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       </main>
//     </div>
//   );
// }






import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, doc, getDocs, query, where, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { STORES } from "../../utils/constants";
import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import "./AdminEditTimesheets.css";

// --- Helpers ---
function storeLabel(storeId) {
  return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
}

function inputBreakMinutes(bStart, bEnd) {
  const toMin = (hm) => {
    if (!hm) return null;
    const [h, m] = String(hm).split(":").map(Number);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
  };
  const s = toMin(bStart), e = toMin(bEnd);
  if (s == null || e == null) return null;
  let diff = e - s;
  if (diff < 0) diff += 1440;
  return Math.max(0, diff);
}

function isHHMM(v) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v));
}

function calcStatusFromInputs({ startInput, endInput, breakStartInput, breakEndInput }) {
  if (endInput) return "clocked_out";
  if (startInput && breakStartInput && !breakEndInput) return "on_break";
  if (startInput) return "working";
  return "pending";
}

export default function AdminEditTimesheets() {
  const { fbUser } = useAuth();
  const { showToast } = useToast();

  const [preset, setPreset] = useState("week");
  const [dateFrom, setDateFrom] = useState(toYMD(getWeekStartMonday(new Date())));
  const [dateTo, setDateTo] = useState(toYMD(addDays(getWeekStartMonday(new Date()), 7)));
  const [storeId, setStoreId] = useState("all");
  const [employeeUid, setEmployeeUid] = useState("all");

  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffByUid, setStaffByUid] = useState({});
  const [openEditorId, setOpenEditorId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const [edit, setEdit] = useState({
    auditStatus: "none", adminNote: "", startInput: "", breakStartInput: "", breakEndInput: "", endInput: "",
  });

  const [addForm, setAddForm] = useState({
    uid: "all", date: toYMD(new Date()), storeId: STORES?.[0]?.id || "momoz_strathfield",
    startInput: "", breakStartInput: "", breakEndInput: "", endInput: "", adminNote: "",
  });

  const loadStaffList = useCallback(async () => {
    try {
      const qs = query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"));
      const snap = await getDocs(qs);
      const list = snap.docs.map(d => ({ uid: d.id, name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.id }));
      const map = {}; list.forEach(x => map[x.uid] = x.name);
      setStaffList(list); setStaffByUid(map);
    } catch (e) { showToast("Staff load failed", "error"); }
  }, [showToast]);

  const loadRows = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      let qTs = query(collection(db, "timesheets"), where("date", ">=", dateFrom), where("date", "<", dateTo));
      if (employeeUid !== "all") qTs = query(collection(db, "timesheets"), where("uid", "==", employeeUid), where("date", ">=", dateFrom), where("date", "<", dateTo));
      const snap = await getDocs(qTs);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (storeId !== "all") list = list.filter(x => x.storeId === storeId);
      list = list.map(t => ({ ...t, staffName: staffByUid[t.uid] || t.staffName || "Unknown", breakInputMinutes: inputBreakMinutes(t.breakStartInput, t.breakEndInput) }))
                 .sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));
      setTimesheets(list);
      if (isManual) showToast("Updated", "success");
    } catch (e) { showToast("Error fetching", "error"); } finally { setLoading(false); }
  }, [dateFrom, dateTo, storeId, employeeUid, staffByUid, showToast]);

  useEffect(() => { loadStaffList(); }, [loadStaffList]);
  useEffect(() => { loadRows(); }, [loadRows]);

  useEffect(() => {
    const now = new Date();
    if (preset === "day") { setDateFrom(toYMD(now)); setDateTo(toYMD(addDays(now, 1))); }
    else if (preset === "week") { const ws = getWeekStartMonday(now); setDateFrom(toYMD(ws)); setDateTo(toYMD(addDays(ws, 7))); }
  }, [preset]);

  const saveEditor = async (t) => {
    if (!fbUser) return; setSavingId(t.id);
    try {
      const next = { startInput: edit.startInput || "", breakStartInput: edit.breakStartInput || "", breakEndInput: edit.breakEndInput || "", endInput: edit.endInput || "" };
      const patch = { ...next, auditStatus: edit.auditStatus, adminNote: edit.adminNote, auditUpdatedAt: serverTimestamp(), auditUpdatedBy: fbUser.uid, status: calcStatusFromInputs(next), updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "timesheets", t.id), patch);
      showToast("Saved", "success"); setOpenEditorId(null); loadRows();
    } catch (e) { showToast("Save failed", "error"); } finally { setSavingId(null); }
  };

  // --- NEW: Add Entry Logic ---
  const createTimesheet = async () => {
    if (!fbUser) return;
    if (addForm.uid === "all") return showToast("Please select a staff member", "error");
    if (!addForm.startInput) return showToast("Start time is required", "error");

    setAdding(true);
    try {
      const id = `${addForm.uid}_${addForm.date}`;
      const payload = {
        uid: addForm.uid,
        staffName: staffByUid[addForm.uid] || "Unknown",
        storeId: addForm.storeId,
        date: addForm.date,
        startInput: addForm.startInput,
        breakStartInput: addForm.breakStartInput,
        breakEndInput: addForm.breakEndInput,
        endInput: addForm.endInput,
        adminNote: addForm.adminNote,
        auditStatus: "reviewed",
        status: calcStatusFromInputs(addForm),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: fbUser.uid
      };

      await setDoc(doc(db, "timesheets", id), payload, { merge: true });
      showToast("Timesheet added successfully", "success");
      setAddOpen(false);
      loadRows();
    } catch (e) {
      showToast("Failed to create entry", "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="admin-page-container">
      <header className="admin-header">
        <div className="title-section">
          <h1>Timesheet Auditor</h1>
          <p>Manual correction of staff typed inputs</p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={() => setAddOpen(true)}>+ New Entry</button>
          <button className={`btn-refresh ${loading ? "spinning" : ""}`} onClick={() => loadRows(true)}>↻</button>
        </div>
      </header>

      <div className="filter-card">
        <div className="preset-row">
          {["day", "week", "custom"].map(p => (
            <button key={p} className={`preset-btn ${preset === p ? "active" : ""}`} onClick={() => setPreset(p)}>{p}</button>
          ))}
        </div>
        <div className="filter-grid">
          {preset === "custom" && (
            <><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></>
          )}
          <select value={storeId} onChange={e => setStoreId(e.target.value)}>
            <option value="all">All Stores</option>
            {STORES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={employeeUid} onChange={e => setEmployeeUid(e.target.value)}>
            <option value="all">All Staff</option>
            {staffList.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="timesheet-list">
        {loading ? <div className="loading-state">Syncing Firestore...</div> :
          timesheets.map(t => (
            <details key={t.id} className="timesheet-item" open={openEditorId === t.id}>
              <summary className="item-summary" onClick={(e) => { 
                e.preventDefault(); 
                const isClosing = openEditorId === t.id;
                setOpenEditorId(isClosing ? null : t.id); 
                if(!isClosing) setEdit({ 
                  auditStatus: t.auditStatus || "none", 
                  adminNote: t.adminNote || "", 
                  startInput: t.startInput || "", 
                  breakStartInput: t.breakStartInput || "", 
                  breakEndInput: t.breakEndInput || "", 
                  endInput: t.endInput || "" 
                }); 
              }}>
                <div className="info-main">
                  <span className="staff-name">{t.staffName}</span>
                  <span className="shift-meta">{t.date} • {storeLabel(t.storeId)}</span>
                </div>
                <div className="info-stats">
                  <div className="mini-stat"><span>Start</span><strong>{t.startInput || "--"}</strong></div>
                  <div className="mini-stat"><span>End</span><strong>{t.endInput || "--"}</strong></div>
                  <div className={`status-badge ${t.auditStatus}`}>{t.auditStatus || "pending"}</div>
                </div>
              </summary>

              <div className="item-details">
                <div className="editor-grid">
                  <div className="edit-col">
                    <label>Audit Status</label>
                    <select value={edit.auditStatus} onChange={e => setEdit({...edit, auditStatus: e.target.value})}>
                      <option value="none">Unmarked</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="approved">Approved</option>
                    </select>
                    <label>Notes</label>
                    <textarea value={edit.adminNote} onChange={e => setEdit({...edit, adminNote: e.target.value})} placeholder="Admin comments..." />
                  </div>
                  <div className="edit-col">
                    <div className="time-inputs">
                      <div><label>Start</label><input type="time" value={edit.startInput} onChange={e => setEdit({...edit, startInput: e.target.value})} /></div>
                      <div><label>Break Start</label><input type="time" value={edit.breakStartInput} onChange={e => setEdit({...edit, breakStartInput: e.target.value})} /></div>
                      <div><label>Break End</label><input type="time" value={edit.breakEndInput} onChange={e => setEdit({...edit, breakEndInput: e.target.value})} /></div>
                      <div><label>End</label><input type="time" value={edit.endInput} onChange={e => setEdit({...edit, endInput: e.target.value})} /></div>
                    </div>
                  </div>
                </div>
                <div className="actions">
                   <button className="btn-cancel" onClick={() => setOpenEditorId(null)}>Cancel</button>
                   <button className="btn-save" onClick={() => saveEditor(t)}>{savingId === t.id ? "..." : "Apply Changes"}</button>
                </div>
              </div>
            </details>
          ))
        }
      </div>

      {/* MODAL IS NOW INSIDE THE MAIN DIV */}
      {addOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-container animate-slide-up">
            <div className="modal-header">
              <h2>Add New Timesheet</h2>
              <button className="close-x" onClick={() => setAddOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Staff Member</label>
                <select className="app-input" value={addForm.uid} onChange={(e) => setAddForm({ ...addForm, uid: e.target.value })}>
                  <option value="all">Select Staff...</option>
                  {staffList.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid-2-col">
                <div className="input-group">
                  <label>Date</label>
                  <input type="date" className="app-input" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
                </div>
                <div className="input-group">
                  <label>Store</label>
                  <select className="app-input" value={addForm.storeId} onChange={(e) => setAddForm({ ...addForm, storeId: e.target.value })}>
                    {STORES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="time-grid-4">
                <div className="input-group"><label>Start</label><input type="time" value={addForm.startInput} onChange={(e) => setAddForm({ ...addForm, startInput: e.target.value })} /></div>
                <div className="input-group"><label>Break Start</label><input type="time" value={addForm.breakStartInput} onChange={(e) => setAddForm({ ...addForm, breakStartInput: e.target.value })} /></div>
                <div className="input-group"><label>Break End</label><input type="time" value={addForm.breakEndInput} onChange={(e) => setAddForm({ ...addForm, breakEndInput: e.target.value })} /></div>
                <div className="input-group"><label>End</label><input type="time" value={addForm.endInput} onChange={(e) => setAddForm({ ...addForm, endInput: e.target.value })} /></div>
              </div>
              <div className="input-group">
                <label>Admin Note (Optional)</label>
                <textarea placeholder="Reason for manual entry..." value={addForm.adminNote} onChange={(e) => setAddForm({ ...addForm, adminNote: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn-primary-large" onClick={createTimesheet} disabled={adding}>
                {adding ? "Creating..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}