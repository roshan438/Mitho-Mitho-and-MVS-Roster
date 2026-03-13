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

  

//   // function toggleDayOpen(ymd) {
//   //   setOpenDays((prev) => {
//   //     const isCurrentlyOpen = !!prev[ymd];
  
//   //     const next = {};
//   //     Object.keys(prev).forEach((key) => {
//   //       next[key] = false;
//   //     });
  
//   //     if (!isCurrentlyOpen) {
//   //       next[ymd] = true;
  
//   //       // Scroll into view after slight delay
//   //       setTimeout(() => {
//   //         dayRefs.current[ymd]?.scrollIntoView({
//   //           behavior: "smooth",
//   //           block: "start", // aligns nicely at top
//   //         });
//   //       }, 150);
//   //     }
  
//   //     return next;
//   //   });
//   // }














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





//   function toggleDayOpen(ymd) {
//     setOpenDays((prev) => {
//       const isCurrentlyOpen = !!prev[ymd];
//       const isMobile = window.innerWidth <= 768; // Standard mobile breakpoint
  
//       // 1. If NOT mobile, allow multiple sections to stay open (standard desktop feel)
//       if (!isMobile) {
//         return {
//           ...prev,
//           [ymd]: !isCurrentlyOpen
//         };
//       }
  
//       // 2. If IS mobile, keep the original "One-at-a-time + Scroll" logic
//       const next = {};
//       Object.keys(prev).forEach((key) => {
//         next[key] = false;
//       });
  
//       if (!isCurrentlyOpen) {
//         next[ymd] = true;
  
//         setTimeout(() => {
//           dayRefs.current[ymd]?.scrollIntoView({
//             behavior: "smooth",
//             block: "start",
//           });
//         }, 150);
//       }
  
//       return next;
//     });
//   }




  


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
//   subDays,
//   getWeekStartMonday,
//   prettyDate,
//   toYMD,
//   weekDates,
// } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import { useStores } from "../../hooks/useStore";
// import "./RosterManager.css";

// export default function RosterManager() {
//   const { showToast } = useToast();
//   const { stores } = useStores();

//   const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
//   const [publishedStores, setPublishedStores] = useState({});
//   const [staffApproved, setStaffApproved] = useState([]);
//   const [shifts, setShifts] = useState([]);
//   const [selectedStoreId, setSelectedStoreId] = useState("all");
//   const [editingShift, setEditingShift] = useState(null);

//   const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   const visibleShifts = useMemo(() => {
//     if (selectedStoreId === "all") return shifts;
//     return shifts.filter(s => s.storeId === selectedStoreId);
//   }, [shifts, selectedStoreId]);

//   const shiftLookup = useMemo(() => {
//     const map = {};
//     visibleShifts.forEach((s) => {
//       const key = `${s.uid || "unassigned"}_${s.date}`;
//       if (!map[key]) map[key] = [];
//       map[key].push(s);
//     });
//     return map;
//   }, [visibleShifts]);

//   const isLocked = selectedStoreId !== "all" && publishedStores?.[selectedStoreId] === true;

//   // --- RESTORED: Add Shift Logic ---
//   async function addShift(ymd, uid = "") {
//     if (isLocked || selectedStoreId === "all") return;
    
//     const staff = staffApproved.find(s => s.uid === uid);
//     try {
//       const newShiftData = {
//         uid,
//         staffName: staff ? staff.name : "Unassigned",
//         date: ymd,
//         storeId: selectedStoreId,
//         role: staff?.role || "staff", 
//         startPlanned: "13:00",
//         endPlanned: "21:00",
//         updatedAt: serverTimestamp(),
//       };
      
//       const docRef = await addDoc(collection(db, "rosterWeeks", weekStart, "shifts"), newShiftData);
      
//       // Update local state immediately for a fast UI feel
//       setShifts(prev => [...prev, { id: docRef.id, ...newShiftData }]);
//       showToast("Shift added", "success");
//     } catch (e) {
//       showToast("Failed to add shift", "error");
//     }
//   }

//   const loadApprovedStaff = useCallback(async () => {
//     const qs = query(collection(db, "users"), where("role", "in", ["staff", "admin"]), where("status", "==", "approved"));
//     const snap = await getDocs(qs);
//     setStaffApproved(snap.docs.map(d => ({ uid: d.id, ...d.data(), name: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim() })));
//   }, []);

//   const loadWeek = useCallback(async () => {
//     const weekRef = doc(db, "rosterWeeks", weekStart);
//     const weekSnap = await getDoc(weekRef);
//     if (weekSnap.exists()) setPublishedStores(weekSnap.data().publishedStores || {});
//     const shiftsSnap = await getDocs(collection(db, "rosterWeeks", weekStart, "shifts"));
//     setShifts(shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
//   }, [weekStart]);

//   useEffect(() => { loadApprovedStaff(); loadWeek(); }, [loadApprovedStaff, loadWeek]);

//   async function copyPreviousWeek() {
//     if (selectedStoreId === "all") {
//       showToast("Select a store first", "error");
//       return;
//     }
//     const prevWeekStart = toYMD(subDays(new Date(weekStart + "T00:00:00"), 7));
//     try {
//       const prevShiftsSnap = await getDocs(query(collection(db, "rosterWeeks", prevWeekStart, "shifts"), where("storeId", "==", selectedStoreId)));
//       if (prevShiftsSnap.empty) {
//         showToast("No shifts to copy from last week", "info");
//         return;
//       }
//       const batch = writeBatch(db);
//       prevShiftsSnap.forEach((docSnap) => {
//         const data = docSnap.data();
//         const oldDate = new Date(data.date + "T00:00:00");
//         const newDate = toYMD(addDays(oldDate, 7));
//         const newRef = doc(collection(db, "rosterWeeks", weekStart, "shifts"));
//         batch.set(newRef, { ...data, date: newDate, updatedAt: serverTimestamp() });
//       });
//       await batch.commit();
//       loadWeek();
//       showToast("Roster copied", "success");
//     } catch (e) { showToast("Copy failed", "error"); }
//   }

//   return (
//     <div className="roster-page">
//       <header className="roster-header">
//         <div className="header-left">
//           <h1 className="mitho-title">Mitho Mitho Roster</h1>
//           <div className="week-nav">
//             <button className="nav-btn" onClick={() => setWeekStart(toYMD(subDays(weekStartDateObj, 7)))}>←</button>
//             <span className="date-display">{weekStart} — {toYMD(addDays(weekStartDateObj, 6))}</span>
//             <button className="nav-btn" onClick={() => setWeekStart(toYMD(addDays(weekStartDateObj, 7)))}>→</button>
//           </div>
//         </div>

//         <div className="header-right">
//           {selectedStoreId !== "all" && (
//             <button className="btn-secondary" onClick={copyPreviousWeek}>Copy Last Week</button>
//           )}
//           <select className="filter-select" value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
//             <option value="all">All Locations (View Only)</option>
//             {stores.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
//           </select>
//           <button className="btn-primary" disabled={selectedStoreId === "all"}>
//             {isLocked ? "Unpublish" : "Publish"}
//           </button>
//         </div>
//       </header>

//       <div className="roster-grid-container">
//         <div className="roster-grid">
//           <div className="grid-row header-row roster">
//             <div className="cell sticky-cell">Team Member</div>
//             {days.map(d => (
//               <div key={toYMD(d)} className="cell date-header">
//                 <strong>{prettyDate(d).split(',')[0]}</strong>
//                 <span>{toYMD(d).split("-")[2]}</span>
//               </div>
//             ))}
//           </div>

//           {staffApproved.map(staff => (
//             <div key={staff.uid} className="grid-row roster">
//               <div className="cell sticky-cell staff-cell">
//                 <strong>{staff.name}</strong>
//                 <span className="role-subtext">{staff.role}</span>
//               </div>
//               {days.map(d => {
//                 const ymd = toYMD(d);
//                 const dayShifts = shiftLookup[`${staff.uid}_${ymd}`] || [];
//                 return (
//                   <div key={ymd} className="cell">
//                     {dayShifts.map(s => (
//                       <div 
//                         key={s.id} 
//                         className={`shift-card ${(s.role || "staff").toLowerCase()}`}
//                         onClick={() => setEditingShift(s)}
//                       >
//                         <div className="card-top">{s.role || 'Staff'}</div>
//                         <div className="card-time">{s.startPlanned}-{s.endPlanned}</div>
//                       </div>
//                     ))}
//                     {!isLocked && selectedStoreId !== "all" && (
//                       <button className="add-btn-inline" onClick={() => addShift(ymd, staff.uid)}>+</button>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           ))}
//         </div>
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
//   subDays,
//   getWeekStartMonday,
//   prettyDate,
//   toYMD,
//   weekDates,
// } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import { useStores } from "../../hooks/useStore";
// import "./RosterManager.css";

// export default function RosterManager() {
//   const { showToast } = useToast();
//   const { stores } = useStores();

//   // --- State ---
//   // const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
  
//   // This calculates next Monday whenever the component first mounts
// const [weekStart, setWeekStart] = useState(() => {
//   const today = new Date();
//   const thisMonday = getWeekStartMonday(today);
//   const nextMonday = addDays(thisMonday, 7); // Jumps exactly 1 week ahead
//   return toYMD(nextMonday);
// });
  
//   const [publishedStores, setPublishedStores] = useState({});
//   const [staffApproved, setStaffApproved] = useState([]);
//   const [shifts, setShifts] = useState([]);
//   const [selectedStoreId, setSelectedStoreId] = useState("all");
//   const [editingShift, setEditingShift] = useState(null);
//   const [searchTerm, setSearchTerm] = useState("");


//   const jumpToCurrentWeek = () => {
//     setWeekStart(toYMD(getWeekStartMonday(new Date())));
//   };

//   // --- Derived Data ---
//   const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   // const nextWeekStart = useMemo(() => toYMD(addDays(weekStartDateObj, 7)), [weekStartDateObj]);
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   const filteredStaff = useMemo(() => {
//     return staffApproved.filter(s => 
//       s.name.toLowerCase().includes(searchTerm.toLowerCase())
//     );
//   }, [staffApproved, searchTerm]);

//   const visibleShifts = useMemo(() => {
//     if (selectedStoreId === "all") return shifts;
//     return shifts.filter(s => s.storeId === selectedStoreId);
//   }, [shifts, selectedStoreId]);

//   const shiftLookup = useMemo(() => {
//     const map = {};
//     visibleShifts.forEach((s) => {
//       const key = `${s.uid || "unassigned"}_${s.date}`;
//       if (!map[key]) map[key] = [];
//       map[key].push(s);
//     });
//     return map;
//   }, [visibleShifts]);

//   // LOCK LOGIC: true if roster is published OR no specific store is selected
//   const isLocked = selectedStoreId === "all" || publishedStores?.[selectedStoreId] === true;

//   // --- Data Loading ---
//   const loadApprovedStaff = useCallback(async () => {
//     const qs = query(
//       collection(db, "users"), 
//       where("role", "in", ["staff", "admin", "manager"]), 
//       where("status", "==", "approved")
//     );
//     const snap = await getDocs(qs);
//     setStaffApproved(snap.docs.map(d => ({ 
//       uid: d.id, 
//       ...d.data(), 
//       name: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim() 
//     })));
//   }, []);

//   const loadWeek = useCallback(async () => {
//     const weekRef = doc(db, "rosterWeeks", weekStart);
//     const weekSnap = await getDoc(weekRef);
//     if (weekSnap.exists()) setPublishedStores(weekSnap.data().publishedStores || {});
//     else setPublishedStores({});
    
//     const shiftsSnap = await getDocs(collection(db, "rosterWeeks", weekStart, "shifts"));
//     setShifts(shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
//   }, [weekStart]);

//   useEffect(() => { loadApprovedStaff(); loadWeek(); }, [loadApprovedStaff, loadWeek]);

//   // --- Actions ---
//   async function togglePublish() {
//     if (selectedStoreId === "all") return;
//     const newState = !publishedStores?.[selectedStoreId];
//     try {
//       await setDoc(doc(db, "rosterWeeks", weekStart), {
//         publishedStores: { ...publishedStores, [selectedStoreId]: newState }
//       }, { merge: true });
//       setPublishedStores(prev => ({ ...prev, [selectedStoreId]: newState }));
//       showToast(newState ? "Roster Published!" : "Roster Unpublished", "success");
//     } catch (e) { showToast("Action failed", "error"); }
//   }

//   async function addShift(ymd, uid = "") {
//     if (isLocked) {
//         showToast("Select a store and ensure roster is unpublished to add shifts", "error");
//         return;
//     }
//     const staff = staffApproved.find(s => s.uid === uid);
//     const newShiftData = {
//       uid,
//       staffName: staff?.name || "Unassigned",
//       date: ymd,
//       storeId: selectedStoreId,
//       role: staff?.role || "staff", 
//       department: (staff?.department || "shop").toLowerCase(), 
//       startPlanned: "13:00",
//       endPlanned: "21:00",
//       updatedAt: serverTimestamp(),
//     };
//     const docRef = await addDoc(collection(db, "rosterWeeks", weekStart, "shifts"), newShiftData);
//     setShifts(prev => [...prev, { id: docRef.id, ...newShiftData }]);
//   }

//   async function handleUpdateShift() {
//     if (isLocked) return;
//     try {
//       const shiftRef = doc(db, "rosterWeeks", weekStart, "shifts", editingShift.id);
//       await updateDoc(shiftRef, {
//         startPlanned: editingShift.startPlanned,
//         endPlanned: editingShift.endPlanned,
//         updatedAt: serverTimestamp()
//       });
//       setShifts(prev => prev.map(s => s.id === editingShift.id ? editingShift : s));
//       setEditingShift(null);
//       showToast("Shift updated", "success");
//     } catch (e) { showToast("Update failed", "error"); }
//   }

//   async function handleDeleteShift() {
//     if (isLocked) return;
//     try {
//       await deleteDoc(doc(db, "rosterWeeks", weekStart, "shifts", editingShift.id));
//       setShifts(prev => prev.filter(s => s.id !== editingShift.id));
//       setEditingShift(null);
//       showToast("Shift deleted", "success");
//     } catch (e) { showToast("Delete failed", "error"); }
//   }

//   async function copyPreviousWeek() {
//     if (isLocked) return;
//     const prevWeekStart = toYMD(subDays(new Date(weekStart + "T00:00:00"), 7));
//     const prevSnap = await getDocs(query(collection(db, "rosterWeeks", prevWeekStart, "shifts"), where("storeId", "==", selectedStoreId)));
    
//     const batch = writeBatch(db);
//     prevSnap.forEach(ds => {
//       const data = ds.data();
//       const newDate = toYMD(addDays(new Date(data.date + "T00:00:00"), 7));
//       if (!shifts.some(s => s.uid === data.uid && s.date === newDate)) {
//         batch.set(doc(collection(db, "rosterWeeks", weekStart, "shifts")), { 
//           ...data, 
//           date: newDate, 
//           updatedAt: serverTimestamp() 
//         });
//       }
//     });
//     await batch.commit(); 
//     loadWeek();
//     showToast("Last week copied", "success");
//   }

//   return (
//     <div className="roster-page">
//       <header className="roster-header">
//         <div className="header-left">
//           <h1 className="mitho-title">Mitho Mitho Roster</h1>
//           <div className="week-nav">
//             <button className="btn-secondary btn-small" onClick={jumpToCurrentWeek}>This Week</button>
//             <button className="nav-btn" onClick={() => setWeekStart(toYMD(subDays(weekStartDateObj, 7)))}>←</button>
//             <span className="date-display">{weekStart}</span>
//             <button className="nav-btn" onClick={() => setWeekStart(toYMD(addDays(weekStartDateObj, 7)))}>→</button>
//           </div>
//         </div>

//         <div className="header-right">
//           <input type="text" placeholder="Search team..." className="search-input" onChange={(e) => setSearchTerm(e.target.value)} />
//           {selectedStoreId !== "all" && !isLocked && <button className="btn-secondary" onClick={copyPreviousWeek}>Copy Prev</button>}
//           <select className="filter-select" value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
//             <option value="all">View All (Read Only)</option>
//             {stores.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
//           </select>
//           <button 
//             className={`btn-primary ${publishedStores?.[selectedStoreId] ? 'btn-unpublish' : ''}`} 
//             disabled={selectedStoreId === "all"} 
//             onClick={togglePublish}
//           >
//             {publishedStores?.[selectedStoreId] ? "Unpublish" : "Publish"}
//           </button>
//         </div>
//       </header>

//       {isLocked && selectedStoreId !== "all" && (
//         <div className="lock-banner">
//           ⚠️ This roster is <strong>Published</strong>. Unpublish to make changes.
//         </div>
//       )}
//       {selectedStoreId === "all" && (
//         <div className="lock-banner view-only">
//           Viewing all stores. Select a specific store to edit shifts.
//         </div>
//       )}

//       <div className="roster-grid-container">
//         <div className="roster-grid">
//           <div className="grid-row header-row roster">
//             <div className="cell sticky-cell">Team Member</div>
//             {days.map(d => <div key={toYMD(d)} className="cell date-header"><strong>{prettyDate(d).split(',')[0]}</strong></div>)}
//           </div>

//           {filteredStaff.map(staff => (
//             <div key={staff.uid} className="grid-row roster">
//               <div className="cell sticky-cell staff-cell">
//                 <strong>{staff.name}</strong>
//                 <span className="role-subtext">{staff.role} • {staff.department}</span>
//               </div>
//               {days.map(d => {
//                 const ymd = toYMD(d);
//                 const dayShifts = shiftLookup[`${staff.uid}_${ymd}`] || [];
//                 return (
//                   <div key={ymd} className="cell">
//                     {dayShifts.length > 0 ? (
//                       dayShifts.map(s => {
//                         const displayDept = (s.department || staff?.department || "shop").toLowerCase();
//                         return (
//                           <div 
//                             key={s.id} 
//                             className={`shift-card role-${(s.role || "staff").toLowerCase()} dept-${displayDept} ${isLocked ? 'locked-card' : ''}`} 
//                             onClick={() => !isLocked && setEditingShift(s)}
//                           >
//                             <div className="card-top">{s.role}</div>
//                             <div className="card-time">{s.startPlanned}-{s.endPlanned}</div>
//                           </div>
//                         );
//                       })
//                     ) : (
//                       !isLocked && <button className="add-btn-inline" onClick={() => addShift(ymd, staff.uid)}>+</button>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           ))}
//         </div>
//       </div>

//       {editingShift && !isLocked && (
//         <div className="modal-overlay">
//           <div className="modal-content">
//             <h3>Manage Shift</h3>
//             <p>{editingShift.staffName} — {editingShift.date}</p>
//             <div className="time-edit-grid">
//               <div><label>Start</label><input type="time" value={editingShift.startPlanned} onChange={e => setEditingShift({...editingShift, startPlanned: e.target.value})} /></div>
//               <div><label>End</label><input type="time" value={editingShift.endPlanned} onChange={e => setEditingShift({...editingShift, endPlanned: e.target.value})} /></div>
//             </div>
//             <button className="btn-save-full" onClick={handleUpdateShift}>Update Shift</button>
//             <button className="btn-delete-full" onClick={handleDeleteShift}>Delete Shift</button>
//             <button className="btn-cancel" onClick={() => setEditingShift(null)}>Cancel</button>
//           </div>
//         </div>
//       )}
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
//   subDays,
//   getWeekStartMonday,
//   prettyDate,
//   toYMD,
//   weekDates,
// } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import { useStores } from "../../hooks/useStore";
// import "./RosterManager.css";

// function addMonthsSafe(date, amount) {
//   const d = new Date(date);
//   const originalDate = d.getDate();
//   d.setDate(1);
//   d.setMonth(d.getMonth() + amount);
//   const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
//   d.setDate(Math.min(originalDate, lastDay));
//   return d;
// }

// function timeToMinutes(value) {
//   if (!value || !value.includes(":")) return 0;
//   const [h, m] = value.split(":").map(Number);
//   return h * 60 + m;
// }

// function formatHours(totalMinutes) {
//   const hours = totalMinutes / 60;
//   return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
// }

// export default function RosterManager() {
//   const { showToast } = useToast();
//   const { stores } = useStores();

//   const [viewMode, setViewMode] = useState("W"); // M W D
//   const [weekStart, setWeekStart] = useState(() =>
//     toYMD(getWeekStartMonday(addDays(new Date(), 7)))
//   );
//   const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));

//   const [publishedMap, setPublishedMap] = useState({});
//   const [staffApproved, setStaffApproved] = useState([]);
//   const [shifts, setShifts] = useState([]);
//   const [selectedStoreId, setSelectedStoreId] = useState("all");
//   const [selectedDepartment, setSelectedDepartment] = useState("all");
//   const [editingShift, setEditingShift] = useState(null);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [copyingWeek, setCopyingWeek] = useState(false);
//   const [clearingWeek, setClearingWeek] = useState(false);

//   const todayYmd = toYMD(new Date());

//   const referenceDate = useMemo(() => {
//     if (viewMode === "D") return new Date(selectedDate + "T00:00:00");
//     return new Date(weekStart + "T00:00:00");
//   }, [weekStart, selectedDate, viewMode]);

//   const days = useMemo(() => {
//     if (viewMode === "D") {
//       return [new Date(selectedDate + "T00:00:00")];
//     }

//     if (viewMode === "W") {
//       return weekDates(referenceDate);
//     }

//     const year = referenceDate.getFullYear();
//     const month = referenceDate.getMonth();
//     const lastDay = new Date(year, month + 1, 0).getDate();
//     return Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1));
//   }, [referenceDate, viewMode, selectedDate]);

//   const neededWeekKeys = useMemo(() => {
//     const keys = new Set();
//     days.forEach((d) => keys.add(toYMD(getWeekStartMonday(d))));
//     return Array.from(keys);
//   }, [days]);

//   const currentWeekKey = useMemo(
//     () => toYMD(getWeekStartMonday(referenceDate)),
//     [referenceDate]
//   );

//   const previousWeekKey = useMemo(
//     () => toYMD(subDays(new Date(currentWeekKey + "T00:00:00"), 7)),
//     [currentWeekKey]
//   );

//   const dayPickerWeek = useMemo(() => {
//     return weekDates(getWeekStartMonday(new Date(selectedDate + "T00:00:00")));
//   }, [selectedDate]);

//   const isLocked =
//     selectedStoreId === "all" ||
//     publishedMap[currentWeekKey]?.[selectedStoreId] === true;

//   const gridTemplateColumns = useMemo(() => {
//     if (viewMode === "M") {
//       return `220px repeat(${days.length}, minmax(42px, 42px)) 100px`;
//     }
//     if (viewMode === "D") {
//       return `220px minmax(240px, 1fr) 100px`;
//     }
//     return `190px repeat(${days.length}, minmax(140px, 1fr)) 100px`;
//   }, [days.length, viewMode]);

//   const loadData = useCallback(async () => {
//     try {
//       const staffQs = query(
//         collection(db, "users"),
//         where("role", "in", ["staff", "admin", "manager"]),
//         where("status", "==", "approved")
//       );
//       const staffSnap = await getDocs(staffQs);

//       const normalizedStaff = staffSnap.docs.map((d) => ({
//         uid: d.id,
//         ...d.data(),
//         role: (d.data().role || "staff").toLowerCase(),
//         department: (d.data().department || "shop").toLowerCase(),
//         name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim(),
//       }));

//       setStaffApproved(normalizedStaff);

//       let allShifts = [];
//       let allPublishStates = {};

//       await Promise.all(
//         neededWeekKeys.map(async (weekKey) => {
//           const sSnap = await getDocs(collection(db, "rosterWeeks", weekKey, "shifts"));
//           allShifts = [
//             ...allShifts,
//             ...sSnap.docs.map((d) => ({
//               id: d.id,
//               weekKey,
//               ...d.data(),
//               role: (d.data().role || "staff").toLowerCase(),
//               department: (d.data().department || "shop").toLowerCase(),
//             })),
//           ];

//           const wSnap = await getDoc(doc(db, "rosterWeeks", weekKey));
//           if (wSnap.exists()) {
//             allPublishStates[weekKey] = wSnap.data().publishedStores || {};
//           }
//         })
//       );

//       setShifts(allShifts);
//       setPublishedMap(allPublishStates);
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to load roster data", "error");
//     }
//   }, [neededWeekKeys, showToast]);

//   useEffect(() => {
//     loadData();
//   }, [loadData]);

//   const filteredStaff = useMemo(() => {
//     return staffApproved
//       .filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
//       .filter((s) =>
//         selectedDepartment === "all"
//           ? true
//           : (s.department || "shop").toLowerCase() === selectedDepartment
//       )
//       .sort((a, b) => a.name.localeCompare(b.name));
//   }, [staffApproved, searchTerm, selectedDepartment]);

//   const userProfileMap = useMemo(() => {
//     const map = {};
//     staffApproved.forEach((staff) => {
//       map[staff.uid] = {
//         role: (staff.role || "staff").toLowerCase(),
//         department: (staff.department || "shop").toLowerCase(),
//         name: staff.name || "",
//       };
//     });
//     return map;
//   }, [staffApproved]);

//   const visibleShifts = useMemo(() => {
//     let arr = shifts.map((shift) => {
//       const profile = userProfileMap[shift.uid];

//       return {
//         ...shift,
//         liveRole: (profile?.role || shift.role || "staff").toLowerCase(),
//         liveDepartment: (profile?.department || shift.department || "shop").toLowerCase(),
//         liveStaffName: profile?.name || shift.staffName || "",
//       };
//     });

//     if (selectedStoreId !== "all") {
//       arr = arr.filter((s) => s.storeId === selectedStoreId);
//     }

//     if (selectedDepartment !== "all") {
//       arr = arr.filter((s) => s.liveDepartment === selectedDepartment);
//     }

//     return arr;
//   }, [shifts, selectedStoreId, selectedDepartment, userProfileMap]);

//   const shiftLookup = useMemo(() => {
//     const map = {};
//     visibleShifts.forEach((s) => {
//       const key = `${s.uid}_${s.date}`;
//       if (!map[key]) map[key] = [];
//       map[key].push(s);
//     });
//     return map;
//   }, [visibleShifts]);

//   const visibleShiftCount = useMemo(() => {
//     const dayKeys = new Set(days.map((d) => toYMD(d)));
//     return visibleShifts.filter((s) => dayKeys.has(s.date)).length;
//   }, [visibleShifts, days]);

//   const totalWeeklyHoursMap = useMemo(() => {
//     const map = {};
//     const dayKeys = new Set(days.map((d) => toYMD(d)));

//     visibleShifts.forEach((s) => {
//       if (!dayKeys.has(s.date)) return;
//       const start = timeToMinutes(s.startPlanned);
//       const end = timeToMinutes(s.endPlanned);
//       const mins = Math.max(0, end - start);
//       map[s.uid] = (map[s.uid] || 0) + mins;
//     });

//     return map;
//   }, [visibleShifts, days]);

//   async function togglePublish() {
//     if (selectedStoreId === "all") return;

//     try {
//       const newState = !publishedMap[currentWeekKey]?.[selectedStoreId];

//       await setDoc(
//         doc(db, "rosterWeeks", currentWeekKey),
//         {
//           publishedStores: {
//             ...(publishedMap[currentWeekKey] || {}),
//             [selectedStoreId]: newState,
//           },
//           updatedAt: serverTimestamp(),
//         },
//         { merge: true }
//       );

//       setPublishedMap((prev) => ({
//         ...prev,
//         [currentWeekKey]: {
//           ...(prev[currentWeekKey] || {}),
//           [selectedStoreId]: newState,
//         },
//       }));

//       showToast(newState ? "Roster published" : "Roster unpublished", "success");
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to update publish state", "error");
//     }
//   }

//   async function addShift(ymd, uid) {
//     if (isLocked || selectedStoreId === "all") return;

//     try {
//       const weekKey = toYMD(getWeekStartMonday(new Date(ymd + "T00:00:00")));
//       const staff = staffApproved.find((s) => s.uid === uid);

//       const newShift = {
//         uid,
//         staffName: staff?.name || "",
//         date: ymd,
//         storeId: selectedStoreId,
//         role: (staff?.role || "staff").toLowerCase(),
//         department: (staff?.department || "shop").toLowerCase(),
//         startPlanned: "13:00",
//         endPlanned: "21:00",
//         updatedAt: serverTimestamp(),
//       };

//       const docRef = await addDoc(
//         collection(db, "rosterWeeks", weekKey, "shifts"),
//         newShift
//       );

//       setShifts((prev) => [...prev, { id: docRef.id, weekKey, ...newShift }]);
//       showToast("Shift added", "success");
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to add shift", "error");
//     }
//   }

//   async function handleUpdateShift() {
//     if (!editingShift) return;

//     try {
//       await updateDoc(
//         doc(db, "rosterWeeks", editingShift.weekKey, "shifts", editingShift.id),
//         {
//           startPlanned: editingShift.startPlanned,
//           endPlanned: editingShift.endPlanned,
//           updatedAt: serverTimestamp(),
//         }
//       );

//       setShifts((prev) =>
//         prev.map((s) =>
//           s.id === editingShift.id && s.weekKey === editingShift.weekKey
//             ? {
//                 ...s,
//                 startPlanned: editingShift.startPlanned,
//                 endPlanned: editingShift.endPlanned,
//               }
//             : s
//         )
//       );

//       setEditingShift(null);
//       showToast("Shift updated", "success");
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to update shift", "error");
//     }
//   }

//   async function handleDeleteShift() {
//     if (!editingShift) return;

//     try {
//       await deleteDoc(
//         doc(db, "rosterWeeks", editingShift.weekKey, "shifts", editingShift.id)
//       );

//       setShifts((prev) =>
//         prev.filter(
//           (s) => !(s.id === editingShift.id && s.weekKey === editingShift.weekKey)
//         )
//       );

//       setEditingShift(null);
//       showToast("Shift deleted", "success");
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to delete shift", "error");
//     }
//   }

//   async function handleDuplicateShiftToNextDay() {
//     if (!editingShift || selectedStoreId === "all" || isLocked) return;

//     try {
//       const nextDate = addDays(new Date(editingShift.date + "T00:00:00"), 1);
//       const newYmd = toYMD(nextDate);
//       const newWeekKey = toYMD(getWeekStartMonday(nextDate));

//       const payload = {
//         uid: editingShift.uid,
//         staffName: userProfileMap[editingShift.uid]?.name || editingShift.staffName || "",
//         date: newYmd,
//         storeId: editingShift.storeId,
//         role: (userProfileMap[editingShift.uid]?.role || editingShift.role || "staff").toLowerCase(),
//         department: (
//           userProfileMap[editingShift.uid]?.department ||
//           editingShift.department ||
//           "shop"
//         ).toLowerCase(),
//         startPlanned: editingShift.startPlanned,
//         endPlanned: editingShift.endPlanned,
//         updatedAt: serverTimestamp(),
//       };

//       const docRef = await addDoc(
//         collection(db, "rosterWeeks", newWeekKey, "shifts"),
//         payload
//       );

//       setShifts((prev) => [...prev, { id: docRef.id, weekKey: newWeekKey, ...payload }]);
//       setEditingShift(null);
//       showToast("Shift duplicated to next day", "success");
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to duplicate shift", "error");
//     }
//   }

//   async function handleCopyPreviousWeek() {
//     if (selectedStoreId === "all") {
//       showToast("Select a specific store first", "error");
//       return;
//     }

//     if (publishedMap[currentWeekKey]?.[selectedStoreId]) {
//       showToast("Unpublish current week before copying", "error");
//       return;
//     }

//     try {
//       setCopyingWeek(true);

//       const prevSnap = await getDocs(collection(db, "rosterWeeks", previousWeekKey, "shifts"));
//       const previousWeekShifts = prevSnap.docs
//         .map((d) => ({ id: d.id, ...d.data() }))
//         .filter((s) => s.storeId === selectedStoreId);

//       if (previousWeekShifts.length === 0) {
//         showToast("No shifts found in previous week", "error");
//         return;
//       }

//       const currentSnap = await getDocs(collection(db, "rosterWeeks", currentWeekKey, "shifts"));
//       const currentWeekShifts = currentSnap.docs
//         .map((d) => ({ id: d.id, ...d.data() }))
//         .filter((s) => s.storeId === selectedStoreId);

//       if (currentWeekShifts.length > 0) {
//         showToast("Current week already has shifts. Clear manually before copy.", "error");
//         return;
//       }

//       const prevStartDate = new Date(previousWeekKey + "T00:00:00");
//       const currStartDate = new Date(currentWeekKey + "T00:00:00");

//       await Promise.all(
//         previousWeekShifts.map((shift) => {
//           const oldDate = new Date(shift.date + "T00:00:00");
//           const diffDays = Math.round((oldDate - prevStartDate) / (1000 * 60 * 60 * 24));
//           const newDate = toYMD(addDays(currStartDate, diffDays));

//           const liveProfile = userProfileMap[shift.uid];

//           const payload = {
//             uid: shift.uid,
//             staffName: liveProfile?.name || shift.staffName || "",
//             date: newDate,
//             storeId: selectedStoreId,
//             role: (liveProfile?.role || shift.role || "staff").toLowerCase(),
//             department: (liveProfile?.department || shift.department || "shop").toLowerCase(),
//             startPlanned: shift.startPlanned || "13:00",
//             endPlanned: shift.endPlanned || "21:00",
//             updatedAt: serverTimestamp(),
//           };

//           return addDoc(collection(db, "rosterWeeks", currentWeekKey, "shifts"), payload);
//         })
//       );

//       await loadData();
//       showToast("Previous week copied successfully", "success");
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to copy previous week", "error");
//     } finally {
//       setCopyingWeek(false);
//     }
//   }

//   async function handleClearCurrentWeek() {
//     if (selectedStoreId === "all") {
//       showToast("Select a specific store first", "error");
//       return;
//     }

//     if (publishedMap[currentWeekKey]?.[selectedStoreId]) {
//       showToast("Unpublish current week before clearing", "error");
//       return;
//     }

//     try {
//       setClearingWeek(true);

//       const snap = await getDocs(collection(db, "rosterWeeks", currentWeekKey, "shifts"));
//       const docsToDelete = snap.docs.filter((d) => d.data().storeId === selectedStoreId);

//       if (docsToDelete.length === 0) {
//         showToast("Nothing to clear", "error");
//         return;
//       }

//       const batch = writeBatch(db);
//       docsToDelete.forEach((d) => {
//         batch.delete(doc(db, "rosterWeeks", currentWeekKey, "shifts", d.id));
//       });

//       await batch.commit();

//       setShifts((prev) =>
//         prev.filter(
//           (s) => !(s.weekKey === currentWeekKey && s.storeId === selectedStoreId)
//         )
//       );

//       showToast("Current week cleared", "success");
//     } catch (error) {
//       console.error(error);
//       showToast("Failed to clear week", "error");
//     } finally {
//       setClearingWeek(false);
//     }
//   }

//   function handlePrev() {
//     if (viewMode === "M") {
//       const prevMonth = addMonthsSafe(referenceDate, -1);
//       setWeekStart(toYMD(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)));
//       return;
//     }

//     if (viewMode === "W") {
//       setWeekStart(toYMD(subDays(referenceDate, 7)));
//       return;
//     }

//     setSelectedDate(toYMD(subDays(new Date(selectedDate + "T00:00:00"), 1)));
//   }

//   function handleNext() {
//     if (viewMode === "M") {
//       const nextMonth = addMonthsSafe(referenceDate, 1);
//       setWeekStart(toYMD(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)));
//       return;
//     }

//     if (viewMode === "W") {
//       setWeekStart(toYMD(addDays(referenceDate, 7)));
//       return;
//     }

//     setSelectedDate(toYMD(addDays(new Date(selectedDate + "T00:00:00"), 1)));
//   }

//   return (
//     <div className={`roster-page view-mode-${viewMode}`}>
//       <header className="roster-header">
//         <div className="header-left">
//           {/* <div className="title-wrap">
//             <h1 className="mitho-title">Mitho Mitho</h1>
//             <span className="title-sub">Roster Manager</span>
//           </div> */}

//           <div className="view-switcher">
//             {["M", "W", "D"].map((m) => (
//               <button
//                 key={m}
//                 className={viewMode === m ? "active" : ""}
//                 onClick={() => setViewMode(m)}
//               >
//                 {m === "M" ? "Month" : m === "W" ? "Week" : "Day"}
//               </button>
//             ))}
//           </div>

//           <div className="week-nav">
//             <button onClick={handlePrev}>←</button>
//             <span className="date-display">
//               {viewMode === "M"
//                 ? referenceDate.toLocaleString("default", {
//                     month: "long",
//                     year: "numeric",
//                   })
//                 : viewMode === "W"
//                 ? `${toYMD(days[0])} → ${toYMD(days[days.length - 1])}`
//                 : prettyDate(referenceDate)}
//             </span>
//             <button onClick={handleNext}>→</button>
//           </div>
//         </div>

//         <div className="header-right">
//           <input
//             type="text"
//             placeholder="Search staff..."
//             className="search-input"
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//           />

//           {/* <select
//             className="filter-select"
//             value={selectedDepartment}
//             onChange={(e) => setSelectedDepartment(e.target.value)}
//           >
//             <option value="all">All Departments</option>
//             <option value="shop">Shop</option>
//             <option value="kitchen">Kitchen</option>
//           </select> */}

//           {/* <select
//             className="filter-select"
//             value={selectedStoreId}
//             onChange={(e) => setSelectedStoreId(e.target.value)}
//           >
//             <option value="all">View All Stores</option>
//             {stores.map((s) => (
//               <option key={s.id} value={s.id}>
//                 {s.label}
//               </option>
//             ))}
//           </select> */}

//           <button
//             className="btn-secondary"
//             onClick={handleCopyPreviousWeek}
//             disabled={
//               selectedStoreId === "all" ||
//               viewMode === "M" ||
//               copyingWeek ||
//               publishedMap[currentWeekKey]?.[selectedStoreId]
//             }
//           >
//             {copyingWeek ? "Copying..." : "Copy"}
//           </button>

//           <button
//             className="btn-secondary danger"
//             onClick={handleClearCurrentWeek}
//             disabled={
//               selectedStoreId === "all" ||
//               viewMode === "M" ||
//               clearingWeek ||
//               publishedMap[currentWeekKey]?.[selectedStoreId]
//             }
//           >
//             {clearingWeek ? "Clearing..." : "Clear"}
//           </button>

//           <button
//             className={`btn-primary ${
//               isLocked && selectedStoreId !== "all" ? "btn-unpublish" : ""
//             }`}
//             onClick={togglePublish}
//             disabled={selectedStoreId === "all"}
//           >
//             {publishedMap[currentWeekKey]?.[selectedStoreId] ? "Unpublish" : "Publish"}
//           </button>
//         </div>
//       </header>

//       <div className="roster-toolbar">
//         <div className="legend">
//           <span className="legend-title">Legend</span>

//           <div className="legend-item">
//             <span className="legend-swatch role-staff-swatch"></span>
//             <span>Staff</span>
//           </div>
//           <div className="legend-item">
//             <span className="legend-swatch role-admin-swatch"></span>
//             <span>Admin</span>
//           </div>
//           <div className="legend-item">
//             <span className="legend-swatch role-manager-swatch"></span>
//             <span>Manager</span>
//           </div>

//           <div className="legend-divider"></div>

//           <div className="legend-item">
//             <span className="legend-swatch dept-shop-swatch"></span>
//             <span>Shop</span>
//           </div>
//           <div className="legend-item">
//             <span className="legend-swatch dept-kitchen-swatch"></span>
//             <span>Kitchen</span>
//           </div>
//         </div>

//         <div className="roster-stats">
//           <div className="stat-card">
//             <span className="stat-label">Visible Staff</span>
//             <strong>{filteredStaff.length}</strong>
//           </div>
//           <div className="stat-card">
//             <span className="stat-label">Visible Shifts</span>
//             <strong>{visibleShiftCount}</strong>
//           </div>
//           <div className="stat-card">
//             {/* <span className="stat-label">Store</span> */}
//             <select
//             className="filter-select"
//             value={selectedStoreId}
//             onChange={(e) => setSelectedStoreId(e.target.value)}
//           >
//             <option value="all">View All Stores</option>
//             {stores.map((s) => (
//               <option key={s.id} value={s.id}>
//                 {s.label}
//               </option>
//             ))}
//           </select>
//             {/* <strong>
//               {selectedStoreId === "all"
//                 ? "All Stores"
//                 : stores.find((s) => s.id === selectedStoreId)?.label || selectedStoreId}
//             </strong> */}
//           </div>
//         </div>
//       </div>

//       {viewMode === "D" && (
//         <div className="day-picker">
//           {dayPickerWeek.map((d) => {
//             const ymd = toYMD(d);
//             return (
//               <button
//                 key={ymd}
//                 className={ymd === selectedDate ? "active" : ""}
//                 onClick={() => setSelectedDate(ymd)}
//               >
//                 <span>{prettyDate(d).split(",")[0]}</span>
//                 <strong>{d.getDate()}</strong>
//               </button>
//             );
//           })}
//         </div>
//       )}

//       {selectedStoreId === "all" ? (
//         <div className="lock-banner view-only">
//           Select a specific store to add, edit, delete, copy, clear, or publish shifts.
//         </div>
//       ) : isLocked ? (
//         <div className="lock-banner">
//           This roster is published. Unpublish it first to make changes.
//         </div>
//       ) : null}

//       <div className="roster-grid-container">
//         <div className="roster-grid">
//           <div
//             className="grid-row header-row roster flexdisp"
//             style={{ gridTemplateColumns }}
//           >
//             <div className="cell sticky-cell staff-heading">Staff</div>

//             {days.map((d) => {
//               const ymd = toYMD(d);
//               const isToday = ymd === todayYmd;

//               return (
//                 <div
//                   key={ymd}
//                   className={`cell date-header ${viewMode === "M" ? "month-header-cell" : ""} ${
//                     isToday ? "today-column-header" : ""
//                   }`}
//                   onClick={() => {
//                     if (viewMode === "W") {
//                       setSelectedDate(ymd);
//                       setViewMode("D");
//                     }
//                   }}
//                   role={viewMode === "W" ? "button" : undefined}
//                   title={viewMode === "W" ? "Open day view" : undefined}
//                 >
//                   {viewMode === "M" ? (
//                     <strong>{d.getDate()}</strong>
//                   ) : (
//                     <>
//                       <span>{prettyDate(d).split(",")[0]}</span> /
//                       <strong>{d.getDate()}</strong>
//                     </>
//                   )}
//                 </div>
//               );
//             })}

//             <div className="cell totals-header">Hours</div>
//           </div>

//           {filteredStaff.length === 0 && (
//             <div className="empty-state">No staff found.</div>
//           )}

//           {filteredStaff.map((staff) => (
//             <div
//               key={staff.uid}
//               className="grid-row roster flexdisp"
//               style={{ gridTemplateColumns }}
//             >
//               <div className="cell sticky-cell staff-cell">
//                 <strong>{userProfileMap[staff.uid]?.name || staff.name}</strong>
//                 <span className="role-subtext">
//                   {(userProfileMap[staff.uid]?.role || staff.role)} •{" "}
//                   {(userProfileMap[staff.uid]?.department || staff.department || "shop").toLowerCase()}
//                 </span>
//               </div>

//               {days.map((d) => {
//                 const ymd = toYMD(d);
//                 const isToday = ymd === todayYmd;
//                 const dayShifts = shiftLookup[`${staff.uid}_${ymd}`] || [];

//                 return (
//                   <div
//                     key={ymd}
//                     className={`cell ${viewMode === "M" ? "month-cell" : ""} ${
//                       isToday ? "today-column-cell" : ""
//                     }`}
//                   >
//                     {viewMode === "M" ? (
//                       <>
//                         {dayShifts.length > 0 ? (
//                           <button
//                             className={`month-count-badge role-${
//                               dayShifts[0]?.liveRole || "staff"
//                             } dept-${dayShifts[0]?.liveDepartment || "shop"}`}
//                             onClick={() => {
//                               setSelectedDate(ymd);
//                               setViewMode("D");
//                             }}
//                             title={`${dayShifts.length} shift${dayShifts.length > 1 ? "s" : ""}`}
//                           >
//                             {dayShifts.length}
//                           </button>
//                         ) : !isLocked ? (
//                           <button
//                             className="add-btn-inline compact-add"
//                             onClick={() => addShift(ymd, staff.uid)}
//                             title="Add shift"
//                           >
//                             +
//                           </button>
//                         ) : null}
//                       </>
//                     ) : (
//                       <>
//                         {dayShifts.map((s) => (
//                           <div
//                             key={s.id}
//                             className={`shift-card role-${s.liveRole} dept-${s.liveDepartment} ${
//                               isLocked ? "locked-card" : ""
//                             }`}
//                             onClick={() => !isLocked && setEditingShift(s)}
//                           >
//                             <div className="card-time">
//                               {s.startPlanned} - {s.endPlanned}
//                             </div>
//                             <div className="card-meta">
//                               {s.liveDepartment}
//                             </div>
//                           </div>
//                         ))}

//                         {!isLocked && dayShifts.length === 0 && (
//                           <button
//                             className="add-btn-inline"
//                             onClick={() => addShift(ymd, staff.uid)}
//                           >
//                             +
//                           </button>
//                         )}
//                       </>
//                     )}
//                   </div>
//                 );
//               })}

//               <div className="cell hours-cell">
//                 <strong>{formatHours(totalWeeklyHoursMap[staff.uid] || 0)}</strong>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       {editingShift && !isLocked && (
//         <div className="modal-overlay">
//           <div className="modal-content">
//             <h3>Manage Shift</h3>
//             <p>
//               {(userProfileMap[editingShift.uid]?.name || editingShift.staffName)} —{" "}
//               {editingShift.date}
//             </p>

//             <div className="time-edit-grid">
//               <div>
//                 <label>Start</label>
//                 <input
//                   type="time"
//                   value={editingShift.startPlanned}
//                   onChange={(e) =>
//                     setEditingShift({
//                       ...editingShift,
//                       startPlanned: e.target.value,
//                     })
//                   }
//                 />
//               </div>

//               <div>
//                 <label>End</label>
//                 <input
//                   type="time"
//                   value={editingShift.endPlanned}
//                   onChange={(e) =>
//                     setEditingShift({
//                       ...editingShift,
//                       endPlanned: e.target.value,
//                     })
//                   }
//                 />
//               </div>
//             </div>

//             <div className="modal-actions">
//               <button className="btn-save-full" onClick={handleUpdateShift}>
//                 Update Shift
//               </button>
//               <button className="btn-secondary" onClick={handleDuplicateShiftToNextDay}>
//                 Duplicate to Next Day
//               </button>
//               <button className="btn-delete-full" onClick={handleDeleteShift}>
//                 Delete Shift
//               </button>
//               <button className="btn-cancel" onClick={() => setEditingShift(null)}>
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }




























import { useEffect, useMemo, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  addDays,
  subDays,
  getWeekStartMonday,
  prettyDate,
  toYMD,
  weekDates,
} from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import { useStores } from "../../hooks/useStore";
import "./RosterManager.css";

function addMonthsSafe(date, amount) {
  const d = new Date(date);
  const originalDate = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDate, lastDay));
  return d;
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return 0;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function formatHours(totalMinutes) {
  const hours = totalMinutes / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getDayKeyFromDate(dateObj) {
  return DAY_KEYS[new Date(dateObj).getDay()];
}

function isStaffAvailableOnDate(staff, dateObj) {
  const dayKey = getDayKeyFromDate(dateObj);
  const row = staff?.availability?.[dayKey];
  return !!row?.enabled;
}

function getAvailabilityTextForDate(staff, dateObj) {
  const dayKey = getDayKeyFromDate(dateObj);
  const row = staff?.availability?.[dayKey];

  if (!row?.enabled) return "Unavailable";
  if (row?.start && row?.end) return `${row.start} - ${row.end}`;
  return "Available";
}

export default function RosterManager() {
  const { showToast } = useToast();
  const { stores } = useStores();

  const [viewMode, setViewMode] = useState("W");
  const [weekStart, setWeekStart] = useState(() =>
    toYMD(getWeekStartMonday(addDays(new Date(), 7)))
  );
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));

  const [publishedMap, setPublishedMap] = useState({});
  const [staffApproved, setStaffApproved] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [editingShift, setEditingShift] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [clearingWeek, setClearingWeek] = useState(false);

  const todayYmd = toYMD(new Date());

  const referenceDate = useMemo(() => {
    if (viewMode === "D") return new Date(selectedDate + "T00:00:00");
    return new Date(weekStart + "T00:00:00");
  }, [weekStart, selectedDate, viewMode]);

  const days = useMemo(() => {
    if (viewMode === "D") {
      return [new Date(selectedDate + "T00:00:00")];
    }

    if (viewMode === "W") {
      return weekDates(referenceDate);
    }

    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1));
  }, [referenceDate, viewMode, selectedDate]);

  const neededWeekKeys = useMemo(() => {
    const keys = new Set();
    days.forEach((d) => keys.add(toYMD(getWeekStartMonday(d))));
    return Array.from(keys);
  }, [days]);

  const currentWeekKey = useMemo(
    () => toYMD(getWeekStartMonday(referenceDate)),
    [referenceDate]
  );

  const previousWeekKey = useMemo(
    () => toYMD(subDays(new Date(currentWeekKey + "T00:00:00"), 7)),
    [currentWeekKey]
  );

  const dayPickerWeek = useMemo(() => {
    return weekDates(getWeekStartMonday(new Date(selectedDate + "T00:00:00")));
  }, [selectedDate]);

  const isLocked =
    selectedStoreId === "all" ||
    publishedMap[currentWeekKey]?.[selectedStoreId] === true;

  const gridTemplateColumns = useMemo(() => {
    if (viewMode === "M") {
      return `220px repeat(${days.length}, minmax(42px, 42px)) 100px`;
    }
    if (viewMode === "D") {
      return `220px minmax(240px, 1fr) 100px`;
    }
    return `190px repeat(${days.length}, minmax(140px, 1fr)) 100px`;
  }, [days.length, viewMode]);

  const loadData = useCallback(async () => {
    try {
      const staffQs = query(
        collection(db, "users"),
        where("role", "in", ["staff", "admin", "manager"]),
        where("status", "==", "approved")
      );
      const staffSnap = await getDocs(staffQs);

      const normalizedStaff = staffSnap.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
        role: (d.data().role || "staff").toLowerCase(),
        department: (d.data().department || "shop").toLowerCase(),
        name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim(),
        availability: d.data().availability || null,
        availabilitySubmitted: !!d.data().availabilitySubmitted,
      }));

      setStaffApproved(normalizedStaff);

      let allShifts = [];
      let allPublishStates = {};

      await Promise.all(
        neededWeekKeys.map(async (weekKey) => {
          const sSnap = await getDocs(collection(db, "rosterWeeks", weekKey, "shifts"));
          allShifts = [
            ...allShifts,
            ...sSnap.docs.map((d) => ({
              id: d.id,
              weekKey,
              ...d.data(),
              role: (d.data().role || "staff").toLowerCase(),
              department: (d.data().department || "shop").toLowerCase(),
            })),
          ];

          const wSnap = await getDoc(doc(db, "rosterWeeks", weekKey));
          if (wSnap.exists()) {
            allPublishStates[weekKey] = wSnap.data().publishedStores || {};
          }
        })
      );

      setShifts(allShifts);
      setPublishedMap(allPublishStates);
    } catch (error) {
      console.error(error);
      showToast("Failed to load roster data", "error");
    }
  }, [neededWeekKeys, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredStaff = useMemo(() => {
    return staffApproved
      .filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((s) =>
        selectedDepartment === "all"
          ? true
          : (s.department || "shop").toLowerCase() === selectedDepartment
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staffApproved, searchTerm, selectedDepartment]);

  const userProfileMap = useMemo(() => {
    const map = {};
    staffApproved.forEach((staff) => {
      map[staff.uid] = {
        role: (staff.role || "staff").toLowerCase(),
        department: (staff.department || "shop").toLowerCase(),
        name: staff.name || "",
        availability: staff.availability || null,
        availabilitySubmitted: !!staff.availabilitySubmitted,
      };
    });
    return map;
  }, [staffApproved]);

  const visibleShifts = useMemo(() => {
    let arr = shifts.map((shift) => {
      const profile = userProfileMap[shift.uid];

      return {
        ...shift,
        liveRole: (profile?.role || shift.role || "staff").toLowerCase(),
        liveDepartment: (profile?.department || shift.department || "shop").toLowerCase(),
        liveStaffName: profile?.name || shift.staffName || "",
        liveAvailability: profile?.availability || null,
        availabilitySubmitted: !!profile?.availabilitySubmitted,
      };
    });

    if (selectedStoreId !== "all") {
      arr = arr.filter((s) => s.storeId === selectedStoreId);
    }

    if (selectedDepartment !== "all") {
      arr = arr.filter((s) => s.liveDepartment === selectedDepartment);
    }

    return arr;
  }, [shifts, selectedStoreId, selectedDepartment, userProfileMap]);

  const shiftLookup = useMemo(() => {
    const map = {};
    visibleShifts.forEach((s) => {
      const key = `${s.uid}_${s.date}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [visibleShifts]);

  const visibleShiftCount = useMemo(() => {
    const dayKeys = new Set(days.map((d) => toYMD(d)));
    return visibleShifts.filter((s) => dayKeys.has(s.date)).length;
  }, [visibleShifts, days]);

  const totalWeeklyHoursMap = useMemo(() => {
    const map = {};
    const dayKeys = new Set(days.map((d) => toYMD(d)));

    visibleShifts.forEach((s) => {
      if (!dayKeys.has(s.date)) return;
      const start = timeToMinutes(s.startPlanned);
      const end = timeToMinutes(s.endPlanned);
      const mins = Math.max(0, end - start);
      map[s.uid] = (map[s.uid] || 0) + mins;
    });

    return map;
  }, [visibleShifts, days]);

  async function togglePublish() {
    if (selectedStoreId === "all") return;

    try {
      const newState = !publishedMap[currentWeekKey]?.[selectedStoreId];

      await setDoc(
        doc(db, "rosterWeeks", currentWeekKey),
        {
          publishedStores: {
            ...(publishedMap[currentWeekKey] || {}),
            [selectedStoreId]: newState,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPublishedMap((prev) => ({
        ...prev,
        [currentWeekKey]: {
          ...(prev[currentWeekKey] || {}),
          [selectedStoreId]: newState,
        },
      }));

      showToast(newState ? "Roster published" : "Roster unpublished", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to update publish state", "error");
    }
  }

  async function addShift(ymd, uid) {
    if (isLocked || selectedStoreId === "all") return;

    try {
      const weekKey = toYMD(getWeekStartMonday(new Date(ymd + "T00:00:00")));
      const staff = staffApproved.find((s) => s.uid === uid);
      const targetDate = new Date(ymd + "T00:00:00");
      const available = isStaffAvailableOnDate(staff, targetDate);

      const newShift = {
        uid,
        staffName: staff?.name || "",
        date: ymd,
        storeId: selectedStoreId,
        role: (staff?.role || "staff").toLowerCase(),
        department: (staff?.department || "shop").toLowerCase(),
        startPlanned: "13:00",
        endPlanned: "21:00",
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "rosterWeeks", weekKey, "shifts"),
        newShift
      );

      setShifts((prev) => [...prev, { id: docRef.id, weekKey, ...newShift }]);

      if (!available) {
        showToast("Shift added, but staff is marked unavailable that day", "warning");
      } else {
        showToast("Shift added", "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to add shift", "error");
    }
  }

  async function handleUpdateShift() {
    if (!editingShift) return;

    try {
      await updateDoc(
        doc(db, "rosterWeeks", editingShift.weekKey, "shifts", editingShift.id),
        {
          startPlanned: editingShift.startPlanned,
          endPlanned: editingShift.endPlanned,
          updatedAt: serverTimestamp(),
        }
      );

      setShifts((prev) =>
        prev.map((s) =>
          s.id === editingShift.id && s.weekKey === editingShift.weekKey
            ? {
                ...s,
                startPlanned: editingShift.startPlanned,
                endPlanned: editingShift.endPlanned,
              }
            : s
        )
      );

      setEditingShift(null);
      showToast("Shift updated", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to update shift", "error");
    }
  }

  async function handleDeleteShift() {
    if (!editingShift) return;

    try {
      await deleteDoc(
        doc(db, "rosterWeeks", editingShift.weekKey, "shifts", editingShift.id)
      );

      setShifts((prev) =>
        prev.filter(
          (s) => !(s.id === editingShift.id && s.weekKey === editingShift.weekKey)
        )
      );

      setEditingShift(null);
      showToast("Shift deleted", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete shift", "error");
    }
  }

  async function handleDuplicateShiftToNextDay() {
    if (!editingShift || selectedStoreId === "all" || isLocked) return;

    try {
      const nextDate = addDays(new Date(editingShift.date + "T00:00:00"), 1);
      const newYmd = toYMD(nextDate);
      const newWeekKey = toYMD(getWeekStartMonday(nextDate));

      const payload = {
        uid: editingShift.uid,
        staffName: userProfileMap[editingShift.uid]?.name || editingShift.staffName || "",
        date: newYmd,
        storeId: editingShift.storeId,
        role: (userProfileMap[editingShift.uid]?.role || editingShift.role || "staff").toLowerCase(),
        department: (
          userProfileMap[editingShift.uid]?.department ||
          editingShift.department ||
          "shop"
        ).toLowerCase(),
        startPlanned: editingShift.startPlanned,
        endPlanned: editingShift.endPlanned,
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "rosterWeeks", newWeekKey, "shifts"),
        payload
      );

      setShifts((prev) => [...prev, { id: docRef.id, weekKey: newWeekKey, ...payload }]);

      const targetStaff = staffApproved.find((s) => s.uid === editingShift.uid);
      const available = isStaffAvailableOnDate(targetStaff, nextDate);

      setEditingShift(null);

      if (!available) {
        showToast("Shift duplicated, but staff is marked unavailable next day", "warning");
      } else {
        showToast("Shift duplicated to next day", "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to duplicate shift", "error");
    }
  }

  async function handleCopyPreviousWeek() {
    if (selectedStoreId === "all") {
      showToast("Select a specific store first", "error");
      return;
    }

    if (publishedMap[currentWeekKey]?.[selectedStoreId]) {
      showToast("Unpublish current week before copying", "error");
      return;
    }

    try {
      setCopyingWeek(true);

      const prevSnap = await getDocs(collection(db, "rosterWeeks", previousWeekKey, "shifts"));
      const previousWeekShifts = prevSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.storeId === selectedStoreId);

      if (previousWeekShifts.length === 0) {
        showToast("No shifts found in previous week", "error");
        return;
      }

      const currentSnap = await getDocs(collection(db, "rosterWeeks", currentWeekKey, "shifts"));
      const currentWeekShifts = currentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.storeId === selectedStoreId);

      if (currentWeekShifts.length > 0) {
        showToast("Current week already has shifts. Clear manually before copy.", "error");
        return;
      }

      const prevStartDate = new Date(previousWeekKey + "T00:00:00");
      const currStartDate = new Date(currentWeekKey + "T00:00:00");

      let warningCount = 0;

      await Promise.all(
        previousWeekShifts.map((shift) => {
          const oldDate = new Date(shift.date + "T00:00:00");
          const diffDays = Math.round((oldDate - prevStartDate) / (1000 * 60 * 60 * 24));
          const newDate = toYMD(addDays(currStartDate, diffDays));

          const liveProfile = userProfileMap[shift.uid];
          const targetStaff = staffApproved.find((s) => s.uid === shift.uid);

          if (!isStaffAvailableOnDate(targetStaff, new Date(newDate + "T00:00:00"))) {
            warningCount += 1;
          }

          const payload = {
            uid: shift.uid,
            staffName: liveProfile?.name || shift.staffName || "",
            date: newDate,
            storeId: selectedStoreId,
            role: (liveProfile?.role || shift.role || "staff").toLowerCase(),
            department: (liveProfile?.department || shift.department || "shop").toLowerCase(),
            startPlanned: shift.startPlanned || "13:00",
            endPlanned: shift.endPlanned || "21:00",
            updatedAt: serverTimestamp(),
          };

          return addDoc(collection(db, "rosterWeeks", currentWeekKey, "shifts"), payload);
        })
      );

      await loadData();

      if (warningCount > 0) {
        showToast(`Week copied. ${warningCount} shift(s) fall outside availability`, "warning");
      } else {
        showToast("Previous week copied successfully", "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to copy previous week", "error");
    } finally {
      setCopyingWeek(false);
    }
  }

  async function handleClearCurrentWeek() {
    if (selectedStoreId === "all") {
      showToast("Select a specific store first", "error");
      return;
    }

    if (publishedMap[currentWeekKey]?.[selectedStoreId]) {
      showToast("Unpublish current week before clearing", "error");
      return;
    }

    try {
      setClearingWeek(true);

      const snap = await getDocs(collection(db, "rosterWeeks", currentWeekKey, "shifts"));
      const docsToDelete = snap.docs.filter((d) => d.data().storeId === selectedStoreId);

      if (docsToDelete.length === 0) {
        showToast("Nothing to clear", "error");
        return;
      }

      const batch = writeBatch(db);
      docsToDelete.forEach((d) => {
        batch.delete(doc(db, "rosterWeeks", currentWeekKey, "shifts", d.id));
      });

      await batch.commit();

      setShifts((prev) =>
        prev.filter(
          (s) => !(s.weekKey === currentWeekKey && s.storeId === selectedStoreId)
        )
      );

      showToast("Current week cleared", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to clear week", "error");
    } finally {
      setClearingWeek(false);
    }
  }

  function handlePrev() {
    if (viewMode === "M") {
      const prevMonth = addMonthsSafe(referenceDate, -1);
      setWeekStart(toYMD(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)));
      return;
    }

    if (viewMode === "W") {
      setWeekStart(toYMD(subDays(referenceDate, 7)));
      return;
    }

    setSelectedDate(toYMD(subDays(new Date(selectedDate + "T00:00:00"), 1)));
  }

  function handleNext() {
    if (viewMode === "M") {
      const nextMonth = addMonthsSafe(referenceDate, 1);
      setWeekStart(toYMD(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)));
      return;
    }

    if (viewMode === "W") {
      setWeekStart(toYMD(addDays(referenceDate, 7)));
      return;
    }

    setSelectedDate(toYMD(addDays(new Date(selectedDate + "T00:00:00"), 1)));
  }

  return (
    <div className={`roster-page view-mode-${viewMode}`}>
      <header className="roster-header">
        <div className="header-left">
          <div className="view-switcher">
            {["M", "W", "D"].map((m) => (
              <button
                key={m}
                className={viewMode === m ? "active" : ""}
                onClick={() => setViewMode(m)}
              >
                {m === "M" ? "Month" : m === "W" ? "Week" : "Day"}
              </button>
            ))}
          </div>

          <div className="week-nav">
            <button onClick={handlePrev}>←</button>
            <span className="date-display">
              {viewMode === "M"
                ? referenceDate.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })
                : viewMode === "W"
                ? `${toYMD(days[0])} → ${toYMD(days[days.length - 1])}`
                : prettyDate(referenceDate)}
            </span>
            <button onClick={handleNext}>→</button>
          </div>
        </div>

        <div className="header-right">
          <input
            type="text"
            placeholder="Search staff..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            className="btn-secondary"
            onClick={handleCopyPreviousWeek}
            disabled={
              selectedStoreId === "all" ||
              viewMode === "M" ||
              copyingWeek ||
              publishedMap[currentWeekKey]?.[selectedStoreId]
            }
          >
            {copyingWeek ? "Copying..." : "Copy"}
          </button>

          <button
            className="btn-secondary danger"
            onClick={handleClearCurrentWeek}
            disabled={
              selectedStoreId === "all" ||
              viewMode === "M" ||
              clearingWeek ||
              publishedMap[currentWeekKey]?.[selectedStoreId]
            }
          >
            {clearingWeek ? "Clearing..." : "Clear"}
          </button>

          <button
            className={`btn-primary ${
              isLocked && selectedStoreId !== "all" ? "btn-unpublish" : ""
            }`}
            onClick={togglePublish}
            disabled={selectedStoreId === "all"}
          >
            {publishedMap[currentWeekKey]?.[selectedStoreId] ? "Unpublish" : "Publish"}
          </button>
        </div>
      </header>

      <div className="roster-toolbar">
        <div className="legend">
          <span className="legend-title">Legend</span>

          <div className="legend-item">
            <span className="legend-swatch role-staff-swatch"></span>
            <span>Staff</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch role-admin-swatch"></span>
            <span>Admin</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch role-manager-swatch"></span>
            <span>Manager</span>
          </div>

          <div className="legend-divider"></div>

          <div className="legend-item">
            <span className="legend-swatch dept-shop-swatch"></span>
            <span>Shop</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch dept-kitchen-swatch"></span>
            <span>Kitchen</span>
          </div>

          <div className="legend-divider"></div>

          <div className="legend-item">
            <span className="legend-swatch availability-warning-swatch"></span>
            <span>Outside availability</span>
          </div>
        </div>

        <div className="roster-stats">
          <div className="stat-card">
            <span className="stat-label">Visible Staff</span>
            <strong>{filteredStaff.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Visible Shifts</span>
            <strong>{visibleShiftCount}</strong>
          </div>
          <div className="stat-card">
            <select
              className="filter-select"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              <option value="all">View All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {viewMode === "D" && (
        <div className="day-picker">
          {dayPickerWeek.map((d) => {
            const ymd = toYMD(d);
            return (
              <button
                key={ymd}
                className={ymd === selectedDate ? "active" : ""}
                onClick={() => setSelectedDate(ymd)}
              >
                <span>{prettyDate(d).split(",")[0]}</span>
                <strong>{d.getDate()}</strong>
              </button>
            );
          })}
        </div>
      )}

      {selectedStoreId === "all" ? (
        <div className="lock-banner view-only">
          Select a specific store to add, edit, delete, copy, clear, or publish shifts.
        </div>
      ) : isLocked ? (
        <div className="lock-banner">
          This roster is published. Unpublish it first to make changes.
        </div>
      ) : null}

      <div className="roster-grid-container">
        <div className="roster-grid">
          <div
            className="grid-row header-row roster flexdisp"
            style={{ gridTemplateColumns }}
          >
            <div className="cell sticky-cell staff-heading">Staff</div>

            {days.map((d) => {
              const ymd = toYMD(d);
              const isToday = ymd === todayYmd;

              return (
                <div
                  key={ymd}
                  className={`cell date-header ${viewMode === "M" ? "month-header-cell" : ""} ${
                    isToday ? "today-column-header" : ""
                  }`}
                  onClick={() => {
                    if (viewMode === "W") {
                      setSelectedDate(ymd);
                      setViewMode("D");
                    }
                  }}
                  role={viewMode === "W" ? "button" : undefined}
                  title={viewMode === "W" ? "Open day view" : undefined}
                >
                  {viewMode === "M" ? (
                    <strong>{d.getDate()}</strong>
                  ) : (
                    <>
                      <span>{prettyDate(d).split(",")[0]}</span> /
                      <strong>{d.getDate()}</strong>
                    </>
                  )}
                </div>
              );
            })}

            <div className="cell totals-header">Hours</div>
          </div>

          {filteredStaff.length === 0 && (
            <div className="empty-state">No staff found.</div>
          )}

          {filteredStaff.map((staff) => (
            <div
              key={staff.uid}
              className="grid-row roster flexdisp"
              style={{ gridTemplateColumns }}
            >
              <div className="cell sticky-cell staff-cell">
                <strong>{userProfileMap[staff.uid]?.name || staff.name}</strong>
                <span className="role-subtext">
                  {(userProfileMap[staff.uid]?.role || staff.role)} •{" "}
                  {(userProfileMap[staff.uid]?.department || staff.department || "shop").toLowerCase()}
                </span>
              </div>

              {days.map((d) => {
                const ymd = toYMD(d);
                const isToday = ymd === todayYmd;
                const dayShifts = shiftLookup[`${staff.uid}_${ymd}`] || [];
                const available = isStaffAvailableOnDate(staff, d);
                const availabilityText = getAvailabilityTextForDate(staff, d);

                return (
                  <div
                    key={ymd}
                    className={`cell ${viewMode === "M" ? "month-cell" : ""} ${
                      isToday ? "today-column-cell" : ""
                    } ${!available ? "availability-warning-cell" : ""}`}
                    title={!available ? `Unavailable: ${availabilityText}` : `Available: ${availabilityText}`}
                  >
                    {viewMode === "M" ? (
                      <>
                        {dayShifts.length > 0 ? (
                          <button
                            className={`month-count-badge role-${
                              dayShifts[0]?.liveRole || "staff"
                            } dept-${dayShifts[0]?.liveDepartment || "shop"} ${
                              !available ? "availability-warning-badge" : ""
                            }`}
                            onClick={() => {
                              setSelectedDate(ymd);
                              setViewMode("D");
                            }}
                            title={`${dayShifts.length} shift${dayShifts.length > 1 ? "s" : ""}`}
                          >
                            {dayShifts.length}
                          </button>
                        ) : !isLocked ? (
                          <button
                            className={`add-btn-inline compact-add ${!available ? "availability-warning-add" : ""}`}
                            onClick={() => addShift(ymd, staff.uid)}
                            title={!available ? `Add anyway — ${availabilityText}` : "Add shift"}
                          >
                            +
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {!available && dayShifts.length === 0 && (
                          <div className="availability-warning-note">Unavailable</div>
                        )}

                        {dayShifts.map((s) => (
                          <div
                            key={s.id}
                            className={`shift-card role-${s.liveRole} dept-${s.liveDepartment} ${
                              isLocked ? "locked-card" : ""
                            } ${!available ? "availability-warning-card" : ""}`}
                            onClick={() => !isLocked && setEditingShift(s)}
                            title={!available ? `Outside availability • ${availabilityText}` : availabilityText}
                          >
                            <div className="card-time">
                              {s.startPlanned} - {s.endPlanned}
                            </div>
                            <div className="card-meta">
                              {s.liveDepartment}
                            </div>
                            {!available && (
                              <div className="card-warning-text">Outside availability</div>
                            )}
                          </div>
                        ))}

                        {!isLocked && dayShifts.length === 0 && (
                          <button
                            className={`add-btn-inline ${!available ? "availability-warning-add" : ""}`}
                            onClick={() => addShift(ymd, staff.uid)}
                            title={!available ? `Add anyway — ${availabilityText}` : "Add shift"}
                          >
                            +
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              <div className="cell hours-cell">
                <strong>{formatHours(totalWeeklyHoursMap[staff.uid] || 0)}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingShift && !isLocked && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Manage Shift</h3>
            <p>
              {(userProfileMap[editingShift.uid]?.name || editingShift.staffName)} —{" "}
              {editingShift.date}
            </p>

            {!isStaffAvailableOnDate(
              staffApproved.find((s) => s.uid === editingShift.uid),
              new Date(editingShift.date + "T00:00:00")
            ) && (
              <div className="availability-modal-warning">
                Warning: this shift is outside the staff member’s availability.
              </div>
            )}

            <div className="time-edit-grid">
              <div>
                <label>Start</label>
                <input
                  type="time"
                  value={editingShift.startPlanned}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      startPlanned: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label>End</label>
                <input
                  type="time"
                  value={editingShift.endPlanned}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      endPlanned: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-save-full" onClick={handleUpdateShift}>
                Update Shift
              </button>
              <button className="btn-secondary" onClick={handleDuplicateShiftToNextDay}>
                Duplicate to Next Day
              </button>
              <button className="btn-delete-full" onClick={handleDeleteShift}>
                Delete Shift
              </button>
              <button className="btn-cancel" onClick={() => setEditingShift(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}