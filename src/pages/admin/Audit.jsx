// import { useEffect, useMemo, useState } from "react";
// import {
//   collection,
//   doc,
//   getDocs,
//   query,
//   where,
//   documentId,
//   updateDoc,
//   serverTimestamp,
//   Timestamp,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider"; // adjust path if needed
// import "./Audit.css";

// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function chunk(arr, size) {
//   const out = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
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
//   if (diff < 0) diff += 24 * 60;
//   return Math.max(0, diff);
// }

// function tsToLocalInput(ts) {
//   if (!ts?.toDate) return "";
//   const d = ts.toDate();
//   const pad = (n) => String(n).padStart(2, "0");
//   const yyyy = d.getFullYear();
//   const mm = pad(d.getMonth() + 1);
//   const dd = pad(d.getDate());
//   const hh = pad(d.getHours());
//   const mi = pad(d.getMinutes());
//   return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
// }

// function localInputToTimestamp(v) {
//   if (!v) return null;
//   const d = new Date(v);
//   if (Number.isNaN(d.getTime())) return null;
//   return Timestamp.fromDate(d);
// }

// export default function Audit() {
//   const { fbUser } = useAuth();

//   // filters
//   const [preset, setPreset] = useState("week"); // day | week | custom
//   const [dateFrom, setDateFrom] = useState(toYMD(getWeekStartMonday(new Date())));
//   const [dateTo, setDateTo] = useState(toYMD(addDays(getWeekStartMonday(new Date()), 7))); // exclusive
//   const [storeId, setStoreId] = useState("all");
//   const [employeeUid, setEmployeeUid] = useState("all");
//   const [threshold, setThreshold] = useState(10);

//   // data
//   const [loading, setLoading] = useState(true);
//   const [timesheets, setTimesheets] = useState([]);
//   const [staffList, setStaffList] = useState([]);
//   const [staffByUid, setStaffByUid] = useState({});

//   // UI state
//   const [openEditorId, setOpenEditorId] = useState(null);
//   const [savingId, setSavingId] = useState(null);
//   const [edit, setEdit] = useState({
//     auditStatus: "none",
//     adminNote: "",
//     // datetime-local strings for overrides
//     start: "",
//     breakStart: "",
//     breakEnd: "",
//     end: "",
//   });

//   useEffect(() => {
//     loadStaffList();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     applyPreset(preset);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [preset]);

//   useEffect(() => {
//     loadAudit();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [dateFrom, dateTo, storeId, employeeUid, threshold]);

//   function applyPreset(p) {
//     const now = new Date();
//     if (p === "day") {
//       setDateFrom(toYMD(now));
//       setDateTo(toYMD(addDays(now, 1)));
//     }
//     if (p === "week") {
//       const ws = getWeekStartMonday(now);
//       setDateFrom(toYMD(ws));
//       setDateTo(toYMD(addDays(ws, 7)));
//     }
//   }

//   async function loadStaffList() {
//     const qs = query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"));
//     const snap = await getDocs(qs);

//     const list = snap.docs
//       .map((d) => {
//         const data = d.data();
//         const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.email || d.id;
//         return { uid: d.id, name };
//       })
//       .sort((a, b) => a.name.localeCompare(b.name));

//     const map = {};
//     list.forEach((x) => (map[x.uid] = x.name));

//     setStaffList(list);
//     setStaffByUid(map);
//   }

//   async function ensureNamesForUids(uids) {
//     const missing = Array.from(new Set(uids)).filter((u) => u && !staffByUid[u]);
//     if (missing.length === 0) return staffByUid;

//     const map = { ...staffByUid };
//     const chunks = chunk(missing, 10);

//     for (const c of chunks) {
//       const qUsers = query(collection(db, "users"), where(documentId(), "in", c));
//       const snap = await getDocs(qUsers);
//       snap.docs.forEach((d) => {
//         const data = d.data();
//         map[d.id] = `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.email || d.id;
//       });
//     }

//     setStaffByUid(map);
//     return map;
//   }

//   function effectiveActual(t, key) {
//     // key: startActual | breakStartActual | breakEndActual | endActual
//     const ov = t.actualOverrides?.[key];
//     return ov || t[key] || null;
//   }

//   async function loadAudit() {
//     setLoading(true);

//     let qTs = query(collection(db, "timesheets"), where("date", ">=", dateFrom), where("date", "<", dateTo));

//     if (employeeUid !== "all") {
//       qTs = query(
//         collection(db, "timesheets"),
//         where("uid", "==", employeeUid),
//         where("date", ">=", dateFrom),
//         where("date", "<", dateTo)
//       );
//     }

//     const snap = await getDocs(qTs);
//     let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

//     if (storeId !== "all") list = list.filter((x) => x.storeId === storeId);

//     const map = await ensureNamesForUids(list.map((x) => x.uid));

//     list = list
//       .map((t) => {
//         const effStart = effectiveActual(t, "startActual");
//         const effBreakStart = effectiveActual(t, "breakStartActual");
//         const effBreakEnd = effectiveActual(t, "breakEndActual");
//         const effEnd = effectiveActual(t, "endActual");

//         const breakMinutes = minutesBetween(effBreakStart, effBreakEnd);
//         const breakInputMinutes = inputBreakMinutes(t.breakStartInput, t.breakEndInput);

//         return {
//           ...t,
//           staffName: map[t.uid] || t.staffName || t.uid || "Unknown",

//           // effective displayed values
//           startActualFmt: fmtTime(effStart),
//           breakMinutes,
//           endActualFmt: fmtTime(effEnd),

//           // for editor
//           effStart,
//           effBreakStart,
//           effBreakEnd,
//           effEnd,

//           breakInputMinutes,
//           auditStatus: t.auditStatus || "none",
//           adminNote: t.adminNote || "",
//         };
//       })
//       .sort((a, b) => (a.date + a.staffName).localeCompare(b.date + b.staffName));

//     setTimesheets(list);
//     setLoading(false);
//   }

//   const summary = useMemo(() => {
//     const total = timesheets.length;
//     const withClockOff = timesheets.filter((t) => t.effEnd).length;
//     return { total, withClockOff };
//   }, [timesheets]);

//   function openEditor(t) {
//     setOpenEditorId(t.id);

//     // prefill editor with current status + note + effective actual values
//     setEdit({
//       auditStatus: t.auditStatus || "none",
//       adminNote: t.adminNote || "",
//       start: tsToLocalInput(t.effStart),
//       breakStart: tsToLocalInput(t.effBreakStart),
//       breakEnd: tsToLocalInput(t.effBreakEnd),
//       end: tsToLocalInput(t.effEnd),
//     });
//   }

//   function closeEditor() {
//     setOpenEditorId(null);
//     setSavingId(null);
//   }

//   async function saveEditor(t) {
//     if (!fbUser?.uid) {
//       alert("You must be logged in as admin.");
//       return;
//     }

//     setSavingId(t.id);

//     const startTs = localInputToTimestamp(edit.start);
//     const breakStartTs = localInputToTimestamp(edit.breakStart);
//     const breakEndTs = localInputToTimestamp(edit.breakEnd);
//     const endTs = localInputToTimestamp(edit.end);

//     // basic sanity checks
//     if (breakStartTs && !startTs) {
//       alert("If Break start is set, please set Clock on time too.");
//       setSavingId(null);
//       return;
//     }
//     if (breakEndTs && !breakStartTs) {
//       alert("Break end needs Break start.");
//       setSavingId(null);
//       return;
//     }

//     const patch = {
//       auditStatus: edit.auditStatus || "none",
//       adminNote: edit.adminNote || "",
//       auditUpdatedAt: serverTimestamp(),
//       auditUpdatedBy: fbUser.uid,
//       actualOverrides: {
//         startActual: startTs,
//         breakStartActual: breakStartTs,
//         breakEndActual: breakEndTs,
//         endActual: endTs,
//       },
//     };

//     // allow "clear override" by emptying all actual fields:
//     const allEmpty = !startTs && !breakStartTs && !breakEndTs && !endTs;
//     if (allEmpty) {
//       patch.actualOverrides = {}; // clears overrides
//     }

//     await updateDoc(doc(db, "timesheets", t.id), patch);

//     await loadAudit();
//     setSavingId(null);
//     closeEditor();
//   }

//   function statusChip(status) {
//     if (status === "approved") return <span className="chip ok">Approved</span>;
//     if (status === "reviewed") return <span className="chip warn">Reviewed</span>;
//     return <span className="chip">Unmarked</span>;
//   }

//   return (
//     <div className="container">
//       <div className="card audit">
//         <div className="auditTop">
//           <div>
//             <h1 className="h1">Audit</h1>
//             <p className="p subtle">
//               Actual = button press timestamps (or admin override). Input = staff typed.
//             </p>
//           </div>

//           <button className="btn" onClick={loadAudit}>
//             Refresh
//           </button>
//         </div>

//         <div className="auditFilters">
//           <div className="seg">
//             {["day", "week", "custom"].map((p) => (
//               <button key={p} className={`segBtn ${preset === p ? "segActive" : ""}`} onClick={() => setPreset(p)}>
//                 {p.toUpperCase()}
//               </button>
//             ))}
//           </div>

//           <div className="grid">
//             <div className="field">
//               <div className="label">From</div>
//               <input
//                 className="input"
//                 type="date"
//                 value={dateFrom}
//                 onChange={(e) => {
//                   setPreset("custom");
//                   setDateFrom(e.target.value);
//                 }}
//               />
//             </div>

//             <div className="field">
//               <div className="label">To</div>
//               <input
//                 className="input"
//                 type="date"
//                 value={dateTo}
//                 onChange={(e) => {
//                   setPreset("custom");
//                   setDateTo(e.target.value);
//                 }}
//               />
//               <div className="tiny subtle">Exclusive</div>
//             </div>

//             <div className="field">
//               <div className="label">Store</div>
//               <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
//                 <option value="all">All stores</option>
//                 {STORES.map((s) => (
//                   <option key={s.id} value={s.id}>
//                     {s.label}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="field">
//               <div className="label">Employee</div>
//               <select className="input" value={employeeUid} onChange={(e) => setEmployeeUid(e.target.value)}>
//                 <option value="all">All employees</option>
//                 {staffList.map((s) => (
//                   <option key={s.uid} value={s.uid}>
//                     {s.name}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="field">
//               <div className="label">Highlight mins</div>
//               <input
//                 className="input"
//                 type="number"
//                 min="1"
//                 value={threshold}
//                 onChange={(e) => setThreshold(Number(e.target.value || 10))}
//               />
//             </div>
//           </div>
//         </div>

//         <div className="auditStats">
//           <div className="stat">
//             <div className="statLabel">Rows</div>
//             <div className="statValue">{summary.total}</div>
//           </div>
//           <div className="stat">
//             <div className="statLabel">Completed</div>
//             <div className="statValue warn">{summary.withClockOff}</div>
//           </div>
//         </div>

//         {loading ? (
//           <div className="empty">Loading…</div>
//         ) : timesheets.length === 0 ? (
//           <div className="empty">No timesheets found.</div>
//         ) : (
//           <>
//             {/* DESKTOP TABLE */}
//             <div className="auditDesktop">
//               <div className="thead">
//                 <div>Date</div>
//                 <div>Staff</div>
//                 <div>Store</div>
//                 <div>Clock on</div>
//                 <div>Break</div>
//                 <div>Clock off</div>
//                 <div>Status</div>
//                 <div></div>
//               </div>

//               {timesheets.map((t) => (
//                 <div key={t.id} className="trow">
//                   <div className="mono">{t.date}</div>
//                   <div className="strong">{t.staffName}</div>
//                   <div className="storeCell">{storeLabel(t.storeId)}</div>

//                   <div className="cell">
//                     <div className="big">{t.startActualFmt}</div>
//                     <div className="small">input {t.startInput || "-"}</div>
//                   </div>

//                   <div className="cell">
//                     <div className="big">{t.breakMinutes != null ? `${t.breakMinutes} min` : "No break"}</div>
//                     <div className="small">
//                       input {t.breakInputMinutes != null ? `${t.breakInputMinutes} min` : "-"}
//                     </div>
//                   </div>

//                   <div className="cell">
//                     <div className="big">{t.endActualFmt}</div>
//                     <div className="small">input {t.endInput || "-"}</div>
//                   </div>

//                   <div className="cell">{statusChip(t.auditStatus)}</div>

//                   <div className="cell actions">
//                     <button className="btn" onClick={() => openEditor(t)}>
//                       Edit
//                     </button>
//                   </div>

//                   {openEditorId === t.id && (
//                     <div className="editorRow">
//                       <div className="editor">
//                         <div className="editorHeader">
//                           <div className="strong">Edit audit</div>
//                           <button className="btn" onClick={closeEditor}>
//                             Close
//                           </button>
//                         </div>

//                         <div className="editorGrid">
//                           <div className="field">
//                             <div className="label">Status</div>
//                             <select
//                               className="input"
//                               value={edit.auditStatus}
//                               onChange={(e) => setEdit((p) => ({ ...p, auditStatus: e.target.value }))}
//                             >
//                               <option value="none">Unmarked</option>
//                               <option value="reviewed">Reviewed</option>
//                               <option value="approved">Approved</option>
//                             </select>
//                           </div>

//                           <div className="field span2">
//                             <div className="label">Admin note</div>
//                             <textarea
//                               className="input textarea"
//                               value={edit.adminNote}
//                               placeholder="Add note (optional)…"
//                               onChange={(e) => setEdit((p) => ({ ...p, adminNote: e.target.value }))}
//                             />
//                           </div>

//                           <div className="field">
//                             <div className="label">Clock on (actual override)</div>
//                             <input
//                               className="input"
//                               type="datetime-local"
//                               value={edit.start}
//                               onChange={(e) => setEdit((p) => ({ ...p, start: e.target.value }))}
//                             />
//                           </div>

//                           <div className="field">
//                             <div className="label">Break start (override)</div>
//                             <input
//                               className="input"
//                               type="datetime-local"
//                               value={edit.breakStart}
//                               onChange={(e) => setEdit((p) => ({ ...p, breakStart: e.target.value }))}
//                             />
//                           </div>

//                           <div className="field">
//                             <div className="label">Break end (override)</div>
//                             <input
//                               className="input"
//                               type="datetime-local"
//                               value={edit.breakEnd}
//                               onChange={(e) => setEdit((p) => ({ ...p, breakEnd: e.target.value }))}
//                             />
//                           </div>

//                           <div className="field">
//                             <div className="label">Clock off (override)</div>
//                             <input
//                               className="input"
//                               type="datetime-local"
//                               value={edit.end}
//                               onChange={(e) => setEdit((p) => ({ ...p, end: e.target.value }))}
//                             />
//                           </div>
//                         </div>

//                         <div className="editorActions">
//                           <button
//                             className="btn"
//                             onClick={() =>
//                               setEdit((p) => ({ ...p, start: "", breakStart: "", breakEnd: "", end: "" }))
//                             }
//                           >
//                             Clear overrides
//                           </button>

//                           <div className="grow" />

//                           <button
//                             className="btn primary"
//                             disabled={savingId === t.id}
//                             onClick={() => saveEditor(t)}
//                           >
//                             {savingId === t.id ? "Saving…" : "Save"}
//                           </button>
//                         </div>

//                         <div className="tiny subtle">
//                           Overrides change what Audit shows as “Actual”. Original button timestamps remain in the doc.
//                         </div>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               ))}
//             </div>

//             {/* MOBILE APP CARDS */}
//             <div className="auditMobile">
//               {timesheets.map((t) => (
//                 <details key={t.id} className="mcard" open={openEditorId === t.id}>
//                   <summary
//                     className="mcardTop"
//                     onClick={(e) => {
//                       // Let details toggle normally, but also sync editor state
//                       if (openEditorId === t.id) {
//                         setOpenEditorId(null);
//                       } else {
//                         openEditor(t);
//                       }
//                       // prevent double toggle weirdness
//                       e.preventDefault();
//                     }}
//                   >
//                     <div className="mLeft">
//                       <div className="mTitle">{t.staffName}</div>
//                       <div className="mSub mono">{t.date}</div>
//                     </div>
//                     <div className="mRight">
//                       <span className="chip">{storeLabel(t.storeId)}</span>
//                       {statusChip(t.auditStatus)}
//                     </div>
//                   </summary>

//                   <div className="mBody">
//                     <div className="miniGrid">
//                       <div className="miniBox">
//                         <div className="k">Clock on</div>
//                         <div className="v">{t.startActualFmt}</div>
//                         <div className="s">input {t.startInput || "-"}</div>
//                       </div>

//                       <div className="miniBox">
//                         <div className="k">Break</div>
//                         <div className="v">{t.breakMinutes != null ? `${t.breakMinutes} min` : "No break"}</div>
//                         <div className="s">input {t.breakInputMinutes != null ? `${t.breakInputMinutes} min` : "-"}</div>
//                       </div>

//                       <div className="miniBox">
//                         <div className="k">Clock off</div>
//                         <div className="v">{t.endActualFmt}</div>
//                         <div className="s">input {t.endInput || "-"}</div>
//                       </div>
//                     </div>

//                     {/* Mobile editor */}
//                     <div className="mEditor">
//                       <div className="field">
//                         <div className="label">Status</div>
//                         <select
//                           className="input"
//                           value={edit.auditStatus}
//                           onChange={(e) => setEdit((p) => ({ ...p, auditStatus: e.target.value }))}
//                         >
//                           <option value="none">Unmarked</option>
//                           <option value="reviewed">Reviewed</option>
//                           <option value="approved">Approved</option>
//                         </select>
//                       </div>

//                       <div className="field">
//                         <div className="label">Admin note</div>
//                         <textarea
//                           className="input textarea"
//                           value={edit.adminNote}
//                           placeholder="Add note (optional)…"
//                           onChange={(e) => setEdit((p) => ({ ...p, adminNote: e.target.value }))}
//                         />
//                       </div>

//                       <div className="miniGrid">
//                         <div className="miniBox">
//                           <div className="k">Clock on override</div>
//                           <input
//                             className="input"
//                             type="datetime-local"
//                             value={edit.start}
//                             onChange={(e) => setEdit((p) => ({ ...p, start: e.target.value }))}
//                           />
//                         </div>
//                         <div className="miniBox">
//                           <div className="k">Break start override</div>
//                           <input
//                             className="input"
//                             type="datetime-local"
//                             value={edit.breakStart}
//                             onChange={(e) => setEdit((p) => ({ ...p, breakStart: e.target.value }))}
//                           />
//                         </div>
//                         <div className="miniBox">
//                           <div className="k">Break end override</div>
//                           <input
//                             className="input"
//                             type="datetime-local"
//                             value={edit.breakEnd}
//                             onChange={(e) => setEdit((p) => ({ ...p, breakEnd: e.target.value }))}
//                           />
//                         </div>
//                         <div className="miniBox">
//                           <div className="k">Clock off override</div>
//                           <input
//                             className="input"
//                             type="datetime-local"
//                             value={edit.end}
//                             onChange={(e) => setEdit((p) => ({ ...p, end: e.target.value }))}
//                           />
//                         </div>
//                       </div>

//                       <div className="editorActions">
//                         <button
//                           className="btn"
//                           onClick={() => setEdit((p) => ({ ...p, start: "", breakStart: "", breakEnd: "", end: "" }))}
//                         >
//                           Clear overrides
//                         </button>

//                         <div className="grow" />

//                         <button className="btn primary" disabled={savingId === t.id} onClick={() => saveEditor(t)}>
//                           {savingId === t.id ? "Saving…" : "Save"}
//                         </button>
//                       </div>
//                     </div>
//                   </div>
//                 </details>
//               ))}
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }











import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  documentId,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
import { useStores } from "../../hooks/useStore";
import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import "./Audit.css";
import { useNavigate } from "react-router-dom";

// --- Helpers ---
// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fmtTime(ts) {
  if (!ts || !ts.toDate) return "-";
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesBetween(a, b) {
  if (!a?.toDate || !b?.toDate) return null;
  const ms = b.toDate().getTime() - a.toDate().getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function inputBreakMinutes(bStart, bEnd) {
  const toMin = (hm) => {
    if (!hm) return null;
    const [h, m] = String(hm).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const s = toMin(bStart);
  const e = toMin(bEnd);
  if (s == null || e == null) return null;
  let diff = e - s;
  if (diff < 0) diff += 1440;
  return Math.max(0, diff);
}

function tsToLocalInput(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToTimestamp(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

export default function Audit() {
  const { fbUser } = useAuth();
  const { showToast } = useToast();
  const { stores, getStoreLabel } = useStores();

  // Filters
  const [preset, setPreset] = useState("week");
  const [dateFrom, setDateFrom] = useState(toYMD(getWeekStartMonday(new Date())));
  const [dateTo, setDateTo] = useState(toYMD(addDays(getWeekStartMonday(new Date()), 7)));
  const [storeId, setStoreId] = useState("all");
  const [employeeUid, setEmployeeUid] = useState("all");

  // Data
  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffByUid, setStaffByUid] = useState({});

  // UI State
  const [openEditorId, setOpenEditorId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [edit, setEdit] = useState({
    auditStatus: "none",
    adminNote: "",
    start: "",
    breakStart: "",
    breakEnd: "",
    end: "",
  });

  const loadStaffList = useCallback(async () => {
    try {
      const qs = query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"));
      const snap = await getDocs(qs);
      const list = snap.docs.map(d => ({
        uid: d.id,
        name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.data().email
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      const map = {};
      list.forEach(x => map[x.uid] = x.name);
      setStaffList(list);
      setStaffByUid(map);
    } catch (e) {
      showToast("Staff load failed", "error");
    }
  }, [showToast]);

  const loadAudit = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      let qTs = query(collection(db, "timesheets"), where("date", ">=", dateFrom), where("date", "<", dateTo));
      if (employeeUid !== "all") {
        qTs = query(collection(db, "timesheets"), where("uid", "==", employeeUid), where("date", ">=", dateFrom), where("date", "<", dateTo));
      }
      
      const snap = await getDocs(qTs);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (storeId !== "all") list = list.filter(x => x.storeId === storeId);

      list = list.map(t => {
        const eff = (k) => t.actualOverrides?.[k] || t[k] || null;
        const start = eff("startActual");
        const bStart = eff("breakStartActual");
        const bEnd = eff("breakEndActual");
        const end = eff("endActual");

        return {
          ...t,
          staffName: staffByUid[t.uid] || t.staffName || "Unknown",
          startActualFmt: fmtTime(start),
          breakMinutes: minutesBetween(bStart, bEnd),
          endActualFmt: fmtTime(end),
          effStart: start, effBreakStart: bStart, effBreakEnd: bEnd, effEnd: end,
          breakInputMinutes: inputBreakMinutes(t.breakStartInput, t.breakEndInput),
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      setTimesheets(list);
      if (isManual) showToast("Audit logs updated", "success");
    } catch (e) {
      showToast("Error fetching logs", "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, storeId, employeeUid, staffByUid, showToast]);

  useEffect(() => { loadStaffList(); }, [loadStaffList]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  // Handle Preset Changes
  useEffect(() => {
    const now = new Date();
    if (preset === "day") {
      setDateFrom(toYMD(now));
      setDateTo(toYMD(addDays(now, 1)));
    } else if (preset === "week") {
      const ws = getWeekStartMonday(now);
      setDateFrom(toYMD(ws));
      setDateTo(toYMD(addDays(ws, 7)));
    }
  }, [preset]);

  const saveEditor = async (t) => {
    if (!fbUser) return showToast("Unauthorized", "error");
    setSavingId(t.id);
    try {
      const patch = {
        auditStatus: edit.auditStatus,
        adminNote: edit.adminNote,
        auditUpdatedAt: serverTimestamp(),
        auditUpdatedBy: fbUser.uid,
        actualOverrides: {
          startActual: localInputToTimestamp(edit.start),
          breakStartActual: localInputToTimestamp(edit.breakStart),
          breakEndActual: localInputToTimestamp(edit.breakEnd),
          endActual: localInputToTimestamp(edit.end),
        }
      };
      await updateDoc(doc(db, "timesheets", t.id), patch);
      showToast("Saved successfully", "success");
      setOpenEditorId(null);
      loadAudit();
    } catch (e) {
      showToast("Save failed", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Audit Logs</h1>
          <span className="subtitle">Verify & override timestamps</span>
        </div>
        <button className={`refresh-circle ${loading ? 'spinning' : ''}`} onClick={() => loadAudit(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </header>

      <main className="scroll-content">
        <section className="audit-filters-container" style={{margin: '0px 12px 8px 12px'}}>
          <div className="preset-tabs">
            {["day", "week", "custom"].map((p) => (
              <button key={p} className={`tab-item ${preset === p ? "active" : ""}`} onClick={() => setPreset(p)}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="custom-date-row animate-slide-down">
              <div className="filter-field">
                <label>From</label>
                <input type="date" className="app-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="filter-field">
                <label>To (Excl)</label>
                <input type="date" className="app-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="filters-grid">
            <div className="filter-field">
              <label>Store</label>
              <select className="app-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="all">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label>Staff</label>
              <select className="app-input" value={employeeUid} onChange={(e) => setEmployeeUid(e.target.value)}>
                <option value="all">All Staff</option>
                {staffList.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="stats-bar" style={{margin: '8px 12px 8px 12px'}}>
          <div className="stat-item">
            <label>Total Logs</label>
            <div className="value">{timesheets.length}</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <label>Finished</label>
            <div className="value warn">{timesheets.filter(t => t.effEnd).length}</div>
          </div>
        </section>

        <div className="audit-list timeline">
          {loading ? (
            <div className="loader-inline"><div className="spinner"></div><span>Loading...</span></div>
          ) : timesheets.length === 0 ? (
            <div className="empty-state-container"><p>No data found.</p></div>
          ) : (
            timesheets.map((t) => (
              <div key={t.id} className={`audit-card ${openEditorId === t.id ? 'is-editing' : ''}`}>
                <div className="audit-card-header" onClick={() => {
                  if (openEditorId === t.id) setOpenEditorId(null);
                  else {
                    setOpenEditorId(t.id);
                    setEdit({
                      auditStatus: t.auditStatus || "none",
                      adminNote: t.adminNote || "",
                      start: tsToLocalInput(t.effStart),
                      breakStart: tsToLocalInput(t.effBreakStart),
                      breakEnd: tsToLocalInput(t.effBreakEnd),
                      end: tsToLocalInput(t.effEnd),
                    });
                  }
                }}>
                  <div className="staff-info">
                    <span className="staff-name">{t.staffName}</span>
                    <span className="shift-date">{t.date} • {getStoreLabel(t.storeId)}</span>
                  </div>
                  <div className="status-area">
                     <span className={`chip ${t.auditStatus === 'approved' ? 'ok' : t.auditStatus === 'reviewed' ? 'warn' : ''}`}>
                        {t.auditStatus || 'Unmarked'}
                     </span>
                  </div>
                </div>

                <div className="audit-card-body">
                   <div className="comparison-grid">
                      <div className="comp-box">
                        <label>Clock On</label>
                        <span className="actual">{t.startActualFmt}</span>
                        <span className="input-val">Typed: {t.startInput || '--'}</span>
                      </div>
                      <div className="comp-box">
                        <label>Break</label>
                        <span className="actual">{t.breakMinutes ?? 0}m</span>
                        <span className="input-val">Typed: {t.breakInputMinutes ?? 0}m</span>
                      </div>
                      <div className="comp-box">
                        <label>Clock Off</label>
                        <span className="actual">{t.endActualFmt}</span>
                        <span className="input-val">Typed: {t.endInput || '--'}</span>
                      </div>
                   </div>

                   {openEditorId === t.id && (
                     <div className="admin-editor animate-slide-down">
                        <div className="edit-field">
                           <label>Status</label>
                           <select className="app-input" value={edit.auditStatus} onChange={e => setEdit(p => ({...p, auditStatus: e.target.value}))}>
                              <option value="none">Unmarked</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="approved">Approved</option>
                           </select>
                        </div>
                        <div className="edit-field">
                           <label>Admin Note</label>
                           <textarea className="app-input" value={edit.adminNote} onChange={e => setEdit(p => ({...p, adminNote: e.target.value}))} placeholder="Internal notes..."/>
                        </div>
                        <div className="override-grid">
                           <div className="field-box"><label>Start</label><input type="datetime-local" className="app-input" value={edit.start} onChange={e=>setEdit(p=>({...p, start: e.target.value}))}/></div>
                           <div className="field-box"><label>End</label><input type="datetime-local" className="app-input" value={edit.end} onChange={e=>setEdit(p=>({...p, end: e.target.value}))}/></div>
                        </div>
                        <div className="editor-actions">
                           <button className="btn-sec" onClick={() => setOpenEditorId(null)}>Cancel</button>
                           <button className="btn-primary" onClick={() => saveEditor(t)} disabled={savingId === t.id}>
                             {savingId === t.id ? "Saving..." : "Apply"}
                           </button>
                        </div>
                     </div>
                   )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}