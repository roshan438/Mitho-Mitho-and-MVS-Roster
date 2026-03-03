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

















import { useEffect, useMemo, useState, useCallback } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  query, setDoc, updateDoc, where, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { STORES } from "../../utils/constants";
import { addDays, getWeekStartMonday, prettyDate, toYMD, weekDates } from "../../utils/dates";
import { useToast } from "../../context/ToastContext"; // Import Toast Hook
import "./RosterManager.css";

export default function RosterManager() {
  const { showToast } = useToast(); // Initialize Toast
  const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(addDays(new Date(), 7))));
  const [weekStatus, setWeekStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [staffApproved, setStaffApproved] = useState([]);
  const [shifts, setShifts] = useState([]);

  const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
  const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);
  const isLocked = weekStatus === "published";

  const loadApprovedStaff = useCallback(async () => {
    try {
      const qs = query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"));
      const snap = await getDocs(qs);
      const list = snap.docs.map(d => ({
        uid: d.id,
        name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.data().email || d.id,
      })).sort((a, b) => a.name.localeCompare(b.name));
      setStaffApproved(list);
    } catch (e) {
      showToast("Error loading staff list", "error");
    }
  }, [showToast]);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const weekRef = doc(db, "rosterWeeks", weekStart);
      const weekSnap = await getDoc(weekRef);

      if (!weekSnap.exists()) {
        await setDoc(weekRef, { weekStart, status: "draft", createdAt: serverTimestamp() }, { merge: true });
        setWeekStatus("draft");
      } else {
        setWeekStatus(weekSnap.data().status || "draft");
      }

      const shiftsSnap = await getDocs(collection(db, "rosterWeeks", weekStart, "shifts"));
      setShifts(shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (e) {
      showToast("Error loading roster week", "error");
    } finally {
      setLoading(false);
    }
  }, [weekStart, showToast]);

  useEffect(() => { loadApprovedStaff(); }, [loadApprovedStaff]);
  useEffect(() => { loadWeek(); }, [loadWeek]);

  const issues = useMemo(() => {
    const errs = [];
    shifts.forEach(s => {
      if (!s.uid) errs.push(`Missing staff on ${s.date}`);
      if (s.startPlanned >= s.endPlanned) errs.push(`Invalid time on ${s.date}`);
    });
    return errs;
  }, [shifts]);

  async function addShift(ymd) {
    if (isLocked) return;
    try {
      const shiftsCol = collection(db, "rosterWeeks", weekStart, "shifts");
      await addDoc(shiftsCol, {
        uid: "", staffName: "", storeId: STORES[0].id, date: ymd,
        startPlanned: "13:00", endPlanned: "22:00", updatedAt: serverTimestamp()
      });
      loadWeek();
      showToast("Shift added", "success");
    } catch (e) {
      showToast("Could not add shift", "error");
    }
  }

  async function updateShift(shiftId, patch) {
    if (isLocked) return;
    try {
      await updateDoc(doc(db, "rosterWeeks", weekStart, "shifts", shiftId), { ...patch, updatedAt: serverTimestamp() });
      setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, ...patch } : s));
    } catch (e) {
      showToast("Update failed", "error");
    }
  }

  async function togglePublish() {
    if (!isLocked && issues.length > 0) {
      showToast(`Fix ${issues.length} issues before publishing`, "error");
      return;
    }

    const newStatus = isLocked ? "draft" : "published";
    if (isLocked && !confirm("Unlock roster for editing? Staff will no longer see this as finalized.")) return;
    
    try {
      await updateDoc(doc(db, "rosterWeeks", weekStart), {
        status: newStatus,
        publishedAt: newStatus === "published" ? serverTimestamp() : null
      });
      loadWeek();
      showToast(newStatus === "published" ? "Roster Published!" : "Roster set to Draft", "success");
    } catch (e) {
      showToast("Status update failed", "error");
    }
  }

  async function copyPreviousWeek() {
    if (isLocked) return;
    try {
      const prevWeek = toYMD(addDays(weekStartDateObj, -7));
      const prevSnap = await getDocs(collection(db, "rosterWeeks", prevWeek, "shifts"));
      
      if (prevSnap.empty) {
        showToast("No shifts found in previous week", "error");
        return;
      }

      const batch = writeBatch(db);
      if (shifts.length > 0) {
        if (!confirm("Replace current week shifts with previous week?")) return;
        shifts.forEach(s => batch.delete(doc(db, "rosterWeeks", weekStart, "shifts", s.id)));
      }

      prevSnap.docs.forEach(d => {
        const s = d.data();
        const newRef = doc(collection(db, "rosterWeeks", weekStart, "shifts"));
        batch.set(newRef, { 
          ...s, 
          date: toYMD(addDays(new Date(s.date + "T00:00:00"), 7)), 
          updatedAt: serverTimestamp() 
        });
      });

      await batch.commit();
      loadWeek();
      showToast("Roster copied from previous week", "success");
    } catch (e) {
      showToast("Error copying roster", "error");
    }
  }

  async function deleteShift(sid) {
    if (isLocked) return;
    if (!confirm("Delete this shift?")) return;
    try {
      await deleteDoc(doc(db, "rosterWeeks", weekStart, "shifts", sid));
      loadWeek();
      showToast("Shift deleted", "success");
    } catch (e) {
      showToast("Delete failed", "error");
    }
  }

  return (
    <div className="admin-wrapper">
      <header className="admin-header">
        <div className="title-area">
          <h1 className="main-title">Roster Manager</h1>
          <span className={`status-pill ${weekStatus}`}>{weekStatus.toUpperCase()}</span>
        </div>
        <div className="header-actions">
           <button className="refresh-circle" onClick={loadWeek}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg></button>
        </div>
      </header>

      <section className="roster-controls">
        <div className="control-group">
          <label>Week Starting</label>
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        </div>
        <div className="button-row">
          <button className="btn-sec" onClick={copyPreviousWeek} disabled={isLocked}>Copy Prev</button>
          <button className={`btn-primary ${isLocked ? 'unlock' : 'lock'}`} onClick={togglePublish}>
            {isLocked ? "Unlock Roster" : "Publish"}
          </button>
        </div>
      </section>

      {issues.length > 0 && !isLocked && (
        <div className="validation-box">
          <strong>Validation Alert:</strong> Fix {issues.length} red-highlighted areas before publishing.
        </div>
      )}

      <div className="roster-grid">
        {days.map((d) => {
          const ymd = toYMD(d);
          const dayShifts = shifts.filter(s => s.date === ymd);

          return (
            <div key={ymd} className="day-column">
              <div className="day-header">
                <div className="day-text">
                  <span className="day-name">{prettyDate(d).split(',')[0]}</span>
                  <span className="day-date">{ymd}</span>
                </div>
                {!isLocked && <button className="add-shift-btn" onClick={() => addShift(ymd)}>+</button>}
              </div>

              <div className="shift-list">
                {dayShifts.map(s => (
                  <div key={s.id} className={`shift-editor-card ${!s.uid ? 'error' : ''}`}>
                    <select 
                      disabled={isLocked}
                      value={s.uid} 
                      onChange={(e) => updateShift(s.id, { uid: e.target.value, staffName: staffApproved.find(st => st.uid === e.target.value)?.name })}
                    >
                      <option value="">Select Staff</option>
                      {staffApproved.map(st => <option key={st.uid} value={st.uid}>{st.name}</option>)}
                    </select>

                    <select 
                      disabled={isLocked}
                      value={s.storeId} 
                      onChange={(e) => updateShift(s.id, { storeId: e.target.value })}
                    >
                      {STORES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                    </select>

                    <div className="time-row">
                      <input type="time" disabled={isLocked} value={s.startPlanned} onChange={(e) => updateShift(s.id, { startPlanned: e.target.value })} />
                      <input type="time" disabled={isLocked} value={s.endPlanned} onChange={(e) => updateShift(s.id, { endPlanned: e.target.value })} />
                    </div>

                    {!isLocked && (
                      <button className="del-btn" onClick={() => deleteShift(s.id)}>
                        Remove Shift
                      </button>
                    )}
                  </div>
                ))}
                {dayShifts.length === 0 && <div className="empty-day">No Shifts</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


