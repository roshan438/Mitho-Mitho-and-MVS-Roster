// import { useEffect, useMemo, useState } from "react";
// import { collectionGroup, getDocs, query, where } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { subDays, addDays, getWeekStartMonday, prettyDate, toYMD, weekDates } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import "./MyRoster.css";

// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// export default function MyRoster() {
//   const { fbUser } = useAuth();

//   const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
//   const [loading, setLoading] = useState(true);
//   const [shifts, setShifts] = useState([]);

//   const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   useEffect(() => {
//     if (!fbUser?.uid) return;
//     loadMyWeek();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [fbUser?.uid, weekStart]);

//   async function loadMyWeek() {
//     setLoading(true);

//     const startYMD = weekStart;
//     const endYMD = toYMD(addDays(weekStartDateObj, 7)); // exclusive

//     // Query across all week subcollections using collectionGroup
//     const q = query(
//       collectionGroup(db, "shifts"),
//       where("uid", "==", fbUser.uid),
//       where("date", ">=", startYMD),
//       where("date", "<", endYMD)
//     );

//     const snap = await getDocs(q);
//     const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
//       .sort((a, b) => (a.date + a.startPlanned).localeCompare(b.date + b.startPlanned));

//     setShifts(list);
//     setLoading(false);
//   }

//   function shiftsForDate(ymd) {
//     return shifts.filter((s) => s.date === ymd);
//   }

//   return (
//     // <div className="container">
//     //   <div className="card">
//     //     <div className="top">
//     //       <div>
//     //         <h1 className="h1">My Roster</h1>
//     //         <p className="p">Your shifts for the selected week.</p>
//     //       </div>

//     //       <div className="controls">
//     //         <div className="field">
//     //           <div className="label">Week starting (Monday)</div>
//     //           <input className="input" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
//     //         </div>

            
//     //         <div className="row">
//     //         <button className="btn" onClick={() => setWeekStart(toYMD(getWeekStartMonday(subDays(new Date(), 7))))}>
//     //             Prev week
//     //           </button>
//     //           <button className="btn" onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}>
//     //             This week
//     //           </button>
//     //           <button className="btn" onClick={() => setWeekStart(toYMD(getWeekStartMonday(addDays(new Date(), 7))))}>
//     //             Next week
//     //           </button>
//     //           <button className="btn" onClick={loadMyWeek}>Refresh</button>
//     //         </div>
//     //       </div>
//     //     </div>

//     //     <div className="spacer" />

//     //     {loading ? (
//     //       <p className="p">Loading…</p>
//     //     ) : (
//     //       <div className="week">
//     //         {days.map((d) => {
//     //           const ymd = toYMD(d);
//     //           const dayShifts = shiftsForDate(ymd);

//     //           return (
//     //             <div key={ymd} className="day">
//     //               <div className="dayHead">
//     //                 <div className="dayTitle">{prettyDate(d)}</div>
//     //                 <div className="daySub">{ymd}</div>
//     //               </div>

//     //               {dayShifts.length === 0 ? (
//     //                 <div className="empty">No shift</div>
//     //               ) : (
//     //                 dayShifts.map((s) => (
//     //                   <div key={s.id} className="shift">
//     //                     <div className="shiftMain">
//     //                       <div className="store">{storeLabel(s.storeId)}</div>
//     //                       <div className="time">
//     //                         {s.startPlanned} – {s.endPlanned}
//     //                       </div>
//     //                     </div>
//     //                   </div>
//     //                 ))
//     //               )}
//     //             </div>
//     //           );
//     //         })}
//     //       </div>
//     //     )}
//     //   </div>
//     // </div>

//     <div className="roster-container">
//     <div className="roster-header">
//       <div>
//         <h1 className="roster-title">My Roster</h1>
//         <p className="roster-subtitle">Your schedule for the week</p>
//       </div>
//       <button className="icon-button-refresh" onClick={loadMyWeek}>
//          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//       </button>
//     </div>
  
//     <div className="roster-controls">
//       <div className="date-input-wrapper">
//         <label className="input-label">Jump to Date</label>
//         <input 
//           className="date-picker-minimal" 
//           type="date" 
//           value={weekStart} 
//           onChange={(e) => setWeekStart(e.target.value)} 
//         />
//       </div>
  
//       <div className="nav-pills">
//         <button className="pill-btn" onClick={() => setWeekStart(toYMD(getWeekStartMonday(subDays(new Date(weekStart), 7))))}>
//           Prev
//         </button>
//         <button 
//           className={`pill-btn ${weekStart === toYMD(getWeekStartMonday(new Date())) ? 'active' : ''}`} 
//           onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}
//         >
//           This Week
//         </button>
//         <button className="pill-btn" onClick={() => setWeekStart(toYMD(getWeekStartMonday(addDays(new Date(weekStart), 7))))}>
//           Next
//         </button>
//       </div>
//     </div>
  
//     {loading ? (
//       <div className="loader">Searching for shifts...</div>
//     ) : (
//       <div className="week-timeline">
//         {days.map((d) => {
//           const ymd = toYMD(d);
//           const dayShifts = shiftsForDate(ymd);
//           const isToday = ymd === toYMD(new Date());
  
//           return (
//             <div key={ymd} className={`day-card ${isToday ? 'is-today' : ''}`}>
//               <div className="day-sidebar">
//                 <span className="day-name">{prettyDate(d).split(',')[0]}</span>
//                 <span className="day-number">{prettyDate(d).split(' ')[1]}</span>
//               </div>
  
//               <div className="day-content">
//                 {dayShifts.length === 0 ? (
//                   <div className="no-shift-text">Day Off</div>
//                 ) : (
//                   dayShifts.map((s) => (
//                     <div key={s.id} className="shift-entry">
//                       <div className="shift-accent" />
//                       <div className="shift-details">
//                         <div className="shift-store">{storeLabel(s.storeId)}</div>
//                         <div className="shift-time">
//                           {s.startPlanned} — {s.endPlanned}
//                         </div>
//                       </div>
//                     </div>
//                   ))
//                 )}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     )}
//   </div>
//   );
// }







import { useEffect, useMemo, useState, useCallback } from "react";
import { collectionGroup, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { STORES } from "../../utils/constants";
import { subDays, addDays, getWeekStartMonday, prettyDate, toYMD, weekDates } from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext"; // Import Toast Hook
import "./MyRoster.css";

const storeLabel = (storeId) => STORES.find((s) => s.id === storeId)?.label || storeId || "-";

export default function MyRoster() {
  const { fbUser } = useAuth();
  const { showToast } = useToast(); // Initialize Toast
  const uid = fbUser?.uid;

  const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState([]);

  const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
  const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

  const loadMyWeek = useCallback(async (silent = false) => {
    if (!uid) return;
    if (!silent) setLoading(true);

    try {
      const startYMD = weekStart;
      const endYMD = toYMD(addDays(weekStartDateObj, 7));

      const q = query(
        collectionGroup(db, "shifts"),
        where("uid", "==", uid),
        where("date", ">=", startYMD),
        where("date", "<", endYMD)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.date + a.startPlanned).localeCompare(b.date + b.startPlanned));

      setShifts(list);
      
      // Only show success toast if user manually clicked refresh
      if (silent) showToast("Roster updated", "success");
    } catch (e) {
      console.error("Roster Load Error:", e);
      showToast("Failed to load your roster", "error");
    } finally {
      setLoading(false);
    }
  }, [uid, weekStart, weekStartDateObj, showToast]);

  useEffect(() => {
    loadMyWeek();
  }, [loadMyWeek]);

  const shiftsForDate = (ymd) => shifts.filter((s) => s.date === ymd);

  return (
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">My Roster</h1>
          <span className="subtitle">Weekly Schedule</span>
        </div>
        <button 
          className={`refresh-circle ${loading ? 'spinning' : ''}`} 
          onClick={() => loadMyWeek(true)} // Manual refresh triggers toast
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </header>
  
      <main className="scroll-content">
        <section className="date-nav">
          <div className="date-display">
            <input 
              className="date-picker-minimal" 
              type="date" 
              value={weekStart} 
              onChange={(e) => setWeekStart(e.target.value)} 
            />
          </div>
  
          <div className="button-group">
            <button className="pill-btn" onClick={() => setWeekStart(toYMD(subDays(weekStartDateObj, 7)))}>
              Prev
            </button>
            <button 
              className={`pill-btn ${weekStart === toYMD(getWeekStartMonday(new Date())) ? 'active' : ''}`} 
              onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}
            >
              This Week
            </button>
            <button className="pill-btn" onClick={() => setWeekStart(toYMD(addDays(weekStartDateObj, 7)))}>
              Next
            </button>
          </div>
        </section>
  
        <div className="timeline">
          {loading ? (
            <div className="loader-inline">
              <div className="spinner"></div>
              <span>Searching shifts...</span>
            </div>
          ) : (
            days.map((d) => {
              const ymd = toYMD(d);
              const dayShifts = shiftsForDate(ymd);
              const isToday = ymd === toYMD(new Date());
      
              return (
                <div key={ymd} className={`timeline-card ${isToday ? 'is-today' : ''} ${dayShifts.length > 0 ? 'has-data' : ''}`}>
                  <div className="card-side">
                    <span className="day-abbr">{prettyDate(d).split(',')[0].substring(0, 3)}</span>
                    <span className="day-num">{d.getDate()}</span>
                  </div>
      
                  <div className="card-main">
                    {dayShifts.length === 0 ? (
                      <span className="no-entry">Day Off</span>
                    ) : (
                      dayShifts.map((s) => (
                        <div key={s.id} className="shift-entry">
                          <div className="shift-accent" />
                          <div className="shift-details">
                            <div className="store-tag">{storeLabel(s.storeId)}</div>
                            <div className="shift-time">
                              {s.startPlanned} — {s.endPlanned}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}