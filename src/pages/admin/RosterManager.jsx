// import { useEffect, useMemo, useState } from "react";
// import {
//   addDoc,
//   collection,
//   deleteDoc,
//   doc,
//   getDoc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
//   writeBatch,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import {
//   addDays,
//   getWeekStartMonday,
//   prettyDate,
//   toYMD,
//   weekDates,
// } from "../../utils/dates";
// import "./RosterManager.css";

// export default function RosterManager() {
//   // weekStart is Monday YYYY-MM-DD
//   const [weekStart, setWeekStart] = useState(
//     toYMD(getWeekStartMonday(addDays(new Date(), 7))) // default next week
//   );
//   const [weekStatus, setWeekStatus] = useState("draft"); // draft | published
//   const [loading, setLoading] = useState(true);

//   const [staffApproved, setStaffApproved] = useState([]); // {uid, name, email}
//   const [shifts, setShifts] = useState([]); // shift docs

//   const weekStartDateObj = useMemo(
//     () => new Date(weekStart + "T00:00:00"),
//     [weekStart]
//   );
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   const isLocked = weekStatus === "published";

//   useEffect(() => {
//     loadApprovedStaff();
//   }, []);

//   useEffect(() => {
//     loadWeek();
//   }, [weekStart]);

//   async function loadApprovedStaff() {
//     const qs = query(
//       collection(db, "users"),
//       where("role", "==", "staff"),
//       where("status", "==", "approved")
//     );
//     const snap = await getDocs(qs);

//     const list = snap.docs
//       .map((d) => ({
//         uid: d.id,
//         name:
//           `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() ||
//           d.data().email ||
//           d.id,
//         email: d.data().email || "",
//       }))
//       .sort((a, b) => a.name.localeCompare(b.name));

//     setStaffApproved(list);
//   }

//   async function loadWeek() {
//     setLoading(true);

//     const weekRef = doc(db, "rosterWeeks", weekStart);
//     const weekSnap = await getDoc(weekRef);

//     if (!weekSnap.exists()) {
//       await setDoc(
//         weekRef,
//         {
//           weekStart,
//           status: "draft",
//           publishedAt: null,
//           createdAt: serverTimestamp(),
//           updatedAt: serverTimestamp(),
//         },
//         { merge: true }
//       );
//       setWeekStatus("draft");
//     } else {
//       setWeekStatus(weekSnap.data().status || "draft");
//     }

//     const shiftsRef = collection(db, "rosterWeeks", weekStart, "shifts");
//     const shiftsSnap = await getDocs(shiftsRef);

//     const list = shiftsSnap.docs
//       .map((d) => ({ id: d.id, ...d.data() }))
//       .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

//     setShifts(list);
//     setLoading(false);
//   }

//   function shiftsForDate(ymd) {
//     return shifts
//       .filter((s) => s.date === ymd)
//       .sort((a, b) => (a.startPlanned || "").localeCompare(b.startPlanned || ""));
//   }

//   // validate roster before publishing
//   function getRosterIssues() {
//     const issues = [];

//     // basic required fields
//     for (const s of shifts) {
//       if (!s.uid) issues.push(`Missing staff on ${s.date}`);
//       if (!s.storeId) issues.push(`Missing store on ${s.date}`);
//       if (!s.startPlanned || !s.endPlanned) issues.push(`Missing time on ${s.date}`);
//       if (s.startPlanned && s.endPlanned && s.startPlanned >= s.endPlanned) {
//         issues.push(`Start must be before end on ${s.date}`);
//       }
//     }

//     // duplicate shifts: same staff same day
//     const keyCount = new Map();
//     for (const s of shifts) {
//       if (!s.uid) continue;
//       const key = `${s.uid}|${s.date}`;
//       keyCount.set(key, (keyCount.get(key) || 0) + 1);
//     }
//     for (const [key, count] of keyCount.entries()) {
//       if (count > 1) issues.push(`Duplicate shift: ${key}`);
//     }

//     return issues;
//   }

//   async function addShift(ymd) {
//     if (isLocked) return;

//     const shiftsCol = collection(db, "rosterWeeks", weekStart, "shifts");
//     await addDoc(shiftsCol, {
//       uid: "", // blank until chosen
//       staffName: "",
//       storeId: STORES[0].id,
//       date: ymd,
//       startPlanned: "13:00",
//       endPlanned: "22:00",
//       createdAt: serverTimestamp(),
//       updatedAt: serverTimestamp(),
//     });

//     await loadWeek();
//   }

//   async function updateShift(shiftId, patch) {
//     if (isLocked) return;
//     const ref = doc(db, "rosterWeeks", weekStart, "shifts", shiftId);
//     await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
//     await loadWeek();
//   }

//   async function removeShift(shiftId) {
//     if (isLocked) return;
//     await deleteDoc(doc(db, "rosterWeeks", weekStart, "shifts", shiftId));
//     await loadWeek();
//   }

//   async function publishWeek() {
//     const issues = getRosterIssues();
//     if (issues.length) {
//       alert("Fix these before publishing:\n\n" + issues.slice(0, 12).join("\n"));
//       return;
//     }

//     const weekRef = doc(db, "rosterWeeks", weekStart);
//     await updateDoc(weekRef, {
//       status: "published",
//       publishedAt: serverTimestamp(),
//       updatedAt: serverTimestamp(),
//     });
//     await loadWeek();
//   }

//   async function unpublishWeek() {
//     const ok = confirm("Unpublish this week to edit?");
//     if (!ok) return;

//     const weekRef = doc(db, "rosterWeeks", weekStart);
//     await updateDoc(weekRef, {
//       status: "draft",
//       publishedAt: null,
//       updatedAt: serverTimestamp(),
//     });
//     await loadWeek();
//   }

//   async function copyPreviousWeek() {
//     if (isLocked) {
//       alert("Unpublish first to copy/edit.");
//       return;
//     }

//     const prevWeek = toYMD(addDays(weekStartDateObj, -7));
//     const prevSnap = await getDocs(collection(db, "rosterWeeks", prevWeek, "shifts"));

//     if (prevSnap.empty) {
//       alert("No shifts found in previous week.");
//       return;
//     }

//     const wipe = confirm(
//       "Replace current week shifts with previous week?\n\nOK = Replace\nCancel = Add on top"
//     );

//     const batch = writeBatch(db);

//     // wipe current shifts if requested
//     if (wipe && shifts.length > 0) {
//       shifts.forEach((s) =>
//         batch.delete(doc(db, "rosterWeeks", weekStart, "shifts", s.id))
//       );
//     }

//     // create a local view of shifts to detect duplicates when NOT wiping
//     const existing = wipe ? [] : shifts;

//     prevSnap.docs.forEach((d) => {
//       const s = d.data();

//       const newDateObj = addDays(new Date(s.date + "T00:00:00"), 7);
//       const newDate = toYMD(newDateObj);

//       const wouldDuplicate = existing.some(
//         (x) => x.uid === s.uid && x.date === newDate
//       );
//       if (wouldDuplicate) return;

//       const newRef = doc(collection(db, "rosterWeeks", weekStart, "shifts"));
//       batch.set(newRef, {
//         uid: s.uid || "",
//         staffName: s.staffName || "",
//         storeId: s.storeId || STORES[0].id,
//         date: newDate,
//         startPlanned: s.startPlanned || "13:00",
//         endPlanned: s.endPlanned || "22:00",
//         createdAt: serverTimestamp(),
//         updatedAt: serverTimestamp(),
//       });
//     });

//     // ensure week doc exists
//     batch.set(
//       doc(db, "rosterWeeks", weekStart),
//       {
//         weekStart,
//         status: "draft",
//         updatedAt: serverTimestamp(),
//         createdAt: serverTimestamp(),
//       },
//       { merge: true }
//     );

//     await batch.commit();
//     await loadWeek();
//   }

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="rosterTop">
//           <div>
//             <h1 className="h1">Roster</h1>
//             <p className="p">
//               Weekly roster (Mon–Sun). Publish locks the roster.
//               <span className={isLocked ? "pill pillLock" : "pill pillDraft"}>
//                 {isLocked ? "Published" : "Draft"}
//               </span>
//             </p>
//           </div>

//           <div className="rosterTopRight">
//             <div className="field">
//               <div className="label">Week starting (Monday)</div>
//               <input
//                 className="input"
//                 type="date"
//                 value={weekStart}
//                 onChange={(e) => setWeekStart(e.target.value)}
//               />
//             </div>

//             <div className="row">
//               <button
//                 className="btn"
//                 onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}
//               >
//                 This week
//               </button>
//               <button
//                 className="btn"
//                 onClick={() =>
//                   setWeekStart(toYMD(getWeekStartMonday(addDays(new Date(), 7))))
//                 }
//               >
//                 Next week
//               </button>
//             </div>
//           </div>
//         </div>

//         <div className="spacer" />

//         <div className="row rosterActions">
//           <button className="btn" onClick={loadWeek}>
//             Refresh
//           </button>

//           <button className="btn" disabled={isLocked} onClick={copyPreviousWeek}>
//             Copy previous week
//           </button>

//           <div className="grow" />

//           {!isLocked ? (
//             <button className="btn primary" onClick={publishWeek} disabled={loading}>
//               Publish (lock)
//             </button>
//           ) : (
//             <button className="btn" onClick={unpublishWeek}>
//               Unpublish (unlock)
//             </button>
//           )}
//         </div>

//         <div className="spacer" />

//         {loading ? (
//           <p className="p">Loading…</p>
//         ) : (
//           <div className="weekGrid">
//             {days.map((d) => {
//               const ymd = toYMD(d);
//               const dayShifts = shiftsForDate(ymd);

//               return (
//                 <div key={ymd} className="dayCard">
//                   <div className="dayHeader">
//                     <div>
//                       <div className="dayTitle">{prettyDate(d)}</div>
//                       <div className="daySub">{ymd}</div>
//                     </div>

//                     <button
//                       className="btn small"
//                       disabled={isLocked}
//                       onClick={() => addShift(ymd)}
//                     >
//                       + Add
//                     </button>
//                   </div>

//                   <div className="spacer" />

//                   {dayShifts.length === 0 ? (
//                     <div className="empty">No shifts</div>
//                   ) : (
//                     dayShifts.map((s) => {
//                       const hasIssue = !s.uid || !s.startPlanned || !s.endPlanned;

//                       return (
//                         <div
//                           key={s.id}
//                           className={`shiftRow ${hasIssue ? "shiftWarn" : ""}`}
//                         >
//                           <div className="shiftTop">
//                             {/* Staff */}
//                             <select
//                               className="input"
//                               disabled={isLocked}
//                               value={s.uid || ""}
//                               onChange={(e) => {
//                                 const uid = e.target.value;

//                                 if (!uid) {
//                                   updateShift(s.id, { uid: "", staffName: "" });
//                                   return;
//                                 }

//                                 // Duplicate check (ignore this row)
//                                 const wouldDuplicate = shifts.some(
//                                   (x) => x.id !== s.id && x.date === s.date && x.uid === uid
//                                 );
//                                 if (wouldDuplicate) {
//                                   alert("This staff already has a shift on this day.");
//                                   return;
//                                 }

//                                 const staff = staffApproved.find((x) => x.uid === uid);
//                                 if (!staff) return;

//                                 updateShift(s.id, { uid, staffName: staff.name });
//                               }}
//                             >
//                               <option value="" disabled>
//                                 Select staff…
//                               </option>
//                               {staffApproved.map((st) => (
//                                 <option key={st.uid} value={st.uid}>
//                                   {st.name}
//                                 </option>
//                               ))}
//                             </select>

//                             {/* Store */}
//                             <select
//                               className="input"
//                               disabled={isLocked}
//                               value={s.storeId}
//                               onChange={(e) =>
//                                 updateShift(s.id, { storeId: e.target.value })
//                               }
//                             >
//                               {STORES.map((st) => (
//                                 <option key={st.id} value={st.id}>
//                                   {st.label}
//                                 </option>
//                               ))}
//                             </select>
//                           </div>

//                           <div className="shiftBottom">
//                             <input
//                               className="input"
//                               disabled={isLocked}
//                               type="time"
//                               value={s.startPlanned || ""}
//                               onChange={(e) =>
//                                 updateShift(s.id, { startPlanned: e.target.value })
//                               }
//                             />

//                             <input
//                               className="input"
//                               disabled={isLocked}
//                               type="time"
//                               value={s.endPlanned || ""}
//                               onChange={(e) =>
//                                 updateShift(s.id, { endPlanned: e.target.value })
//                               }
//                             />

//                             <button
//                               className="btn danger"
//                               disabled={isLocked}
//                               onClick={() => removeShift(s.id)}
//                             >
//                               Delete
//                             </button>
//                           </div>
//                         </div>
//                       );
//                     })
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

















// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   addDoc, collection, deleteDoc, doc, getDoc, getDocs,
//   query, setDoc, updateDoc, where, serverTimestamp, writeBatch,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// // import { STORES } from "../../utils/constants";

// import { addDays, getWeekStartMonday, prettyDate, toYMD, weekDates } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext"; // Import Toast Hook
// import "./RosterManager.css";
// import { useStores } from "../../hooks/useStore";

// export default function RosterManager() {
//   const { showToast } = useToast(); // Initialize Toast

//   const { stores, getStoreLabel } = useStores();
//   const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(addDays(new Date(), 7))));
//   const [weekStatus, setWeekStatus] = useState("draft");
//   const [loading, setLoading] = useState(true);
//   const [staffApproved, setStaffApproved] = useState([]);
//   const [shifts, setShifts] = useState([]);

//   const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);
//   const isLocked = weekStatus === "published";

//   const loadApprovedStaff = useCallback(async () => {
//     try {
//       const qs = query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"));
//       const snap = await getDocs(qs);
//       const list = snap.docs.map(d => ({
//         uid: d.id,
//         name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.data().email || d.id,
//       })).sort((a, b) => a.name.localeCompare(b.name));
//       setStaffApproved(list);
//     } catch (e) {
//       showToast("Error loading staff list", "error");
//     }
//   }, [showToast]);

//   const loadWeek = useCallback(async () => {
//     setLoading(true);
//     try {
//       const weekRef = doc(db, "rosterWeeks", weekStart);
//       const weekSnap = await getDoc(weekRef);

//       if (!weekSnap.exists()) {
//         await setDoc(weekRef, { weekStart, status: "draft", createdAt: serverTimestamp() }, { merge: true });
//         setWeekStatus("draft");
//       } else {
//         setWeekStatus(weekSnap.data().status || "draft");
//       }

//       const shiftsSnap = await getDocs(collection(db, "rosterWeeks", weekStart, "shifts"));
//       setShifts(shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date)));
//     } catch (e) {
//       showToast("Error loading roster week", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [weekStart, showToast]);

//   useEffect(() => { loadApprovedStaff(); }, [loadApprovedStaff]);
//   useEffect(() => { loadWeek(); }, [loadWeek]);

//   const issues = useMemo(() => {
//     const errs = [];
//     shifts.forEach(s => {
//       if (!s.uid) errs.push(`Missing staff on ${s.date}`);
//       if (s.startPlanned >= s.endPlanned) errs.push(`Invalid time on ${s.date}`);
//     });
//     return errs;
//   }, [shifts]);

//   async function addShift(ymd) {
//     if (isLocked) return;
//     try {
//       const shiftsCol = collection(db, "rosterWeeks", weekStart, "shifts");
//       await addDoc(shiftsCol, {
//         uid: "", staffName: "", storeId: stores[0].id, date: ymd,
//         startPlanned: "13:00", endPlanned: "22:00", updatedAt: serverTimestamp()
//       });
//       loadWeek();
//       showToast("Shift added", "success");
//     } catch (e) {
//       showToast("Could not add shift", "error");
//     }
//   }

//   async function updateShift(shiftId, patch) {
//     if (isLocked) return;
//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart, "shifts", shiftId), { ...patch, updatedAt: serverTimestamp() });
//       setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, ...patch } : s));
//     } catch (e) {
//       showToast("Update failed", "error");
//     }
//   }

//   async function togglePublish() {
//     if (!isLocked && issues.length > 0) {
//       showToast(`Fix ${issues.length} issues before publishing`, "error");
//       return;
//     }

//     const newStatus = isLocked ? "draft" : "published";
//     if (isLocked && !confirm("Unlock roster for editing? Staff will no longer see this as finalized.")) return;
    
//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart), {
//         status: newStatus,
//         publishedAt: newStatus === "published" ? serverTimestamp() : null
//       });
//       loadWeek();
//       showToast(newStatus === "published" ? "Roster Published!" : "Roster set to Draft", "success");
//     } catch (e) {
//       showToast("Status update failed", "error");
//     }
//   }

//   async function copyPreviousWeek() {
//     if (isLocked) return;
//     try {
//       const prevWeek = toYMD(addDays(weekStartDateObj, -7));
//       const prevSnap = await getDocs(collection(db, "rosterWeeks", prevWeek, "shifts"));
      
//       if (prevSnap.empty) {
//         showToast("No shifts found in previous week", "error");
//         return;
//       }

//       const batch = writeBatch(db);
//       if (shifts.length > 0) {
//         if (!confirm("Replace current week shifts with previous week?")) return;
//         shifts.forEach(s => batch.delete(doc(db, "rosterWeeks", weekStart, "shifts", s.id)));
//       }

//       prevSnap.docs.forEach(d => {
//         const s = d.data();
//         const newRef = doc(collection(db, "rosterWeeks", weekStart, "shifts"));
//         batch.set(newRef, { 
//           ...s, 
//           date: toYMD(addDays(new Date(s.date + "T00:00:00"), 7)), 
//           updatedAt: serverTimestamp() 
//         });
//       });

//       await batch.commit();
//       loadWeek();
//       showToast("Roster copied from previous week", "success");
//     } catch (e) {
//       showToast("Error copying roster", "error");
//     }
//   }

//   async function deleteShift(sid) {
//     if (isLocked) return;
//     if (!confirm("Delete this shift?")) return;
//     try {
//       await deleteDoc(doc(db, "rosterWeeks", weekStart, "shifts", sid));
//       loadWeek();
//       showToast("Shift deleted", "success");
//     } catch (e) {
//       showToast("Delete failed", "error");
//     }
//   }

//   return (
//     <div className="admin-wrapper">
//       <header className="admin-header">
//         <div className="title-area">
//           <h1 className="main-title">Roster Manager</h1>
//           <span className={`status-pill ${weekStatus}`}>{weekStatus.toUpperCase()}</span>
//         </div>
//         <div className="header-actions">
//            <button className="refresh-circle" onClick={loadWeek}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg></button>
//         </div>
//       </header>

//       <section className="roster-controls">
//         <div className="control-group">
//           <label>Week Starting</label>
//           <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
//         </div>
//         <div className="button-row">
//           <button className="btn-sec" onClick={copyPreviousWeek} disabled={isLocked}>Copy Prev</button>
//           <button className={`btn-primary ${isLocked ? 'unlock' : 'lock'}`} onClick={togglePublish}>
//             {isLocked ? "Unlock Roster" : "Publish"}
//           </button>
//         </div>
//       </section>

//       {issues.length > 0 && !isLocked && (
//         <div className="validation-box">
//           <strong>Validation Alert:</strong> Fix {issues.length} red-highlighted areas before publishing.
//         </div>
//       )}

//       <div className="roster-grid">
//         {days.map((d) => {
//           const ymd = toYMD(d);
//           const dayShifts = shifts.filter(s => s.date === ymd);

//           return (
//             <div key={ymd} className="day-column">
//               <div className="day-header">
//                 <div className="day-text">
//                   <span className="day-name">{prettyDate(d).split(',')[0]}</span>
//                   <span className="day-date">{ymd}</span>
//                 </div>
//                 {!isLocked && <button className="add-shift-btn" onClick={() => addShift(ymd)}>+</button>}
//               </div>

//               <div className="shift-list">
//                 {dayShifts.map(s => (
//                   <div key={s.id} className={`shift-editor-card ${!s.uid ? 'error' : ''}`}>
//                     <select 
//                       disabled={isLocked}
//                       value={s.uid} 
//                       onChange={(e) => updateShift(s.id, { uid: e.target.value, staffName: staffApproved.find(st => st.uid === e.target.value)?.name })}
//                     >
//                       <option value="">Select Staff</option>
//                       {staffApproved.map(st => <option key={st.uid} value={st.uid}>{st.name}</option>)}
//                     </select>

//                     <select 
//                       disabled={isLocked}
//                       value={s.storeId} 
//                       onChange={(e) => updateShift(s.id, { storeId: e.target.value })}
//                     >
//                       {stores.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
//                     </select>

//                     <div className="time-row">
//                       <input type="time" disabled={isLocked} value={s.startPlanned} onChange={(e) => updateShift(s.id, { startPlanned: e.target.value })} />
//                       <input type="time" disabled={isLocked} value={s.endPlanned} onChange={(e) => updateShift(s.id, { endPlanned: e.target.value })} />
//                     </div>

//                     {!isLocked && (
//                       <button className="del-btn" onClick={() => deleteShift(s.id)}>
//                         Remove Shift
//                       </button>
//                     )}
//                   </div>
//                 ))}
//                 {dayShifts.length === 0 && <div className="empty-day">No Shifts</div>}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }





















// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   addDoc,
//   collection,
//   deleteDoc,
//   doc,
//   getDoc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
//   writeBatch,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { addDays, getWeekStartMonday, prettyDate, toYMD, weekDates } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import "./RosterManager.css";
// import { useStores } from "../../hooks/useStore";

// export default function RosterManager() {
//   const { showToast } = useToast();
//   const { stores } = useStores();

//   const [weekStart, setWeekStart] = useState(
//     toYMD(getWeekStartMonday(addDays(new Date(), 7)))
//   );
//   const [weekStatus, setWeekStatus] = useState("draft");
//   const [loading, setLoading] = useState(true);
//   const [staffApproved, setStaffApproved] = useState([]);
//   const [shifts, setShifts] = useState([]);
//   const [openDays, setOpenDays] = useState({});

//   const weekStartDateObj = useMemo(
//     () => new Date(weekStart + "T00:00:00"),
//     [weekStart]
//   );
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);
//   const isLocked = weekStatus === "published";

//   const shiftsByDate = useMemo(() => {
//     const map = {};
//     shifts.forEach((s) => {
//       if (!map[s.date]) map[s.date] = [];
//       map[s.date].push(s);
//     });
//     return map;
//   }, [shifts]);

//   const usedStaffByDate = useMemo(() => {
//     const map = {};
//     shifts.forEach((s) => {
//       if (!s.date || !s.uid) return;
//       if (!map[s.date]) map[s.date] = new Set();
//       map[s.date].add(s.uid);
//     });
//     return map;
//   }, [shifts]);

//   const loadApprovedStaff = useCallback(async () => {
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
//           name:
//             `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() ||
//             d.data().email ||
//             d.id,
//         }))
//         .sort((a, b) => a.name.localeCompare(b.name));
//       setStaffApproved(list);
//     } catch (e) {
//       showToast("Error loading staff list", "error");
//     }
//   }, [showToast]);

//   const loadWeek = useCallback(async () => {
//     setLoading(true);
//     try {
//       const weekRef = doc(db, "rosterWeeks", weekStart);
//       const weekSnap = await getDoc(weekRef);

//       if (!weekSnap.exists()) {
//         await setDoc(
//           weekRef,
//           { weekStart, status: "draft", createdAt: serverTimestamp() },
//           { merge: true }
//         );
//         setWeekStatus("draft");
//       } else {
//         setWeekStatus(weekSnap.data().status || "draft");
//       }

//       const shiftsSnap = await getDocs(collection(db, "rosterWeeks", weekStart, "shifts"));
//       setShifts(
//         shiftsSnap.docs
//           .map((d) => ({ id: d.id, ...d.data() }))
//           .sort(
//             (a, b) =>
//               a.date.localeCompare(b.date) ||
//               (a.startPlanned || "").localeCompare(b.startPlanned || "")
//           )
//       );
//     } catch (e) {
//       showToast("Error loading roster week", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [weekStart, showToast]);

//   useEffect(() => {
//     loadApprovedStaff();
//   }, [loadApprovedStaff]);

//   useEffect(() => {
//     loadWeek();
//   }, [loadWeek]);

//   const issues = useMemo(() => {
//     const errs = [];
//     const duplicateCheck = {};

//     shifts.forEach((s) => {
//       if (!s.uid) errs.push(`Missing staff on ${s.date}`);
//       if (s.startPlanned >= s.endPlanned) errs.push(`Invalid time on ${s.date}`);

//       if (s.uid && s.date) {
//         const key = `${s.date}_${s.uid}`;
//         duplicateCheck[key] = (duplicateCheck[key] || 0) + 1;
//       }
//     });

//     Object.entries(duplicateCheck).forEach(([key, count]) => {
//       if (count > 1) {
//         const [date] = key.split("_");
//         errs.push(`Duplicate staff assignment on ${date}`);
//       }
//     });

//     return errs;
//   }, [shifts]);

//   function isDuplicateStaffForDay(targetShiftId, date, uid) {
//     if (!uid || !date) return false;
//     return shifts.some(
//       (s) => s.id !== targetShiftId && s.date === date && s.uid === uid
//     );
//   }

//   async function addShift(ymd) {
//     if (isLocked) return;
//     try {
//       const defaultStoreId = stores?.[0]?.id || "";
//       const shiftsCol = collection(db, "rosterWeeks", weekStart, "shifts");
//       await addDoc(shiftsCol, {
//         uid: "",
//         staffName: "",
//         storeId: defaultStoreId,
//         date: ymd,
//         startPlanned: "13:00",
//         endPlanned: "22:00",
//         updatedAt: serverTimestamp(),
//       });
//       loadWeek();
//       showToast("Shift added", "success");
//     } catch (e) {
//       showToast("Could not add shift", "error");
//     }
//   }

//   async function updateShift(shiftId, patch) {
//     if (isLocked) return;

//     const current = shifts.find((s) => s.id === shiftId);
//     if (!current) return;

//     const next = { ...current, ...patch };

//     if (patch.uid && isDuplicateStaffForDay(shiftId, next.date, patch.uid)) {
//       showToast("This staff is already assigned on this day", "error");
//       return;
//     }

//     if (next.startPlanned && next.endPlanned && next.startPlanned >= next.endPlanned) {
//       showToast("End time must be after start time", "error");
//       return;
//     }

//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart, "shifts", shiftId), {
//         ...patch,
//         updatedAt: serverTimestamp(),
//       });

//       setShifts((prev) =>
//         prev.map((s) => (s.id === shiftId ? { ...s, ...patch } : s))
//       );
//     } catch (e) {
//       showToast("Update failed", "error");
//     }
//   }

//   async function togglePublish() {
//     if (!isLocked && issues.length > 0) {
//       showToast(`Fix ${issues.length} issues before publishing`, "error");
//       return;
//     }

//     const newStatus = isLocked ? "draft" : "published";
//     if (
//       isLocked &&
//       !window.confirm("Unlock roster for editing? Staff will no longer see this as finalized.")
//     ) {
//       return;
//     }

//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart), {
//         status: newStatus,
//         publishedAt: newStatus === "published" ? serverTimestamp() : null,
//       });
//       loadWeek();
//       showToast(
//         newStatus === "published" ? "Roster Published!" : "Roster set to Draft",
//         "success"
//       );
//     } catch (e) {
//       showToast("Status update failed", "error");
//     }
//   }

//   async function copyPreviousWeek() {
//     if (isLocked) return;

//     try {
//       const prevWeek = toYMD(addDays(weekStartDateObj, -7));
//       const prevSnap = await getDocs(collection(db, "rosterWeeks", prevWeek, "shifts"));

//       if (prevSnap.empty) {
//         showToast("No shifts found in previous week", "error");
//         return;
//       }

//       const copied = prevSnap.docs.map((d) => {
//         const s = d.data();
//         return {
//           ...s,
//           date: toYMD(addDays(new Date(s.date + "T00:00:00"), 7)),
//         };
//       });

//       const duplicateCheck = new Set();
//       for (const s of copied) {
//         if (!s.uid || !s.date) continue;
//         const key = `${s.date}_${s.uid}`;
//         if (duplicateCheck.has(key)) {
//           showToast("Previous week contains duplicate staff on same day", "error");
//           return;
//         }
//         duplicateCheck.add(key);
//       }

//       const batch = writeBatch(db);

//       if (shifts.length > 0) {
//         if (!window.confirm("Replace current week shifts with previous week?")) return;
//         shifts.forEach((s) =>
//           batch.delete(doc(db, "rosterWeeks", weekStart, "shifts", s.id))
//         );
//       }

//       copied.forEach((s) => {
//         const newRef = doc(collection(db, "rosterWeeks", weekStart, "shifts"));
//         batch.set(newRef, {
//           ...s,
//           updatedAt: serverTimestamp(),
//         });
//       });

//       await batch.commit();
//       loadWeek();
//       showToast("Roster copied from previous week", "success");
//     } catch (e) {
//       showToast("Error copying roster", "error");
//     }
//   }

//   async function deleteShift(sid) {
//     if (isLocked) return;
//     if (!window.confirm("Delete this shift?")) return;

//     try {
//       await deleteDoc(doc(db, "rosterWeeks", weekStart, "shifts", sid));
//       loadWeek();
//       showToast("Shift deleted", "success");
//     } catch (e) {
//       showToast("Delete failed", "error");
//     }
//   }

//   function toggleDayOpen(ymd) {
//     setOpenDays((prev) => ({
//       ...prev,
//       [ymd]: !prev[ymd],
//     }));
//   }

//   return (
//     <div className="admin-wrapper roster-page">
//       <header className="admin-header">
//         <div className="title-area">
//           <div>
//             <h1 className="main-title">Roster Manager</h1>
//             <p className="roster-subtitle">Organize shifts for the selected week</p>
//           </div>
//           <span className={`status-pill ${weekStatus}`}>{weekStatus.toUpperCase()}</span>
//         </div>

//         <div className="header-actions">
//           <button className="refresh-circle" onClick={loadWeek}>
//             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//               <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//             </svg>
//           </button>
//         </div>
//       </header>

//       <section className="roster-controls">
//         <div className="control-group">
//           <label>Week Starting</label>
//           <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
//         </div>

//         <div className="button-row">
//           <button className="btn-sec" onClick={copyPreviousWeek} disabled={isLocked}>
//             Copy Prev
//           </button>
//           <button
//             className={`btn-primary ${isLocked ? "unlock" : "lock"}`}
//             onClick={togglePublish}
//           >
//             {isLocked ? "Unlock Roster" : "Publish"}
//           </button>
//         </div>
//       </section>

//       {issues.length > 0 && !isLocked && (
//         <div className="validation-box">
//           <strong>Validation Alert:</strong> Fix {issues.length} issue{issues.length > 1 ? "s" : ""} before publishing.
//         </div>
//       )}

//       <div className="roster-grid cleaner">
//         {days.map((d) => {
//           const ymd = toYMD(d);
//           const dayShifts = (shiftsByDate[ymd] || []).sort(
//             (a, b) => (a.startPlanned || "").localeCompare(b.startPlanned || "")
//           );

//           return (
//             <div key={ymd} className="day-column clean collapsible-day">
//               <button
//                 type="button"
//                 className="day-header clean collapsible-trigger"
//                 onClick={() => toggleDayOpen(ymd)}
//               >
//                 <div className="day-text">
//                   <span className="day-name">{prettyDate(d).split(",")[0]}</span>
//                   <span className="day-date">{ymd}</span>
//                 </div>

//                 <div className="day-header-right">
//                   <span className="day-count">
//                     {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
//                   </span>

//                   {!isLocked && (
//                     <span
//                       className="add-shift-btn small-add"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         addShift(ymd);
//                       }}
//                     >
//                       +
//                     </span>
//                   )}

//                   <span className={`day-chevron ${openDays[ymd] ? "open" : ""}`}>⌄</span>
//                 </div>
//               </button>

//               {openDays[ymd] && (
//                 <div className="shift-list clean">
//                   {dayShifts.length === 0 && <div className="empty-day">No shifts</div>}

//                   {dayShifts.map((s, index) => {
//                     const duplicateForThisShift =
//                       !!s.uid && isDuplicateStaffForDay(s.id, s.date, s.uid);

//                     return (
//                       <div
//                         key={s.id}
//                         className={`shift-editor-card clean ${!s.uid || duplicateForThisShift ? "error" : ""}`}
//                       >
//                         <div className="shift-card-top">
//                           {/* <span className="shift-number">Shift {index + 1}</span> */}
                          
//                         </div>

//                         <div className="shift-field">
//                           {/* <label>Staff</label> */}
//                           <select
//                             disabled={isLocked}
//                             value={s.uid}
//                             onChange={(e) => {
//                               const selectedUid = e.target.value;
//                               const selectedStaff = staffApproved.find((st) => st.uid === selectedUid);
//                               updateShift(s.id, {
//                                 uid: selectedUid,
//                                 staffName: selectedStaff?.name || "",
//                               });
//                             }}
//                           >
//                             {/* <option value="">Select Staff</option> */}
//                             {staffApproved.map((st) => {
//                               const alreadyUsed =
//                                 usedStaffByDate[s.date]?.has(st.uid) && s.uid !== st.uid;

//                               return (
//                                 <option key={st.uid} value={st.uid} disabled={alreadyUsed}>
//                                   {st.name} {alreadyUsed ? "• already on this day" : ""}
//                                 </option>
//                               );
//                             })}
//                           </select>
//                         </div>

//                         <div className="shift-field">
//                           {/* <label>Store</label> */}
//                           <select
//                             disabled={isLocked}
//                             value={s.storeId}
//                             onChange={(e) => updateShift(s.id, { storeId: e.target.value })}
//                           >
//                             {stores.map((st) => (
//                               <option key={st.id} value={st.id}>
//                                 {st.label}
//                               </option>
//                             ))}
//                           </select>
//                         </div>

//                         <div className="time-row clean">
//                           <div className="shift-field">
//                             {/* <label>Start</label> */}
//                             <input
//                               type="time"
//                               disabled={isLocked}
//                               value={s.startPlanned}
//                               onChange={(e) => updateShift(s.id, { startPlanned: e.target.value })}
//                             />
//                           </div>

//                           <div className="shift-field">
//                             {/* <label>End</label> */}
//                             <input
//                               type="time"
//                               disabled={isLocked}
//                               value={s.endPlanned}
//                               onChange={(e) => updateShift(s.id, { endPlanned: e.target.value })}
//                             />
//                           </div>
//                         </div>


//                         {!isLocked && (
//                             <button className="del-btn compact" onClick={() => deleteShift(s.id)}>
//                               Remove
//                             </button>
//                           )}

//                         {duplicateForThisShift && (
//                           <div className="shift-error-text">
//                             This staff is already assigned on this day.
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }



















// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   addDoc,
//   collection,
//   deleteDoc,
//   doc,
//   getDoc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
//   writeBatch,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import {
//   addDays,
//   getWeekStartMonday,
//   prettyDate,
//   toYMD,
//   weekDates,
// } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import "./RosterManager.css";
// import { useStores } from "../../hooks/useStore";

// export default function RosterManager() {
//   const { showToast } = useToast();
//   const { stores, getStoreLabel } = useStores();

//   const [weekStart, setWeekStart] = useState(
//     toYMD(getWeekStartMonday(addDays(new Date(), 7)))
//   );
//   const [weekStatus, setWeekStatus] = useState("draft");
//   const [publishedStores, setPublishedStores] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [staffApproved, setStaffApproved] = useState([]);
//   const [shifts, setShifts] = useState([]);
//   const [openDays, setOpenDays] = useState({});
//   const [selectedStoreId, setSelectedStoreId] = useState("all");
//   const [viewMode, setViewMode] = useState("week");
//   const [selectedDay, setSelectedDay] = useState("");

//   const weekStartDateObj = useMemo(
//     () => new Date(weekStart + "T00:00:00"),
//     [weekStart]
//   );

//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   useEffect(() => {
//     if (days.length > 0 && !selectedDay) {
//       setSelectedDay(toYMD(days[0]));
//     }
//   }, [days, selectedDay]);

//   useEffect(() => {
//     const initial = {};
//     days.forEach((d) => {
//       initial[toYMD(d)] = false;
//     });
//     setOpenDays(initial);
//   }, [weekStart]);

//   const isLocked =
//     selectedStoreId !== "all" && publishedStores?.[selectedStoreId] === true;

//   const filteredShifts = useMemo(() => {
//     let list = [...shifts];

//     if (selectedStoreId !== "all") {
//       list = list.filter((s) => s.storeId === selectedStoreId);
//     }

//     if (viewMode === "day" && selectedDay) {
//       list = list.filter((s) => s.date === selectedDay);
//     }

//     return list;
//   }, [shifts, selectedStoreId, viewMode, selectedDay]);

//   const visibleDays = useMemo(() => {
//     if (viewMode === "day" && selectedDay) {
//       return days.filter((d) => toYMD(d) === selectedDay);
//     }
//     return days;
//   }, [days, viewMode, selectedDay]);

//   const shiftsByDate = useMemo(() => {
//     const map = {};
//     filteredShifts.forEach((s) => {
//       if (!map[s.date]) map[s.date] = [];
//       map[s.date].push(s);
//     });
//     return map;
//   }, [filteredShifts]);

//   const usedStaffByDate = useMemo(() => {
//     const map = {};
//     shifts.forEach((s) => {
//       if (!s.date || !s.uid) return;
//       if (!map[s.date]) map[s.date] = new Set();
//       map[s.date].add(s.uid);
//     });
//     return map;
//   }, [shifts]);

//   const loadApprovedStaff = useCallback(async () => {
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
//           name:
//             `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() ||
//             d.data().email ||
//             d.id,
//         }))
//         .sort((a, b) => a.name.localeCompare(b.name));
//       setStaffApproved(list);
//     } catch (e) {
//       showToast("Error loading staff list", "error");
//     }
//   }, [showToast]);

//   const loadWeek = useCallback(async () => {
//     setLoading(true);
//     try {
//       const weekRef = doc(db, "rosterWeeks", weekStart);
//       const weekSnap = await getDoc(weekRef);

//       if (!weekSnap.exists()) {
//         await setDoc(
//           weekRef,
//           {
//             weekStart,
//             status: "draft",
//             publishedStores: {},
//             createdAt: serverTimestamp(),
//           },
//           { merge: true }
//         );
//         setWeekStatus("draft");
//         setPublishedStores({});
//       } else {
//         const data = weekSnap.data();
//         setWeekStatus(data.status || "draft");
//         setPublishedStores(data.publishedStores || {});
//       }

//       const shiftsSnap = await getDocs(
//         collection(db, "rosterWeeks", weekStart, "shifts")
//       );

//       setShifts(
//         shiftsSnap.docs
//           .map((d) => ({ id: d.id, ...d.data() }))
//           .sort(
//             (a, b) =>
//               a.date.localeCompare(b.date) ||
//               (a.startPlanned || "").localeCompare(b.startPlanned || "")
//           )
//       );
//     } catch (e) {
//       showToast("Error loading roster week", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [weekStart, showToast]);

//   useEffect(() => {
//     loadApprovedStaff();
//   }, [loadApprovedStaff]);

//   useEffect(() => {
//     loadWeek();
//   }, [loadWeek]);

//   const issues = useMemo(() => {
//     const errs = [];
//     const duplicateCheck = {};

//     const relevantShifts =
//       selectedStoreId === "all"
//         ? shifts
//         : shifts.filter((s) => s.storeId === selectedStoreId);

//     relevantShifts.forEach((s) => {
//       if (!s.uid) errs.push(`Missing staff on ${s.date}`);
//       if (s.startPlanned >= s.endPlanned) errs.push(`Invalid time on ${s.date}`);

//       if (s.uid && s.date) {
//         const key = `${s.date}_${s.uid}`;
//         duplicateCheck[key] = (duplicateCheck[key] || 0) + 1;
//       }
//     });

//     Object.entries(duplicateCheck).forEach(([key, count]) => {
//       if (count > 1) {
//         const [date] = key.split("_");
//         errs.push(`Duplicate staff assignment on ${date}`);
//       }
//     });

//     return errs;
//   }, [shifts, selectedStoreId]);

//   const summary = useMemo(() => {
//     const visible = filteredShifts;
//     const uniqueStaff = new Set(visible.filter((s) => s.uid).map((s) => s.uid));

//     return {
//       totalShifts: visible.length,
//       totalStaff: uniqueStaff.size,
//       publishState:
//         selectedStoreId === "all"
//           ? "Select a store to publish"
//           : publishedStores?.[selectedStoreId]
//           ? "Published"
//           : "Draft",
//     };
//   }, [filteredShifts, selectedStoreId, publishedStores]);

//   function isDuplicateStaffForDay(targetShiftId, date, uid) {
//     if (!uid || !date) return false;
//     return shifts.some(
//       (s) => s.id !== targetShiftId && s.date === date && s.uid === uid
//     );
//   }

//   async function addShift(ymd) {
//     if (isLocked) return;
//     try {
//       const defaultStoreId =
//         selectedStoreId !== "all"
//           ? selectedStoreId
//           : stores?.[0]?.id || "";

//       const shiftsCol = collection(db, "rosterWeeks", weekStart, "shifts");
//       await addDoc(shiftsCol, {
//         uid: "",
//         staffName: "",
//         storeId: defaultStoreId,
//         date: ymd,
//         startPlanned: "13:00",
//         endPlanned: "22:00",
//         updatedAt: serverTimestamp(),
//       });
//       loadWeek();
//       showToast("Shift added", "success");
//     } catch (e) {
//       showToast("Could not add shift", "error");
//     }
//   }

//   async function updateShift(shiftId, patch) {
//     if (isLocked) return;

//     const current = shifts.find((s) => s.id === shiftId);
//     if (!current) return;

//     const next = { ...current, ...patch };

//     if (patch.uid && isDuplicateStaffForDay(shiftId, next.date, patch.uid)) {
//       showToast("This staff is already assigned on this day", "error");
//       return;
//     }

//     if (
//       next.startPlanned &&
//       next.endPlanned &&
//       next.startPlanned >= next.endPlanned
//     ) {
//       showToast("End time must be after start time", "error");
//       return;
//     }

//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart, "shifts", shiftId), {
//         ...patch,
//         updatedAt: serverTimestamp(),
//       });

//       setShifts((prev) =>
//         prev.map((s) => (s.id === shiftId ? { ...s, ...patch } : s))
//       );
//     } catch (e) {
//       showToast("Update failed", "error");
//     }
//   }

//   async function togglePublish() {
//     if (selectedStoreId === "all") {
//       showToast("Please select a single store to publish", "error");
//       return;
//     }

//     const selectedStoreShifts = shifts.filter((s) => s.storeId === selectedStoreId);

//     if (selectedStoreShifts.length === 0) {
//       showToast("No shifts found for selected store", "error");
//       return;
//     }

//     const selectedStoreIssues = selectedStoreShifts.filter(
//       (s) => !s.uid || s.startPlanned >= s.endPlanned
//     );

//     if (!isLocked && selectedStoreIssues.length > 0) {
//       showToast(`Fix ${selectedStoreIssues.length} issues before publishing`, "error");
//       return;
//     }

//     const nextPublished = !publishedStores?.[selectedStoreId];

//     if (
//       publishedStores?.[selectedStoreId] &&
//       !window.confirm("Unlock this store roster for editing?")
//     ) {
//       return;
//     }

//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart), {
//         [`publishedStores.${selectedStoreId}`]: nextPublished,
//         updatedAt: serverTimestamp(),
//       });

//       setPublishedStores((prev) => ({
//         ...prev,
//         [selectedStoreId]: nextPublished,
//       }));

//       showToast(
//         nextPublished
//           ? `Roster published for ${getStoreLabel?.(selectedStoreId) || selectedStoreId}`
//           : `Roster unlocked for ${getStoreLabel?.(selectedStoreId) || selectedStoreId}`,
//         "success"
//       );
//     } catch (e) {
//       showToast("Status update failed", "error");
//     }
//   }

//   async function copyPreviousWeek() {
//     if (isLocked) return;

//     try {
//       const prevWeek = toYMD(addDays(weekStartDateObj, -7));
//       const prevSnap = await getDocs(collection(db, "rosterWeeks", prevWeek, "shifts"));

//       if (prevSnap.empty) {
//         showToast("No shifts found in previous week", "error");
//         return;
//       }

//       let copied = prevSnap.docs.map((d) => {
//         const s = d.data();
//         return {
//           ...s,
//           date: toYMD(addDays(new Date(s.date + "T00:00:00"), 7)),
//         };
//       });

//       if (selectedStoreId !== "all") {
//         copied = copied.filter((s) => s.storeId === selectedStoreId);
//       }

//       if (copied.length === 0) {
//         showToast("No shifts found for selected store in previous week", "error");
//         return;
//       }

//       const duplicateCheck = new Set();
//       for (const s of copied) {
//         if (!s.uid || !s.date) continue;
//         const key = `${s.date}_${s.uid}`;
//         if (duplicateCheck.has(key)) {
//           showToast("Previous week contains duplicate staff on same day", "error");
//           return;
//         }
//         duplicateCheck.add(key);
//       }

//       const batch = writeBatch(db);

//       const currentWeekMatchingShifts =
//         selectedStoreId === "all"
//           ? shifts
//           : shifts.filter((s) => s.storeId === selectedStoreId);

//       if (currentWeekMatchingShifts.length > 0) {
//         if (
//           !window.confirm(
//             selectedStoreId === "all"
//               ? "Replace current week shifts with previous week?"
//               : "Replace current selected store shifts with previous week?"
//           )
//         ) {
//           return;
//         }

//         currentWeekMatchingShifts.forEach((s) =>
//           batch.delete(doc(db, "rosterWeeks", weekStart, "shifts", s.id))
//         );
//       }

//       copied.forEach((s) => {
//         const newRef = doc(collection(db, "rosterWeeks", weekStart, "shifts"));
//         batch.set(newRef, {
//           ...s,
//           updatedAt: serverTimestamp(),
//         });
//       });

//       await batch.commit();
//       loadWeek();
//       showToast("Roster copied from previous week", "success");
//     } catch (e) {
//       showToast("Error copying roster", "error");
//     }
//   }

//   async function deleteShift(sid) {
//     if (isLocked) return;
//     if (!window.confirm("Delete this shift?")) return;

//     try {
//       await deleteDoc(doc(db, "rosterWeeks", weekStart, "shifts", sid));
//       loadWeek();
//       showToast("Shift deleted", "success");
//     } catch (e) {
//       showToast("Delete failed", "error");
//     }
//   }

//   function toggleDayOpen(ymd) {
//     setOpenDays((prev) => ({
//       ...prev,
//       [ymd]: !prev[ymd],
//     }));
//   }

//   return (
//     <div className="admin-wrapper roster-page">
//       <header className="admin-header">
//         <div className="title-area">
//           <div>
//             <h1 className="main-title">Roster Manager</h1>
//             {/* <p className="roster-subtitle">Organize shifts for the selected week</p> */}
//           </div>
//           <span className={`status-pill ${selectedStoreId !== "all" && publishedStores?.[selectedStoreId] ? "published" : "draft"}`}>
//             {summary.publishState.toUpperCase()}
//           </span>
//         </div>

//         <div className="header-actions">
//           <button className="refresh-circle" onClick={loadWeek}>
//             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//               <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//             </svg>
//           </button>
//         </div>
//       </header>

//       <section className="roster-controls">
//         <div className="control-group">
//           <label>Week Starting</label>
//           <input
//             type="date"
//             value={weekStart}
//             onChange={(e) => setWeekStart(e.target.value)}
//           />
//         </div>

//         <div className="control-group">
//           <label>Store</label>
//           <select
//             value={selectedStoreId}
//             onChange={(e) => setSelectedStoreId(e.target.value)}
//           >
//             <option value="all">All Stores</option>
//             {stores.map((st) => (
//               <option key={st.id} value={st.id}>
//                 {st.label}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div className="control-group">
//           <label>View</label>
//           <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
//             <option value="week">Week View</option>
//             <option value="day">Day View</option>
//           </select>
//         </div>

//         {viewMode === "day" && (
//           <div className="control-group">
//             <label>Day</label>
//             <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
//               {days.map((d) => {
//                 const ymd = toYMD(d);
//                 return (
//                   <option key={ymd} value={ymd}>
//                     {prettyDate(d)}
//                   </option>
//                 );
//               })}
//             </select>
//           </div>
//         )}

//         <div className="button-row">
//           <button className="btn-sec" onClick={copyPreviousWeek} disabled={isLocked}>
//             Copy Prev
//           </button>
//           <button
//             className={`btn-primary ${isLocked ? "unlock" : "lock"}`}
//             onClick={togglePublish}
//             disabled={selectedStoreId === "all"}
//           >
//             {isLocked ? "Unlock Store" : "Publish Store"}
//           </button>
//         </div>
//       </section>

//       <section className="roster-summary-grid">
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Store</span>
//           <strong>{selectedStoreId === "all" ? "All Stores" : getStoreLabel?.(selectedStoreId) || selectedStoreId}</strong>
//         </div>
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Visible Shifts</span>
//           <strong>{summary.totalShifts}</strong>
//         </div>
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Assigned Staff</span>
//           <strong>{summary.totalStaff}</strong>
//         </div>
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Status</span>
//           <strong>{summary.publishState}</strong>
//         </div>
//       </section>

//       {issues.length > 0 && selectedStoreId !== "all" && !isLocked && (
//         <div className="validation-box">
//           <strong>Validation Alert:</strong> Fix {issues.length} issue{issues.length > 1 ? "s" : ""} before publishing.
//         </div>
//       )}

//       <div className="roster-grid cleaner">
//         {visibleDays.map((d) => {
//           const ymd = toYMD(d);
//           const dayShifts = (shiftsByDate[ymd] || []).sort(
//             (a, b) => (a.startPlanned || "").localeCompare(b.startPlanned || "")
//           );

//           return (
//             <div key={ymd} className="day-column clean collapsible-day">
//               <button
//                 type="button"
//                 className="day-header clean collapsible-trigger"
//                 onClick={() => toggleDayOpen(ymd)}
//               >
//                 <div className="day-text">
//                   <span className="day-name">{prettyDate(d).split(",")[0]}</span>
//                   <span className="day-date">{ymd}</span>
//                 </div>

//                 <div className="day-header-right">
//                   <span className="day-count">
//                     {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
//                   </span>

//                   {!isLocked && (
//                     <span
//                       className="add-shift-btn small-add"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         addShift(ymd);
//                       }}
//                     >
//                       +
//                     </span>
//                   )}

//                   <span className={`day-chevron ${openDays[ymd] ? "open" : ""}`}>⌄</span>
//                 </div>
//               </button>

//               {openDays[ymd] && (
//                 <div className="shift-list clean">
//                   {dayShifts.length === 0 && <div className="empty-day">No shifts</div>}

//                   {dayShifts.map((s, index) => {
//                     const duplicateForThisShift =
//                       !!s.uid && isDuplicateStaffForDay(s.id, s.date, s.uid);

//                     return (
//                       <div
//                         key={s.id}
//                         className={`shift-editor-card clean ${!s.uid || duplicateForThisShift ? "error" : ""}`}
//                       >
//                         <div className="shift-card-top">
//                           <span className="shift-number">Shift {index + 1}</span>
//                         </div>

//                         <div className="shift-field">
//                           <label style={{display:"block"}}>Staff {index + 1}</label>
//                           <select
//                             disabled={isLocked}
//                             value={s.uid}
//                             onChange={(e) => {
//                               const selectedUid = e.target.value;
//                               const selectedStaff = staffApproved.find((st) => st.uid === selectedUid);
//                               updateShift(s.id, {
//                                 uid: selectedUid,
//                                 staffName: selectedStaff?.name || "",
//                               });
//                             }}
//                           >
//                             <option value="">Select Staff</option>
//                             {staffApproved.map((st) => {
//                               const alreadyUsed =
//                                 usedStaffByDate[s.date]?.has(st.uid) && s.uid !== st.uid;

//                               return (
//                                 <option key={st.uid} value={st.uid} disabled={alreadyUsed}>
//                                   {st.name} {alreadyUsed ? "• already on this day" : ""}
//                                 </option>
//                               );
//                             })}
//                           </select>
//                         </div>

//                         <div className="shift-field">
//                           <label>Store</label>
//                           <select
//                             disabled={isLocked}
//                             value={s.storeId}
//                             onChange={(e) => updateShift(s.id, { storeId: e.target.value })}
//                           >
//                             {stores.map((st) => (
//                               <option key={st.id} value={st.id}>
//                                 {st.label}
//                               </option>
//                             ))}
//                           </select>
//                         </div>

//                         <div className="time-row clean">
//                           <div className="shift-field">
//                             <label>Start</label>
//                             <input
//                               type="time"
//                               disabled={isLocked}
//                               value={s.startPlanned}
//                               onChange={(e) => updateShift(s.id, { startPlanned: e.target.value })}
//                             />
//                           </div>

//                           <div className="shift-field">
//                             <label>End</label>
//                             <input
//                               type="time"
//                               disabled={isLocked}
//                               value={s.endPlanned}
//                               onChange={(e) => updateShift(s.id, { endPlanned: e.target.value })}
//                             />
//                           </div>
//                         </div>

//                         {!isLocked && (
//                           <button className="del-btn compact" onClick={() => deleteShift(s.id)}>
//                             Remove
//                           </button>
//                         )}

//                         {duplicateForThisShift && (
//                           <div className="shift-error-text">
//                             This staff is already assigned on this day.
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }























// import { useEffect, useMemo, useState, useCallback, useRef } from "react";
// import {
//   addDoc,
//   collection,
//   deleteDoc,
//   doc,
//   getDoc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
//   writeBatch,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import {
//   addDays,
//   getWeekStartMonday,
//   prettyDate,
//   toYMD,
//   weekDates,
// } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import "./RosterManager.css";
// import { useStores } from "../../hooks/useStore";

// function normalizeToMondayYMD(dateStr) {
//   if (!dateStr) return "";
//   const d = new Date(dateStr + "T00:00:00");
//   return toYMD(getWeekStartMonday(d));
// }

// export default function RosterManager() {
//   const { showToast } = useToast();
//   const { stores, getStoreLabel } = useStores();

//   const [weekStart, setWeekStart] = useState(
//     toYMD(getWeekStartMonday(addDays(new Date(), 7)))
//   );
//   const [weekStatus, setWeekStatus] = useState("draft");
//   const [publishedStores, setPublishedStores] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [staffApproved, setStaffApproved] = useState([]);
//   const [shifts, setShifts] = useState([]);
//   const [openDays, setOpenDays] = useState({});
//   const [selectedStoreId, setSelectedStoreId] = useState("all");
//   const [viewMode, setViewMode] = useState("week");
//   const [selectedDay, setSelectedDay] = useState("");

//   const dayRefs = useRef({});

//   const weekStartDateObj = useMemo(
//     () => new Date(weekStart + "T00:00:00"),
//     [weekStart]
//   );

//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   useEffect(() => {
//     const monday = normalizeToMondayYMD(weekStart);
//     if (weekStart && monday !== weekStart) {
//       setWeekStart(monday);
//     }
//   }, [weekStart]);

//   useEffect(() => {
//     if (days.length > 0 && !selectedDay) {
//       setSelectedDay(toYMD(days[0]));
//     }
//   }, [days, selectedDay]);

//   useEffect(() => {
//     const initial = {};
//     days.forEach((d) => {
//       initial[toYMD(d)] = false;
//     });
//     setOpenDays(initial);
//   }, [weekStart]);

//   const isLocked =
//     selectedStoreId !== "all" && publishedStores?.[selectedStoreId] === true;

//   const filteredShifts = useMemo(() => {
//     let list = [...shifts];

//     if (selectedStoreId !== "all") {
//       list = list.filter((s) => s.storeId === selectedStoreId);
//     }

//     if (viewMode === "day" && selectedDay) {
//       list = list.filter((s) => s.date === selectedDay);
//     }

//     return list;
//   }, [shifts, selectedStoreId, viewMode, selectedDay]);

//   const visibleDays = useMemo(() => {
//     if (viewMode === "day" && selectedDay) {
//       return days.filter((d) => toYMD(d) === selectedDay);
//     }
//     return days;
//   }, [days, viewMode, selectedDay]);

//   const shiftsByDate = useMemo(() => {
//     const map = {};
//     filteredShifts.forEach((s) => {
//       if (!map[s.date]) map[s.date] = [];
//       map[s.date].push(s);
//     });
//     return map;
//   }, [filteredShifts]);

//   const usedStaffByDate = useMemo(() => {
//     const map = {};
//     shifts.forEach((s) => {
//       if (!s.date || !s.uid) return;
//       if (!map[s.date]) map[s.date] = new Set();
//       map[s.date].add(s.uid);
//     });
//     return map;
//   }, [shifts]);

//   const loadApprovedStaff = useCallback(async () => {
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
//           name:
//             `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() ||
//             d.data().email ||
//             d.id,
//         }))
//         .sort((a, b) => a.name.localeCompare(b.name));
//       setStaffApproved(list);
//     } catch (e) {
//       showToast("Error loading staff list", "error");
//     }
//   }, [showToast]);

//   const loadWeek = useCallback(async () => {
//     setLoading(true);
//     try {
//       const weekRef = doc(db, "rosterWeeks", weekStart);
//       const weekSnap = await getDoc(weekRef);

//       if (!weekSnap.exists()) {
//         await setDoc(
//           weekRef,
//           {
//             weekStart,
//             status: "draft",
//             publishedStores: {},
//             createdAt: serverTimestamp(),
//           },
//           { merge: true }
//         );
//         setWeekStatus("draft");
//         setPublishedStores({});
//       } else {
//         const data = weekSnap.data();
//         setWeekStatus(data.status || "draft");
//         setPublishedStores(data.publishedStores || {});
//       }

//       const shiftsSnap = await getDocs(
//         collection(db, "rosterWeeks", weekStart, "shifts")
//       );

//       setShifts(
//         shiftsSnap.docs
//           .map((d) => ({ id: d.id, ...d.data() }))
//           .sort(
//             (a, b) =>
//               a.date.localeCompare(b.date) ||
//               (a.startPlanned || "").localeCompare(b.startPlanned || "")
//           )
//       );
//     } catch (e) {
//       showToast("Error loading roster week", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [weekStart, showToast]);

//   useEffect(() => {
//     loadApprovedStaff();
//   }, [loadApprovedStaff]);

//   useEffect(() => {
//     loadWeek();
//   }, [loadWeek]);

//   const issues = useMemo(() => {
//     const errs = [];
//     const duplicateCheck = {};

//     const relevantShifts =
//       selectedStoreId === "all"
//         ? shifts
//         : shifts.filter((s) => s.storeId === selectedStoreId);

//     relevantShifts.forEach((s) => {
//       if (!s.uid) errs.push(`Missing staff on ${s.date}`);
//       if (s.startPlanned >= s.endPlanned) errs.push(`Invalid time on ${s.date}`);

//       if (s.uid && s.date) {
//         const key = `${s.date}_${s.uid}`;
//         duplicateCheck[key] = (duplicateCheck[key] || 0) + 1;
//       }
//     });

//     Object.entries(duplicateCheck).forEach(([key, count]) => {
//       if (count > 1) {
//         const [date] = key.split("_");
//         errs.push(`Duplicate staff assignment on ${date}`);
//       }
//     });

//     return errs;
//   }, [shifts, selectedStoreId]);

//   const summary = useMemo(() => {
//     const visible = filteredShifts;
//     const uniqueStaff = new Set(visible.filter((s) => s.uid).map((s) => s.uid));

//     return {
//       totalShifts: visible.length,
//       totalStaff: uniqueStaff.size,
//       publishState:
//         selectedStoreId === "all"
//           ? "Select a store to publish"
//           : publishedStores?.[selectedStoreId]
//           ? "Published"
//           : "Draft",
//     };
//   }, [filteredShifts, selectedStoreId, publishedStores]);

//   function isDuplicateStaffForDay(targetShiftId, date, uid) {
//     if (!uid || !date) return false;
//     return shifts.some(
//       (s) => s.id !== targetShiftId && s.date === date && s.uid === uid
//     );
//   }

//   async function addShift(ymd) {
//     if (isLocked) return;
//     try {
//       const defaultStoreId =
//         selectedStoreId !== "all"
//           ? selectedStoreId
//           : stores?.[0]?.id || "";

//       const shiftsCol = collection(db, "rosterWeeks", weekStart, "shifts");
//       await addDoc(shiftsCol, {
//         uid: "",
//         staffName: "",
//         storeId: defaultStoreId,
//         date: ymd,
//         startPlanned: "13:00",
//         endPlanned: "22:00",
//         updatedAt: serverTimestamp(),
//       });
//       loadWeek();
//       showToast("Shift added", "success");
//     } catch (e) {
//       showToast("Could not add shift", "error");
//     }
//   }

//   async function updateShift(shiftId, patch) {
//     if (isLocked) return;

//     const current = shifts.find((s) => s.id === shiftId);
//     if (!current) return;

//     const next = { ...current, ...patch };

//     if (patch.uid && isDuplicateStaffForDay(shiftId, next.date, patch.uid)) {
//       showToast("This staff is already assigned on this day", "error");
//       return;
//     }

//     if (
//       next.startPlanned &&
//       next.endPlanned &&
//       next.startPlanned >= next.endPlanned
//     ) {
//       showToast("End time must be after start time", "error");
//       return;
//     }

//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart, "shifts", shiftId), {
//         ...patch,
//         updatedAt: serverTimestamp(),
//       });

//       setShifts((prev) =>
//         prev.map((s) => (s.id === shiftId ? { ...s, ...patch } : s))
//       );
//     } catch (e) {
//       showToast("Update failed", "error");
//     }
//   }

//   async function togglePublish() {
//     if (selectedStoreId === "all") {
//       showToast("Please select a single store to publish", "error");
//       return;
//     }

//     const selectedStoreShifts = shifts.filter((s) => s.storeId === selectedStoreId);

//     if (selectedStoreShifts.length === 0) {
//       showToast("No shifts found for selected store", "error");
//       return;
//     }

//     const selectedStoreIssues = selectedStoreShifts.filter(
//       (s) => !s.uid || s.startPlanned >= s.endPlanned
//     );

//     if (!isLocked && selectedStoreIssues.length > 0) {
//       showToast(`Fix ${selectedStoreIssues.length} issues before publishing`, "error");
//       return;
//     }

//     const nextPublished = !publishedStores?.[selectedStoreId];

//     if (
//       publishedStores?.[selectedStoreId] &&
//       !window.confirm("Unlock this store roster for editing?")
//     ) {
//       return;
//     }

//     try {
//       await updateDoc(doc(db, "rosterWeeks", weekStart), {
//         [`publishedStores.${selectedStoreId}`]: nextPublished,
//         updatedAt: serverTimestamp(),
//       });

//       setPublishedStores((prev) => ({
//         ...prev,
//         [selectedStoreId]: nextPublished,
//       }));

//       showToast(
//         nextPublished
//           ? `Roster published for ${getStoreLabel?.(selectedStoreId) || selectedStoreId}`
//           : `Roster unlocked for ${getStoreLabel?.(selectedStoreId) || selectedStoreId}`,
//         "success"
//       );
//     } catch (e) {
//       showToast("Status update failed", "error");
//     }
//   }

//   async function copyPreviousWeek() {
//     if (isLocked) return;

//     try {
//       const prevWeek = toYMD(addDays(weekStartDateObj, -7));
//       const prevSnap = await getDocs(collection(db, "rosterWeeks", prevWeek, "shifts"));

//       if (prevSnap.empty) {
//         showToast("No shifts found in previous week", "error");
//         return;
//       }

//       let copied = prevSnap.docs.map((d) => {
//         const s = d.data();
//         return {
//           ...s,
//           date: toYMD(addDays(new Date(s.date + "T00:00:00"), 7)),
//         };
//       });

//       if (selectedStoreId !== "all") {
//         copied = copied.filter((s) => s.storeId === selectedStoreId);
//       }

//       if (copied.length === 0) {
//         showToast("No shifts found for selected store in previous week", "error");
//         return;
//       }

//       const duplicateCheck = new Set();
//       for (const s of copied) {
//         if (!s.uid || !s.date) continue;
//         const key = `${s.date}_${s.uid}`;
//         if (duplicateCheck.has(key)) {
//           showToast("Previous week contains duplicate staff on same day", "error");
//           return;
//         }
//         duplicateCheck.add(key);
//       }

//       const batch = writeBatch(db);

//       const currentWeekMatchingShifts =
//         selectedStoreId === "all"
//           ? shifts
//           : shifts.filter((s) => s.storeId === selectedStoreId);

//       if (currentWeekMatchingShifts.length > 0) {
//         if (
//           !window.confirm(
//             selectedStoreId === "all"
//               ? "Replace current week shifts with previous week?"
//               : "Replace current selected store shifts with previous week?"
//           )
//         ) {
//           return;
//         }

//         currentWeekMatchingShifts.forEach((s) =>
//           batch.delete(doc(db, "rosterWeeks", weekStart, "shifts", s.id))
//         );
//       }

//       copied.forEach((s) => {
//         const newRef = doc(collection(db, "rosterWeeks", weekStart, "shifts"));
//         batch.set(newRef, {
//           ...s,
//           updatedAt: serverTimestamp(),
//         });
//       });

//       await batch.commit();
//       loadWeek();
//       showToast("Roster copied from previous week", "success");
//     } catch (e) {
//       showToast("Error copying roster", "error");
//     }
//   }

//   async function deleteShift(sid) {
//     if (isLocked) return;
//     if (!window.confirm("Delete this shift?")) return;

//     try {
//       await deleteDoc(doc(db, "rosterWeeks", weekStart, "shifts", sid));
//       loadWeek();
//       showToast("Shift deleted", "success");
//     } catch (e) {
//       showToast("Delete failed", "error");
//     }
//   }

  

//   function toggleDayOpen(ymd) {
//     setOpenDays((prev) => {
//       const isCurrentlyOpen = !!prev[ymd];
  
//       const next = {};
//       Object.keys(prev).forEach((key) => {
//         next[key] = false;
//       });
  
//       if (!isCurrentlyOpen) {
//         next[ymd] = true;
  
//         // Scroll into view after slight delay
//         setTimeout(() => {
//           dayRefs.current[ymd]?.scrollIntoView({
//             behavior: "smooth",
//             block: "start", // aligns nicely at top
//           });
//         }, 150);
//       }
  
//       return next;
//     });
//   }














//   // function toggleAddOpen(ymd) {
//   //   setOpenDays((prev) => {
//   //     const isCurrentlyOpen = !!prev[ymd];
  
//   //     const next = {};
//   //     Object.keys(prev).forEach((key) => {
//   //       next[key] = false;
//   //     });
  
//   //     if (!isCurrentlyOpen) {
//   //       next[ymd] = true;
  
//   //       setTimeout(() => {
//   //         const el = dayRefs.current[ymd];
//   //         if (!el) return;
  
//   //         const y = el.getBoundingClientRect().top + window.pageYOffset - 110;
//   //         window.scrollTo({
//   //           top: y,
//   //           behavior: "smooth",
//   //         });
//   //       }, 150);
//   //     }
//   //   });
//   // }


//   function toggleAddOpen(ymd) {
//     setOpenDays((prev) => {
//       // If it's already open, do nothing and return the current state
//       if (prev[ymd]) return prev;
  
//       // Otherwise, close everything else and open ONLY this one
//       return { [ymd]: true };
//     });
  
//     // Always attempt the scroll when the function is called
//     setTimeout(() => {
//       const el = dayRefs.current[ymd];
//       if (!el) return;
  
//       const y = el.getBoundingClientRect().top + window.pageYOffset - 110;
      
//       window.scrollTo({
//         top: y,
//         behavior: "smooth",
//       });
//     }, 150);
//   }



  

//   return (
//     <div className="admin-wrapper roster-page">
//       <header className="admin-header">
//         <div className="title-area">
//           <div>
//             <h1 className="main-title">Roster Manager</h1>
//             {/* <p className="roster-subtitle">Organize shifts for the selected week</p> */}
//           </div>
//           <span className={`status-pill ${selectedStoreId !== "all" && publishedStores?.[selectedStoreId] ? "published" : "draft"}`}>
//             {summary.publishState.toUpperCase()}
//           </span>
//         </div>

//         <div className="header-actions">
//           <button className="refresh-circle" onClick={loadWeek}>
//             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//               <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//             </svg>
//           </button>
//         </div>
//       </header>

//       <section className="roster-controls">
//         <div className="control-group">
//           <label>Week Starting</label>
//           <input
//             type="date"
//             value={weekStart}
//             onChange={(e) => setWeekStart(normalizeToMondayYMD(e.target.value))}
//           />
//         </div>

//         <div className="control-group">
//           <label>Store</label>
//           <select
//             value={selectedStoreId}
//             onChange={(e) => setSelectedStoreId(e.target.value)}
//           >
//             <option value="all">All Stores</option>
//             {stores.map((st) => (
//               <option key={st.id} value={st.id}>
//                 {st.label}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div className="control-group">
//           <label>View</label>
//           <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
//             <option value="week">Week View</option>
//             <option value="day">Day View</option>
//           </select>
//         </div>

//         {viewMode === "day" && (
//           <div className="control-group">
//             <label>Day</label>
//             <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
//               {days.map((d) => {
//                 const ymd = toYMD(d);
//                 return (
//                   <option key={ymd} value={ymd}>
//                     {prettyDate(d)}
//                   </option>
//                 );
//               })}
//             </select>
//           </div>
//         )}

//         <div className="button-row">
//           <button className="btn-sec" onClick={copyPreviousWeek} disabled={isLocked}>
//             Copy Prev
//           </button>
//           <button
//             className={`btn-primary ${isLocked ? "unlock" : "lock"}`}
//             onClick={togglePublish}
//             disabled={selectedStoreId === "all"}
//           >
//             {isLocked ? "Unlock Store" : "Publish Store"}
//           </button>
//         </div>
//       </section>

//       <section className="roster-summary-grid">
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Store</span>
//           <strong>{selectedStoreId === "all" ? "All Stores" : getStoreLabel?.(selectedStoreId) || selectedStoreId}</strong>
//         </div>
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Visible Shifts</span>
//           <strong>{summary.totalShifts}</strong>
//         </div>
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Assigned Staff</span>
//           <strong>{summary.totalStaff}</strong>
//         </div>
//         <div className="summary-card-mini">
//           <span className="summary-label-mini">Status</span>
//           <strong>{summary.publishState}</strong>
//         </div>
//       </section>

//       {issues.length > 0 && selectedStoreId !== "all" && !isLocked && (
//         <div className="validation-box">
//           <strong>Validation Alert:</strong> Fix {issues.length} issue{issues.length > 1 ? "s" : ""} before publishing.
//         </div>
//       )}

//       <div className="roster-grid cleaner">
//         {visibleDays.map((d) => {
//           const ymd = toYMD(d);
//           const dayShifts = (shiftsByDate[ymd] || []).sort(
//             (a, b) => (a.startPlanned || "").localeCompare(b.startPlanned || "")
//           );

//           return (
//             // <div key={ymd} className="day-column clean collapsible-day">
//               <div
//                 key={ymd}
//                 ref={(el) => (dayRefs.current[ymd] = el)}
//                 className="day-column clean collapsible-day"
//               >
//               <button
//                 type="button"
//                 className="day-header clean collapsible-trigger"
//                 onClick={() => toggleDayOpen(ymd)}
//               >
//                 <div className="day-text">
//                   <span className="day-name">{prettyDate(d).split(",")[0]}</span>
//                   <span className="day-date">{ymd}</span>
//                 </div>

//                 <div className="day-header-right">
//                   <span className="day-count">
//                     {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
//                   </span>

//                   {!isLocked && (
//                     <button
//                       // className="add-shift-btn small-add"
//                       className={`btn-primary ${isLocked ? "unlock" : "lock"}`}
                      
//                       disabled={selectedStoreId === "all"}
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         toggleAddOpen(ymd);
//                         addShift(ymd);

//                       }}
//                     >
//                       +
//                     </button>
//                   )}

//                   <span className={`day-chevron ${openDays[ymd] ? "open" : ""}`}>⌄</span>
//                 </div>
//               </button>

//               {openDays[ymd] && (
//                 <div className="shift-list clean">
//                   {dayShifts.length === 0 && <div className="empty-day">No shifts</div>}

//                   {dayShifts.map((s, index) => {
//                     const duplicateForThisShift =
//                       !!s.uid && isDuplicateStaffForDay(s.id, s.date, s.uid);

//                     return (
//                       <div
//                         key={s.id}
//                         className={`shift-editor-card clean ${!s.uid || duplicateForThisShift ? "error" : ""}`}
//                       >
//                         <div className="shift-card-top">
//                           <span className="shift-number">Shift {index + 1}</span>
//                         </div>

//                         <div className="shift-field">
//                           <label style={{ display: "block" }}>Staff {index + 1}</label>
//                           <select
//                             disabled={isLocked}
//                             value={s.uid}
//                             onChange={(e) => {
//                               const selectedUid = e.target.value;
//                               const selectedStaff = staffApproved.find((st) => st.uid === selectedUid);
//                               updateShift(s.id, {
//                                 uid: selectedUid,
//                                 staffName: selectedStaff?.name || "",
//                               });
//                             }}
//                           >
//                             <option value="">Select Staff</option>
//                             {staffApproved.map((st) => {
//                               const alreadyUsed =
//                                 usedStaffByDate[s.date]?.has(st.uid) && s.uid !== st.uid;

//                               return (
//                                 <option key={st.uid} value={st.uid} disabled={alreadyUsed}>
//                                   {st.name} {alreadyUsed ? "• already on this day" : ""}
//                                 </option>
//                               );
//                             })}
//                           </select>
//                         </div>

//                         <div className="shift-field">
//                           <label>Store</label>
//                           <select
//                             disabled={isLocked}
//                             value={s.storeId}
//                             onChange={(e) => updateShift(s.id, { storeId: e.target.value })}
//                           >
//                             {stores.map((st) => (
//                               <option key={st.id} value={st.id}>
//                                 {st.label}
//                               </option>
//                             ))}
//                           </select>
//                         </div>

//                         <div className="time-row clean">
//                           <div className="shift-field">
//                             <label>Start</label>
//                             <input
//                               type="time"
//                               disabled={isLocked}
//                               value={s.startPlanned}
//                               onChange={(e) => updateShift(s.id, { startPlanned: e.target.value })}
//                             />
//                           </div>

//                           <div className="shift-field">
//                             <label>End</label>
//                             <input
//                               type="time"
//                               disabled={isLocked}
//                               value={s.endPlanned}
//                               onChange={(e) => updateShift(s.id, { endPlanned: e.target.value })}
//                             />
//                           </div>
//                         </div>

//                         {!isLocked && (
//                           <button className="del-btn compact" onClick={() => deleteShift(s.id)}>
//                             Remove
//                           </button>
//                         )}

//                         {duplicateForThisShift && (
//                           <div className="shift-error-text">
//                             This staff is already assigned on this day.
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }











import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./StockManager.css";
import { useNavigate } from "react-router-dom";
// Import the modal
// import StockTakeModal from "./StockTakeModal"; 

export default function StockManager() {
  const { showToast } = useToast();
  const { stores, getStoreLabel } = useStores();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stockRecords, setStockRecords] = useState([]);
  const [filterDate, setFilterDate] = useState(toYMD(new Date()));
  const [filterStore, setFilterStore] = useState("all");
  
  // NEW: State for Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    loadStockRecords();
  }, [filterDate, filterStore]);

  async function loadStockRecords() {
    setLoading(true);
    try {
      let q = query(
        collection(db, "dailyStockTake"),
        where("date", "==", filterDate)
      );
      const snap = await getDocs(q);
      let records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (filterStore !== "all") {
        records = records.filter((r) => r.storeId === filterStore);
      }
      setStockRecords(records);
    } catch (e) {
      showToast("Error loading records", "error");
    } finally {
      setLoading(false);
    }
  }

  const updateItemQtySent = (recordId, itemIndex, val) => {
    setStockRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) return record;
        const newItems = [...record.items];
        newItems[itemIndex] = { ...newItems[itemIndex], qtySent: val };
        return { ...record, items: newItems };
      })
    );
  };

  const deleteItemFromRecord = async (record, itemIndex) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      const updatedItems = record.items.filter((_, idx) => idx !== itemIndex);
      if (updatedItems.length === 0) {
        showToast("Cannot delete last item. Delete full record.", "warning");
        return;
      }
      await updateDoc(doc(db, "dailyStockTake", record.id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });
      showToast("Item deleted", "success");
      loadStockRecords();
    } catch (e) { showToast("Delete failed", "error"); }
  };

  const deleteEntireRecord = async (record) => {
    if (!window.confirm(`Delete record for ${getStoreLabel(record.storeId)}?`)) return;
    try {
      await deleteDoc(doc(db, "dailyStockTake", record.id));
      showToast("Deleted", "success");
      loadStockRecords();
    } catch (e) { showToast("Delete failed", "error"); }
  };

  const markAsDone = async (record) => {
    try {
      const updatedItems = record.items.map((it) => ({
        ...it,
        status: Number(it.qtySent) >= Number(it.qtyRequested) ? "fulfilled" : "partial",
      }));
      await updateDoc(doc(db, "dailyStockTake", record.id), {
        items: updatedItems,
        adminProcessed: true,
        processedAt: serverTimestamp(),
      });
      showToast("Updated", "success");
      loadStockRecords();
    } catch (e) { showToast("Update failed", "error"); }
  };

  const downloadPDF = (record) => {
    const docPdf = new jsPDF();
    docPdf.text("Stock Dispatch Manifest", 14, 15);
    const tableRows = record.items.map((it) => [it.name, it.qtyRequested, it.qtySent, it.status || ""]);
    autoTable(docPdf, { head: [["Item", "Req", "Sent", "Status"]], body: tableRows, startY: 30 });
    docPdf.save(`Dispatch_${record.date}.pdf`);
  };

  return (
    <div className="stock-admin-wrapper">
      <header className="stock-admin-header">
        <div className="title-block">
          <button className="back-btn" onClick={() => navigate("/admin/dashboard")}>
            ← Back
          </button>
          <h1>Stock Management</h1>
        </div>

        <div className="admin-filters-bar">
          <input type="date" className="filter-input" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          <select className="filter-select" value={filterStore} onChange={(e) => setFilterStore(e.target.value)}>
            <option value="all">All Stores</option>
            {stores.map((s) => ( <option key={s.id} value={s.id}>{s.label}</option> ))}
          </select>
          
          {/* NEW: CREATE BUTTON */}
          <button 
            className="btn-dispatch primary" 
            onClick={() => setIsAddModalOpen(true)}
            style={{ marginLeft: '10px', padding: '10px 20px' }}
          >
            + Add New Request
          </button>
        </div>
      </header>

      {loading ? (
        <div className="admin-loader">Loading...</div>
      ) : (
        <div className="stock-grid">
          {stockRecords.map((record) => (
             <div key={record.id} className={`admin-stock-card ${record.adminProcessed ? "processed" : ""}`}>
                {/* ... existing card JSX (same as you provided) ... */}
                <div className="card-header">
                  <h3>{getStoreLabel(record.storeId)}</h3>
                  <div style={{display:'flex', gap:'5px'}}>
                    <button onClick={() => downloadPDF(record)} className="btn-pdf">PDF</button>
                    <button onClick={() => deleteEntireRecord(record)} className="btn-delete">Delete</button>
                  </div>
                </div>
                <table className="stock-fulfillment-table">
                    <thead><tr><th>Item</th><th>Req</th><th>Sending</th></tr></thead>
                    <tbody>
                      {record.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.name}</td>
                          <td>{item.qtyRequested}</td>
                          <td>
                            <input 
                              type="number" 
                              value={item.qtySent} 
                              onChange={(e) => updateItemQtySent(record.id, idx, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                </table>
                <button className="btn-dispatch primary" onClick={() => markAsDone(record)}>
                  Confirm Dispatch
                </button>
             </div>
          ))}
        </div>
      )}

      {/* NEW: ADD MODAL COMPONENT */}
      {isAddModalOpen && (
        <StockTakeModal
          storeId={filterStore === "all" ? "" : filterStore}
          date={filterDate}
          uid="ADMIN_USER"
          profile={{ firstName: "Admin", lastName: "(Manual)" }}
          stores={stores} // Pass stores list for dropdown
          onClose={() => setIsAddModalOpen(false)}
          onComplete={() => {
            setIsAddModalOpen(false);
            loadStockRecords();
          }}
        />
      )}
    </div>
  );
}