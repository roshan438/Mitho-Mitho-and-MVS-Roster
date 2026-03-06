// import { useEffect, useMemo, useState } from "react";
// import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { toYMD } from "../../utils/dates";
// import "./AdminDashboard.css";

// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function fmtTime(ts) {
//   if (!ts?.toDate) return "-";
//   const d = ts.toDate();
//   return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// }

// function statusFromTimesheet(ts) {
//   if (!ts) return { label: "Not started", cls: "stNot" };
//   if (ts.endActual) return { label: "Completed", cls: "stDone" };
//   if (ts.breakStartActual && !ts.breakEndActual) return { label: "On break", cls: "stBreak" };
//   if (ts.startActual) return { label: "Working", cls: "stWork" };
//   return { label: "Not started", cls: "stNot" };
// }

// export default function AdminDashboard() {
//   const today = useMemo(() => toYMD(new Date()), []);
//   const [loading, setLoading] = useState(true);

//   const [storeFilter, setStoreFilter] = useState("all"); // all | storeId
//   const [search, setSearch] = useState("");

//   const [rosterToday, setRosterToday] = useState([]); // roster shifts
//   const [timesheetsToday, setTimesheetsToday] = useState([]); // timesheets docs
//   const [tsByUid, setTsByUid] = useState({}); // uid -> timesheet

//   useEffect(() => {
//     loadToday();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   async function loadToday() {
//     setLoading(true);

//     // 1) roster shifts today (across all rosterWeeks/*/shifts)
//     const rosterQ = query(collectionGroup(db, "shifts"), where("date", "==", today));
//     const rosterSnap = await getDocs(rosterQ);

//     let roster = rosterSnap.docs.map((d) => ({
//       id: d.id,
//       ...d.data(),
//     }));

//     // 2) timesheets today (for live status)
//     const tsQ = query(collection(db, "timesheets"), where("date", "==", today));
//     const tsSnap = await getDocs(tsQ);

//     const tsList = tsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
//     const map = {};
//     tsList.forEach((t) => {
//       if (t.uid) map[t.uid] = t;
//     });

//     setRosterToday(roster);
//     setTimesheetsToday(tsList);
//     setTsByUid(map);

//     setLoading(false);
//   }

//   const filteredRows = useMemo(() => {
//     let rows = rosterToday;

//     if (storeFilter !== "all") {
//       rows = rows.filter((r) => r.storeId === storeFilter);
//     }

//     const q = search.trim().toLowerCase();
//     if (q) {
//       rows = rows.filter((r) => {
//         const name = (r.staffName || "").toLowerCase();
//         const uid = (r.uid || "").toLowerCase();
//         return name.includes(q) || uid.includes(q);
//       });
//     }

//     // attach timesheet + status
//     const withStatus = rows.map((r) => {
//       const ts = tsByUid[r.uid] || null;
//       const st = statusFromTimesheet(ts);
//       return {
//         ...r,
//         ts,
//         statusLabel: st.label,
//         statusCls: st.cls,
//       };
//     });

//     // sort by store then time then name
//     withStatus.sort((a, b) => {
//       const sa = a.storeId || "";
//       const sb = b.storeId || "";
//       if (sa !== sb) return sa.localeCompare(sb);

//       const ta = a.startPlanned || "";
//       const tb = b.startPlanned || "";
//       if (ta !== tb) return ta.localeCompare(tb);

//       return (a.staffName || "").localeCompare(b.staffName || "");
//     });

//     return withStatus;
//   }, [rosterToday, storeFilter, search, tsByUid]);

//   const stats = useMemo(() => {
//     const rostered = filteredRows.length;

//     let notStarted = 0;
//     let working = 0;
//     let onBreak = 0;
//     let done = 0;

//     filteredRows.forEach((r) => {
//       const ts = r.ts;
//       if (!ts) notStarted++;
//       else if (ts.endActual) done++;
//       else if (ts.breakStartActual && !ts.breakEndActual) onBreak++;
//       else if (ts.startActual) working++;
//       else notStarted++;
//     });

//     return { rostered, notStarted, working, onBreak, done };
//   }, [filteredRows]);

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="top">
//           <div>
//             <h1 className="h1">Admin — Dashboard</h1>
//             <p className="p">
//               Today: <b>{today}</b> • Live clock status from timesheets
//             </p>
//           </div>

//           <button className="btn" onClick={loadToday}>
//             Refresh
//           </button>
//         </div>

//         <div className="spacer" />

//         <div className="controls">
//           <div className="field">
//             <div className="label">Store</div>
//             <select className="input" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
//               <option value="all">All stores</option>
//               {STORES.map((s) => (
//                 <option key={s.id} value={s.id}>
//                   {s.label}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="field grow">
//             <div className="label">Search staff</div>
//             <input
//               className="input"
//               placeholder="Type a name…"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>
//         </div>

//         <div className="spacer" />

//         <div className="stats">
//           <div className="statCard">
//             <div className="statLabel">Rostered</div>
//             <div className="statValue">{stats.rostered}</div>
//           </div>
//           <div className="statCard">
//             <div className="statLabel">Not started</div>
//             <div className="statValue">{stats.notStarted}</div>
//           </div>
//           <div className="statCard">
//             <div className="statLabel">Working</div>
//             <div className="statValue">{stats.working}</div>
//           </div>
//           <div className="statCard">
//             <div className="statLabel">On break</div>
//             <div className="statValue">{stats.onBreak}</div>
//           </div>
//           <div className="statCard">
//             <div className="statLabel">Completed</div>
//             <div className="statValue">{stats.done}</div>
//           </div>
//         </div>

//         <div className="spacer" />

//         {loading ? (
//           <div className="empty">Loading…</div>
//         ) : filteredRows.length === 0 ? (
//           <div className="empty">No roster shifts found for today (and this filter).</div>
//         ) : (
//           <div className="table">
//             <div className="thead">
//               <div>Store</div>
//               <div>Staff</div>
//               <div>Planned</div>
//               <div>Status</div>
//               <div>Actual</div>
//             </div>

//             {filteredRows.map((r) => {
//               const ts = r.ts;

//               const actualText = !ts
//                 ? "-"
//                 : `${fmtTime(ts.startActual)} → ${fmtTime(ts.endActual)} ${
//                     ts.breakStartActual && ts.breakEndActual ? "(break taken)" : ""
//                   }`;

//               return (
//                 <div key={`${r.id}_${r.uid}_${r.date}`} className="trow">
//                   <div className="cell store">
//                     <div className="lbl">Store</div>
//                     <div className="val strong">{storeLabel(r.storeId)}</div>
//                   </div>

//                   <div className="cell staff">
//                     <div className="lbl">Staff</div>
//                     <div className="val">
//                       <div className="strong">{r.staffName || r.uid || "—"}</div>
//                     </div>
//                   </div>

//                   <div className="cell planned">
//                     <div className="lbl">Planned</div>
//                     <div className="val mono">
//                       {r.startPlanned || "--:--"} – {r.endPlanned || "--:--"}
//                     </div>
//                   </div>

//                   <div className="cell status">
//                     <div className="lbl">Status</div>
//                     <div className="val">
//                       <span className={`badge ${r.statusCls}`}>{r.statusLabel}</span>
//                     </div>
//                   </div>

//                   <div className="cell actual">
//                     <div className="lbl">Actual</div>
//                     <div className="val mono">{actualText}</div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}

//         <div className="spacer" />
//         <div className="hint">
//           Note: “Actual” times come from button press timestamps (serverTimestamp). Pay uses input times (Payroll page).
//         </div>
//       </div>
//     </div>
//   );
// }















// import { useEffect, useMemo, useState, useCallback } from "react";
// import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { toYMD } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext"; // Import Toast Hook
// import "./AdminDashboard.css";

// const storeLabel = (storeId) => STORES.find((s) => s.id === storeId)?.label || storeId || "-";

// const fmtTime = (ts) => {
//   if (!ts?.toDate) return "-";
//   const d = ts.toDate();
//   return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// };

// const statusFromTimesheet = (ts) => {
//   if (!ts) return { label: "Absent", cls: "stNot" };
//   if (ts.endActual) return { label: "Finished", cls: "stDone" };
//   if (ts.breakStartActual && !ts.breakEndActual) return { label: "On Break", cls: "stBreak" };
//   if (ts.startActual) return { label: "Clocked In", cls: "stWork" };
//   return { label: "Absent", cls: "stNot" };
// };

// export default function AdminDashboard() {
//   const { showToast } = useToast(); // Initialize Toast
//   const today = useMemo(() => toYMD(new Date()), []);
//   const [loading, setLoading] = useState(true);
//   const [storeFilter, setStoreFilter] = useState("all");
//   const [search, setSearch] = useState("");
//   const [rosterToday, setRosterToday] = useState([]);
//   const [tsByUid, setTsByUid] = useState({});

//   const loadToday = useCallback(async () => {
//     setLoading(true);
//     try {
//       const rosterQ = query(collectionGroup(db, "shifts"), where("date", "==", today));
//       const rosterSnap = await getDocs(rosterQ);
//       const roster = rosterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       const tsQ = query(collection(db, "timesheets"), where("date", "==", today));
//       const tsSnap = await getDocs(tsQ);
//       const map = {};
//       tsSnap.docs.forEach((d) => {
//         const data = d.data();
//         if (data.uid) map[data.uid] = data;
//       });

//       setRosterToday(roster);
//       setTsByUid(map);
      
//       // Success feedback
//       // showToast("Data synced successfully", "success"); this line makes hang
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to sync dashboard data", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [today]);

//   useEffect(() => {
//     loadToday();
//   }, [loadToday]);

//   const filteredRows = useMemo(() => {
//     let rows = rosterToday;
//     if (storeFilter !== "all") rows = rows.filter((r) => r.storeId === storeFilter);
//     const q = search.trim().toLowerCase();
//     if (q) {
//       rows = rows.filter((r) => (r.staffName || "").toLowerCase().includes(q) || (r.uid || "").toLowerCase().includes(q));
//     }
//     return rows.map((r) => {
//       const ts = tsByUid[r.uid] || null;
//       const st = statusFromTimesheet(ts);
//       return { ...r, ts, statusLabel: st.label, statusCls: st.cls };
//     }).sort((a, b) => (a.storeId || "").localeCompare(b.storeId || "") || (a.startPlanned || "").localeCompare(b.startPlanned || ""));
//   }, [rosterToday, storeFilter, search, tsByUid]);

//   const stats = useMemo(() => {
//     const s = { rostered: filteredRows.length, notStarted: 0, working: 0, onBreak: 0, done: 0 };
//     filteredRows.forEach((r) => {
//       if (!r.ts) s.notStarted++;
//       else if (r.ts.endActual) s.done++;
//       else if (r.ts.breakStartActual && !r.ts.breakEndActual) s.onBreak++;
//       else if (r.ts.startActual) s.working++;
//     });
//     return s;
//   }, [filteredRows]);

//   return (
//     <div className="admin-wrapper">
//       <header className="admin-header">
//         <div className="title-area">
//           <h1 className="main-title">Live Dashboard</h1>
//           <p className="subtitle">Real-time status for <b>{today}</b></p>
//         </div>
//         <button className={`refresh-pill ${loading ? 'spinning' : ''}`} onClick={loadToday}>
//           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//           Sync
//         </button>
//       </header>

//       <section className="admin-stats-grid">
//         <div className="admin-stat-card"><span>Rostered</span><strong>{stats.rostered}</strong></div>
//         <div className="admin-stat-card warning"><span>Absent</span><strong>{stats.notStarted}</strong></div>
//         <div className="admin-stat-card success"><span>Working</span><strong>{stats.working}</strong></div>
//         <div className="admin-stat-card break"><span>On Break</span><strong>{stats.onBreak}</strong></div>
//         <div className="admin-stat-card blue"><span>Done</span><strong>{stats.done}</strong></div>
//       </section>

//       <section className="admin-filters">
//         <select className="admin-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
//           <option value="all">All Stores</option>
//           {STORES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
//         </select>
//         <div className="search-box">
//           <input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
//         </div>
//       </section>

//       <div className="admin-table-container">
//         {loading ? (
//           <div className="loader-inline"><div className="spinner" /></div>
//         ) : filteredRows.length === 0 ? (
//           <div className="empty-state">No shifts found for today.</div>
//         ) : (
//           <div className="admin-list">
//             {filteredRows.map((r) => (
//               <div key={r.id} className="admin-row-card">
//                 <div className="row-main">
//                   <div className="staff-info">
//                     <span className="store-tag-small">{storeLabel(r.storeId)}</span>
//                     <span className="staff-name">{r.staffName || "Unknown"}</span>
//                   </div>
//                   <div className={`status-badge ${r.statusCls}`}>{r.statusLabel}</div>
//                 </div>
//                 <div className="row-details">
//                   <div className="detail-item"><label>Planned</label><span>{r.startPlanned} - {r.endPlanned}</span></div>
//                   <div className="detail-item"><label>Actual In</label><span>{fmtTime(r.ts?.startActual)}</span></div>
//                   <div className="detail-item"><label>Actual Out</label><span>{fmtTime(r.ts?.endActual)}</span></div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }









// import { useEffect, useMemo, useState, useCallback } from "react";
// import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { toYMD } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import "./AdminDashboard.css";

// const storeLabel = (storeId) => STORES.find((s) => s.id === storeId)?.label || storeId || "-";

// const fmtTime = (ts) => {
//   if (!ts?.toDate) return "-";
//   const d = ts.toDate();
//   return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// };

// const statusFromTimesheet = (ts) => {
//   if (!ts) return { label: "Absent", cls: "stNot" };
//   if (ts.endActual) return { label: "Finished", cls: "stDone" };
//   if (ts.breakStartActual && !ts.breakEndActual) return { label: "On Break", cls: "stBreak" };
//   if (ts.startActual) return { label: "Clocked In", cls: "stWork" };
//   return { label: "Absent", cls: "stNot" };
// };

// export default function AdminDashboard() {
//   const { showToast } = useToast();
//   const today = useMemo(() => toYMD(new Date()), []);
//   const [loading, setLoading] = useState(true);
//   const [storeFilter, setStoreFilter] = useState("all");
//   const [search, setSearch] = useState("");
//   const [rosterToday, setRosterToday] = useState([]);
//   const [tsByUid, setTsByUid] = useState({});

//   // ✅ FIX: toast only on manual refresh to avoid “hang”
//   const loadToday = useCallback(
//     async (manual = false) => {
//       setLoading(true);
//       try {
//         const rosterQ = query(collectionGroup(db, "shifts"), where("date", "==", today));
//         const rosterSnap = await getDocs(rosterQ);
//         const roster = rosterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

//         const tsQ = query(collection(db, "timesheets"), where("date", "==", today));
//         const tsSnap = await getDocs(tsQ);
//         const map = {};
//         tsSnap.docs.forEach((d) => {
//           const data = d.data();
//           if (data.uid) map[data.uid] = data;
//         });

//         setRosterToday(roster);
//         setTsByUid(map);

//         if (manual) showToast("Data synced successfully", "success");
//       } catch (e) {
//         console.error(e);
//         showToast("Failed to sync dashboard data", "error");
//       } finally {
//         setLoading(false);
//       }
//     },
//     [today, showToast]
//   );

//   useEffect(() => {
//     loadToday(false); // auto load without toast
//   }, [loadToday]);

//   const filteredRows = useMemo(() => {
//     let rows = rosterToday;
//     if (storeFilter !== "all") rows = rows.filter((r) => r.storeId === storeFilter);
//     const q = search.trim().toLowerCase();
//     if (q) {
//       rows = rows.filter(
//         (r) =>
//           (r.staffName || "").toLowerCase().includes(q) ||
//           (r.uid || "").toLowerCase().includes(q)
//       );
//     }

//     return rows
//       .map((r) => {
//         const ts = tsByUid[r.uid] || null;
//         const st = statusFromTimesheet(ts);
//         return { ...r, ts, statusLabel: st.label, statusCls: st.cls };
//       })
//       .sort(
//         (a, b) =>
//           (a.storeId || "").localeCompare(b.storeId || "") ||
//           (a.startPlanned || "").localeCompare(b.startPlanned || "")
//       );
//   }, [rosterToday, storeFilter, search, tsByUid]);

//   const stats = useMemo(() => {
//     const s = { rostered: filteredRows.length, notStarted: 0, working: 0, onBreak: 0, done: 0 };
//     filteredRows.forEach((r) => {
//       if (!r.ts) s.notStarted++;
//       else if (r.ts.endActual) s.done++;
//       else if (r.ts.breakStartActual && !r.ts.breakEndActual) s.onBreak++;
//       else if (r.ts.startActual) s.working++;
//     });
//     return s;
//   }, [filteredRows]);

//   return (
//     <div className="admin-wrapper">
//       <header className="admin-header">
//         <div className="title-area">
//           <h1 className="main-title">Live Dashboard</h1>
//           <p className="subtitle">
//             Real-time status for <b>{today}</b>
//           </p>
//         </div>

//         {/* ✅ no classname changes; just changed onClick */}
//         <button
//           className={`refresh-pill ${loading ? "spinning" : ""}`}
//           onClick={() => loadToday(true)}
//           disabled={loading}
//         >
//           <svg
//             width="18"
//             height="18"
//             viewBox="0 0 24 24"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="2.5"
//           >
//             <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//           </svg>
//           Sync
//         </button>
//       </header>

//       <section className="admin-stats-grid">
//         <div className="admin-stat-card">
//           <span>Rostered</span>
//           <strong>{stats.rostered}</strong>
//         </div>
//         <div className="admin-stat-card warning">
//           <span>Absent</span>
//           <strong>{stats.notStarted}</strong>
//         </div>
//         <div className="admin-stat-card success">
//           <span>Working</span>
//           <strong>{stats.working}</strong>
//         </div>
//         <div className="admin-stat-card break">
//           <span>On Break</span>
//           <strong>{stats.onBreak}</strong>
//         </div>
//         <div className="admin-stat-card blue">
//           <span>Done</span>
//           <strong>{stats.done}</strong>
//         </div>
//       </section>

//       <section className="admin-filters">
//         <select
//           className="admin-select"
//           value={storeFilter}
//           onChange={(e) => setStoreFilter(e.target.value)}
//         >
//           <option value="all">All Stores</option>
//           {STORES.map((s) => (
//             <option key={s.id} value={s.id}>
//               {s.label}
//             </option>
//           ))}
//         </select>

//         <div className="search-box">
//           <input
//             placeholder="Search staff..."
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//         </div>
//       </section>

//       <div className="admin-table-container">
//         {loading ? (
//           <div className="loader-inline">
//             <div className="spinner" />
//           </div>
//         ) : filteredRows.length === 0 ? (
//           <div className="empty-state">No shifts found for today.</div>
//         ) : (
//           <div className="admin-list">
//             {filteredRows.map((r) => (
//               <div key={r.id} className="admin-row-card">
//                 <div className="row-main">
//                   <div className="staff-info">
//                     <span className="store-tag-small">{storeLabel(r.storeId)}</span>
//                     <span className="staff-name">{r.staffName || "Unknown"}</span>
//                   </div>
//                   <div className={`status-badge ${r.statusCls}`}>{r.statusLabel}</div>
//                 </div>

//                 <div className="row-details">
//                   <div className="detail-item">
//                     <label>Planned</label>
//                     <span>
//                       {r.startPlanned} - {r.endPlanned}
//                     </span>
//                   </div>
//                   <div className="detail-item">
//                     <label>Actual In</label>
//                     <span>{fmtTime(r.ts?.startActual)}</span>
//                   </div>
//                   <div className="detail-item">
//                     <label>Actual Out</label>
//                     <span>{fmtTime(r.ts?.endActual)}</span>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }






















import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
import { useStores } from "../../hooks/useStore";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import { useNavigate } from "react-router-dom"; // ✅ Added for navigation
import "./AdminDashboard.css";


const fmtTime = (ts) => {
  if (!ts?.toDate) return "-";
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const statusFromTimesheet = (ts) => {
  if (!ts) return { label: "Absent", cls: "stNot" };
  if (ts.endActual) return { label: "Finished", cls: "stDone" };
  if (ts.breakStartActual && !ts.breakEndActual) return { label: "On Break", cls: "stBreak" };
  if (ts.startActual) return { label: "Clocked In", cls: "stWork" };
  return { label: "Absent", cls: "stNot" };
};

export default function AdminDashboard() {
  const { showToast } = useToast();
  const navigate = useNavigate(); // ✅ Hook for moving to Stock Manager
  const { stores, getStoreLabel } = useStores();
  const today = useMemo(() => toYMD(new Date()), []);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rosterToday, setRosterToday] = useState([]);
  const [tsByUid, setTsByUid] = useState({});
  
  // ✅ NEW: Stock States
  const [dailyStocks, setDailyStocks] = useState([]);

  const loadToday = useCallback(
    async (manual = false) => {
      setLoading(true);
      try {
        // 1. Load Roster
        const rosterQ = query(collectionGroup(db, "shifts"), where("date", "==", today));
        const rosterSnap = await getDocs(rosterQ);
        const roster = rosterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 2. Load Timesheets
        const tsQ = query(collection(db, "timesheets"), where("date", "==", today));
        const tsSnap = await getDocs(tsQ);
        const map = {};
        tsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.uid) map[data.uid] = data;
        });

        // 3. ✅ Load Stock Submissions for Today
        const stockQ = query(collection(db, "dailyStockTake"), where("date", "==", today));
        const stockSnap = await getDocs(stockQ);
        const stocks = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setRosterToday(roster);
        setTsByUid(map);
        setDailyStocks(stocks);

        if (manual) showToast("Data synced successfully", "success");
      } catch (e) {
        console.error(e);
        showToast("Failed to sync dashboard data", "error");
      } finally {
        setLoading(false);
      }
    },
    [today, showToast]
  );

  useEffect(() => {
    loadToday(false);
  }, [loadToday]);

  const filteredRows = useMemo(() => {
    let rows = rosterToday;
    if (storeFilter !== "all") rows = rows.filter((r) => r.storeId === storeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.staffName || "").toLowerCase().includes(q) ||
          (r.uid || "").toLowerCase().includes(q)
      );
    }
    return rows
      .map((r) => {
        const ts = tsByUid[r.uid] || null;
        const st = statusFromTimesheet(ts);
        return { ...r, ts, statusLabel: st.label, statusCls: st.cls };
      })
      .sort((a, b) => (a.storeId || "").localeCompare(b.storeId || "") || (a.startPlanned || "").localeCompare(b.startPlanned || ""));
  }, [rosterToday, storeFilter, search, tsByUid]);

  const stats = useMemo(() => {
    const s = { rostered: filteredRows.length, notStarted: 0, working: 0, onBreak: 0, done: 0 };
    filteredRows.forEach((r) => {
      if (!r.ts) s.notStarted++;
      else if (r.ts.endActual) s.done++;
      else if (r.ts.breakStartActual && !r.ts.breakEndActual) s.onBreak++;
      else if (r.ts.startActual) s.working++;
    });
    return s;
  }, [filteredRows]);

  // ✅ Computed: Pending stocks count
  const pendingStockCount = useMemo(() => {
      return dailyStocks.filter(s => !s.adminProcessed).length;
  }, [dailyStocks]);

  return (
    <div className="admin-wrapper">
      <header className="admin-header">
        <div className="title-area">
          <h1 className="main-title">Live Dashboard</h1>
          <p className="subtitle">Real-time status for <b>{today}</b></p>
        </div>

        <button className={`refresh-pill ${loading ? "spinning" : ""}`} onClick={() => loadToday(true)} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
          Sync
        </button>
      </header>

      <section className="admin-stats-grid">
        <div className="admin-stat-card"><span>Rostered</span><strong>{stats.rostered}</strong></div>
        <div className="admin-stat-card warning"><span>Absent</span><strong>{stats.notStarted}</strong></div>
        <div className="admin-stat-card success"><span>Working</span><strong>{stats.working}</strong></div>
        <div className="admin-stat-card break"><span>On Break</span><strong>{stats.onBreak}</strong></div>
        <div className="admin-stat-card blue"><span>Done</span><strong>{stats.done}</strong></div>
      </section>

      {/* ✅ NEW SECTION: Stock Submission Alerts */}
      <section className="stock-alerts-section">
        <div className="stock-alert-header">
            <h3>Stock Submission Alerts</h3>
            <button className="view-manager-btn" onClick={() => navigate("/admin/stock-manager")}>
                Manage All Stock &rarr;
            </button>
        </div>
        <div className="stock-alert-grid">
            {dailyStocks.length === 0 ? (
                <div className="no-stock-msg">No stock requests submitted today yet.</div>
            ) : (
                dailyStocks.map(stock => (
                    <div 
                        key={stock.id} 
                        className={`stock-alert-pill ${stock.adminProcessed ? 'is-processed' : 'is-pending'}`}
                        onClick={() => navigate("/admin/stock-manager")}
                    >
                        <span className="stock-shop">{stock.storeLabel}</span>
                        <span className="stock-status">
                            {stock.adminProcessed ? "Processed" : "New Request"}
                        </span>
                    </div>
                ))
            )}
        </div>
      </section>

      <section className="admin-filters">
        <select className="admin-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="all">All Stores</option>
          {stores.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
        </select>

        <div className="search-box">
          <input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </section>

      <div className="admin-table-container">
        {loading ? (
          <div className="loader-inline"><div className="spinner" /></div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">No shifts found for today.</div>
        ) : (
          <div className="admin-list">
            {filteredRows.map((r) => (
              <div key={r.id} className="admin-row-card">
                <div className="row-main">
                  <div className="staff-info">
                    <span className="store-tag-small">{getStoreLabel(r.storeId)}</span>
                    <span className="staff-name">{r.staffName || "Unknown"}</span>
                  </div>
                  <div className={`status-badge ${r.statusCls}`}>{r.statusLabel}</div>
                </div>

                <div className="row-details">
                  <div className="detail-item"><label>Planned</label><span>{r.startPlanned} - {r.endPlanned}</span></div>
                  <div className="detail-item"><label>Actual In</label><span>{fmtTime(r.ts?.startActual)}</span></div>
                  <div className="detail-item"><label>Actual Out</label><span>{fmtTime(r.ts?.endActual)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}