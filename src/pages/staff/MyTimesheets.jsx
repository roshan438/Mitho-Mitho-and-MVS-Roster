// import { useEffect, useMemo, useState } from "react";
// import { collection, getDocs, query, where } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { subDays,addDays, getWeekStartMonday, toYMD, weekDates, prettyDate } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import "./MyTimesheets.css";

// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function hmToMinutes(hm) {
//   if (!hm) return null;
//   const [h, m] = hm.split(":").map(Number);
//   if (Number.isNaN(h) || Number.isNaN(m)) return null;
//   return h * 60 + m;
// }

// function minutesToHours(min) {
//   return Math.round((min / 60) * 100) / 100;
// }

// function calcWorkedMinutes(ts) {
//   const start = hmToMinutes(ts.startInput);
//   const end = hmToMinutes(ts.endInput);
//   if (start == null || end == null) return 0;

//   let worked = end - start;
//   if (worked < 0) worked += 24 * 60; // overnight safety

//   // break
//   const bs = hmToMinutes(ts.breakStartInput);
//   const be = hmToMinutes(ts.breakEndInput);
//   if (bs != null && be != null) {
//     let br = be - bs;
//     if (br < 0) br += 24 * 60;
//     worked -= br;
//   }

//   return Math.max(0, worked);
// }

// function auditDiffMinutes(actualTs, inputHm) {
//   // actualTs is Firestore Timestamp object
//   if (!actualTs || !inputHm) return null;
//   const d = actualTs.toDate();
//   const [h, m] = inputHm.split(":").map(Number);
//   if (Number.isNaN(h) || Number.isNaN(m)) return null;

//   const input = new Date(d);
//   input.setHours(h, m, 0, 0);

//   // difference = actual - input
//   return Math.round((d.getTime() - input.getTime()) / 60000);
// }

// function fmtDiff(mins) {
//   if (mins == null) return "-";
//   const sign = mins > 0 ? "+" : "";
//   return `${sign}${mins}m`;
// }

// export default function MyTimesheets() {
//   const { fbUser } = useAuth();
//   const uid = fbUser?.uid;

//   const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
//   const [loading, setLoading] = useState(true);
//   const [items, setItems] = useState([]);

//   const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   useEffect(() => {
//     if (!uid) return;
//     loadWeek();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [uid, weekStart]);

//   async function loadWeek() {
//     setLoading(true);

//     const startYMD = weekStart;
//     const endYMD = toYMD(addDays(weekStartDateObj, 7)); // exclusive

//     const q = query(
//       collection(db, "timesheets"),
//       where("uid", "==", uid),
//       where("date", ">=", startYMD),
//       where("date", "<", endYMD)
//     );

//     const snap = await getDocs(q);
//     const list = snap.docs
//       .map((d) => ({ id: d.id, ...d.data() }))
//       .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

//     setItems(list);
//     setLoading(false);
//   }

//   const totalMinutes = useMemo(() => {
//     return items.reduce((sum, ts) => sum + calcWorkedMinutes(ts), 0);
//   }, [items]);

//   function timesheetForDate(ymd) {
//     return items.find((x) => x.date === ymd) || null;
//   }

//   return (
//     // <div className="container">
//     //   <div className="card">
//     //     <div className="top">
//     //       <div>
//     //         <h1 className="h1">My Timesheets</h1>
//     //         <p className="p">Hours are calculated from your following week.</p>
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
//     //           <button className="btn" onClick={loadWeek}>
//     //             Refresh
//     //           </button>
//     //         </div>
//     //       </div>
//     //     </div>

//     //     <div className="spacer" />

//     //     <div className="totals">
//     //       <div className="totCard">
//     //         <div className="totLabel">Total hours (week)</div>
//     //         <div className="totValue">{minutesToHours(totalMinutes)} h</div>
//     //       </div>
//     //       <div className="totCard">
//     //         <div className="totLabel">Total minutes</div>
//     //         <div className="totValue">{totalMinutes} m</div>
//     //       </div>
//     //     </div>

//     //     <div className="spacer" />

//     //     {loading ? (
//     //       <p className="p">Loading…</p>
//     //     ) : (
//     //       <div className="week">
//     //         {days.map((d) => {
//     //           const ymd = toYMD(d);
//     //           const ts = timesheetForDate(ymd);

//     //           return (
//     //             <div key={ymd} className="day">
//     //               <div className="dayHead">
//     //                 <div>
//     //                   <div className="dayTitle">{prettyDate(d)}</div>
//     //                   <div className="daySub">{ymd}</div>
//     //                 </div>

//     //                 <div className="hoursPill">
//     //                   {ts ? `${minutesToHours(calcWorkedMinutes(ts))} h` : "-"}
//     //                 </div>
//     //               </div>

//     //               {!ts ? (
//     //                 <div className="empty">No timesheet</div>
//     //               ) : (
//     //                 <>
//     //                   <div className="line">
//     //                     <div className="k">Store</div>
//     //                     <div className="v">{storeLabel(ts.storeId)}</div>
//     //                   </div>

//     //                   <div className="line">
//     //                     <div className="k">Start</div>
//     //                     <div className="v">
//     //                       {ts.startInput || "-"} 
//     //                     </div>
//     //                   </div>

//     //                   <div className="line">
//     //                     <div className="k">Break</div>
//     //                     <div className="v">
//     //                       {ts.breakStartInput && ts.breakEndInput
//     //                         ? `${ts.breakStartInput} – ${ts.breakEndInput}`
//     //                         : "No break"}{" "}
                          
//     //                     </div>
//     //                   </div>

//     //                   <div className="line">
//     //                     <div className="k">End</div>
//     //                     <div className="v">
//     //                       {ts.endInput || "-"} 
//     //                     </div>
//     //                   </div>
//     //                 </>
//     //               )}
//     //             </div>
//     //           );
//     //         })}
//     //       </div>
//     //     )}
//     //   </div>
//     // </div>

//         <div className="mobile-app-wrapper">
//           {/* Sticky Top Header */}
//           <header className="app-header">
//             <div className="header-text">
//               <h1 className="main-title">My Timesheets</h1>
//               <span className="subtitle">Weekly Overview</span>
//             </div>
//             <button className="refresh-circle" onClick={loadWeek}>
//               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//             </button>
//           </header>
        
//           <main className="scroll-content">
//             {/* Floating Stats Bar */}
//             <section className="stats-bar">
//               <div className="stat-item">
//                 <label>Worked</label>
//                 <div className="value">{minutesToHours(totalMinutes)}<small>h</small></div>
//               </div>
//               <div className="stat-divider" />
//               <div className="stat-item">
//                 <label>Minutes</label>
//                 <div className="value">{totalMinutes}<small>m</small></div>
//               </div>
//             </section>
        
//             {/* Date Navigation Strip */}
//             <section className="date-nav">
//               <div className="date-display">
//                 <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
//               </div>
//               <div className="button-group">
//                 <button className="pill-btn" onClick={() => setWeekStart(toYMD(getWeekStartMonday(subDays(new Date(weekStart), 7))))}>
//                   Prev
//                 </button>
//                 <button 
//                   className={`pill-btn ${weekStart === toYMD(getWeekStartMonday(new Date())) ? 'active' : ''}`} 
//                   onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}
//                 >
//                   This Week
//                 </button>
//                 <button className="pill-btn" onClick={() => setWeekStart(toYMD(getWeekStartMonday(addDays(new Date(weekStart), 7))))}>
//                   Next
//                 </button>
//               </div>
//             </section>
        
//             {/* Timeline of Days */}
//             <div className="timeline">
//               {days.map((d) => {
//                 const ymd = toYMD(d);
//                 const ts = timesheetForDate(ymd);
//                 const worked = ts ? calcWorkedMinutes(ts) : 0;
                
//                 return (
//                   <div key={ymd} className={`timeline-card ${worked > 0 ? 'has-data' : ''}`}>
//                     <div className="card-side">
//                       <span className="day-abbr">{prettyDate(d).substring(0, 3)}</span>
//                       <span className="day-num">{d.getDate()}</span>
//                     </div>
//                     <div className="card-main">
//                       {ts ? (
//                         <>
//                           <div className="card-row">
//                             <span className="store-tag">{storeLabel(ts.storeId)}</span>
//                             <span className="hours-total">{minutesToHours(worked)}h</span>
//                           </div>
//                           <div className="time-grid">
//                             <div className="time-box">
//                               <label>IN</label>
//                               <span>{ts.startInput || '--:--'}</span>
//                             </div>
//                             <div className="time-box">
//                               <label>BREAK</label>
//                               <span>{ts.breakStartInput ? 'Done' : 'None'}</span>
//                             </div>
//                             <div className="time-box">
//                               <label>OUT</label>
//                               <span>{ts.endInput || '--:--'}</span>
//                             </div>
//                           </div>
//                         </>
//                       ) : (
//                         <span className="no-entry">No shift recorded</span>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </main>
//         </div>
//   );
// }










// import { useEffect, useMemo, useState, useCallback } from "react";
// import { collection, getDocs, query, where } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { subDays, addDays, getWeekStartMonday, toYMD, weekDates, prettyDate } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import { useToast } from "../../context/ToastContext"; // Import Toast Hook
// import "./MyTimesheets.css";

// // Utility Helpers
// const storeLabel = (storeId) => STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// const minutesToHours = (min) => Math.round((min / 60) * 100) / 100;
// const hmToMinutes = (hm) => {
//   if (!hm) return null;
//   const [h, m] = hm.split(":").map(Number);
//   return h * 60 + m;
// };

// const calcWorkedMinutes = (ts) => {
//   const start = hmToMinutes(ts.startInput);
//   const end = hmToMinutes(ts.endInput);
//   if (start == null || end == null) return 0;
//   let worked = end - start;
//   if (worked < 0) worked += 1440; // 24h safety
//   const bs = hmToMinutes(ts.breakStartInput);
//   const be = hmToMinutes(ts.breakEndInput);
//   if (bs != null && be != null) {
//     let br = be - bs;
//     if (br < 0) br += 1440;
//     worked -= br;
//   }
//   return Math.max(0, worked);
// };

// export default function MyTimesheets() {
//   const { fbUser } = useAuth();
//   const { showToast } = useToast(); // Initialize Toast
//   const uid = fbUser?.uid;

//   const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
//   const [loading, setLoading] = useState(true);
//   const [items, setItems] = useState([]);

//   const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

//   const loadWeek = useCallback(async (isManual = false) => {
//     if (!uid) return;
//     if (!isManual) setLoading(true);

//     try {
//       const startYMD = weekStart;
//       const endYMD = toYMD(addDays(weekStartDateObj, 7));

//       const q = query(
//         collection(db, "timesheets"),
//         where("uid", "==", uid),
//         where("date", ">=", startYMD),
//         where("date", "<", endYMD)
//       );

//       const snap = await getDocs(q);
//       const list = snap.docs
//         .map((d) => ({ id: d.id, ...d.data() }))
//         .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      
//       setItems(list);
      
//       if (isManual) {
//         showToast("Timesheets synced", "success");
//       }
//     } catch (e) {
//       console.error(e);
//       showToast("Error loading timesheets", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [uid, weekStart, weekStartDateObj]);

//   useEffect(() => {
//     loadWeek();
//   }, [loadWeek]);

//   const totalMinutes = useMemo(() => {
//     return items.reduce((sum, ts) => sum + calcWorkedMinutes(ts), 0);
//   }, [items]);

//   const timesheetForDate = (ymd) => items.find((x) => x.date === ymd) || null;

//   return (
//     <div className="mobile-app-wrapper">
//       <header className="app-header">
//         <div className="header-text">
//           <h1 className="main-title">My Timesheets</h1>
//           <span className="subtitle">Weekly Overview</span>
//         </div>
//         <button 
//           className={`refresh-circle ${loading ? 'spinning' : ''}`} 
//           onClick={() => loadWeek(true)} 
//           disabled={loading}
//         >
//           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//         </button>
//       </header>

//       <main className="scroll-content">
//         <section className="stats-bar">
//           <div className="stat-item">
//             <label>Worked</label>
//             <div className="value">{minutesToHours(totalMinutes)}<small>h</small></div>
//           </div>
//           <div className="stat-divider" />
//           <div className="stat-item">
//             <label>Minutes</label>
//             <div className="value">{totalMinutes}<small>m</small></div>
//           </div>
//         </section>

//         <section className="date-nav">
//           <div className="date-display">
//             <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
//           </div>
//           <div className="button-group">
//             <button className="pill-btn" onClick={() => setWeekStart(toYMD(subDays(weekStartDateObj, 7)))}>Prev</button>
//             <button 
//               className={`pill-btn ${weekStart === toYMD(getWeekStartMonday(new Date())) ? 'active' : ''}`} 
//               onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}
//             >
//               This Week
//             </button>
//             <button className="pill-btn" onClick={() => setWeekStart(toYMD(addDays(weekStartDateObj, 7)))}>Next</button>
//           </div>
//         </section>

//         <div className="timeline">
//           {loading ? (
//             <div className="loader-inline">
//               <div className="spinner"></div>
//               <span>Syncing hours...</span>
//             </div>
//           ) : (
//             days.map((d) => {
//               const ymd = toYMD(d);
//               const ts = timesheetForDate(ymd);
//               const worked = ts ? calcWorkedMinutes(ts) : 0;
//               return (
//                 <div key={ymd} className={`timeline-card ${worked > 0 ? 'has-data' : ''}`}>
//                   <div className="card-side">
//                     <span className="day-abbr">{prettyDate(d).substring(0, 3)}</span>
//                     <span className="day-num">{d.getDate()}</span>
//                   </div>
//                   <div className="card-main">
//                     {ts ? (
//                       <>
//                         <div className="card-row">
//                           <span className="store-tag">{storeLabel(ts.storeId)}</span>
//                           <span className="hours-total">{minutesToHours(worked)}h</span>
//                         </div>
//                         <div className="time-grid">
//                           <div className="time-box"><label>IN</label><span>{ts.startInput || '--:--'}</span></div>
//                           <div className="time-box"><label>BREAK</label><span>{ts.breakStartInput ? 'Done' : 'None'}</span></div>
//                           <div className="time-box"><label>OUT</label><span>{ts.endInput || '--:--'}</span></div>
//                         </div>
//                       </>
//                     ) : (
//                       <span className="no-entry">No shift recorded</span>
//                     )}
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </main>
//     </div>
//   );
// }








// src/pages/staff/MyTimesheets.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
import { useStores } from "../../hooks/useStore";
import {
  subDays,
  addDays,
  getWeekStartMonday,
  toYMD,
  weekDates,
  prettyDate,
} from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import "./MyTimesheets.css";

// // Utility Helpers
// const storeLabel = (storeId) =>
//   STORES.find((s) => s.id === storeId)?.label || storeId || "-";

const minutesToHours = (min) => Math.round((min / 60) * 100) / 100;

const hmToMinutes = (hm) => {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

const calcWorkedMinutes = (ts) => {
  const start = hmToMinutes(ts.startInput);
  const end = hmToMinutes(ts.endInput);
  if (start == null || end == null) return 0;

  let worked = end - start;
  if (worked < 0) worked += 1440;

  const bs = hmToMinutes(ts.breakStartInput);
  const be = hmToMinutes(ts.breakEndInput);

  if (bs != null && be != null) {
    let br = be - bs;
    if (br < 0) br += 1440;
    worked -= br;
  }

  return Math.max(0, worked);
};

export default function MyTimesheets() {
  const { fbUser } = useAuth();
  const { showToast } = useToast();
  
  const { getStoreLabel } = useStores();
  const uid = fbUser?.uid;

  const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const weekStartDateObj = useMemo(
    () => new Date(weekStart + "T00:00:00"),
    [weekStart]
  );

  const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

  const loadWeek = useCallback(
    async (isManual = false) => {
      if (!uid) return;

      if (!isManual) setLoading(true);

      try {
        const startYMD = weekStart;
        const endYMD = toYMD(addDays(weekStartDateObj, 7)); // exclusive

        const q = query(
          collection(db, "timesheets"),
          where("uid", "==", uid),
          where("date", ">=", startYMD),
          where("date", "<", endYMD)
        );

        const snap = await getDocs(q);

        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

        setItems(list);

        if (isManual) showToast("Timesheets synced", "success");
      } catch (e) {
        console.error(e);
        showToast("Error loading timesheets", "error");
      } finally {
        setLoading(false);
      }
    },
    [uid, weekStart, weekStartDateObj, showToast]
  );

  useEffect(() => {
    if (!uid) return;
    loadWeek();
  }, [uid, loadWeek]);

  const totalMinutes = useMemo(
    () => items.reduce((sum, ts) => sum + calcWorkedMinutes(ts), 0),
    [items]
  );

  const timesheetForDate = (ymd) => items.find((x) => x.date === ymd) || null;

  return (
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">My Timesheets</h1>
          <span className="subtitle">Weekly Overview</span>
        </div>

        <button
          className={`refresh-circle ${loading ? "spinning" : ""}`}
          onClick={() => loadWeek(true)}
          disabled={loading}
          title="Sync"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </header>

      <main className="scroll-content">
        <section className="stats-bar">
          <div className="stat-item">
            <label>Worked</label>
            <div className="value">
              {minutesToHours(totalMinutes)}
              <small>h</small>
            </div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <label>Minutes</label>
            <div className="value">
              {totalMinutes}
              <small>m</small>
            </div>
          </div>
        </section>

        <section className="date-nav">
          <div className="date-display">
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>

          {/* ✅ your requested classnames */}
          <div className="button-group">
            <button
              className="pill-btn"
              onClick={() => setWeekStart(toYMD(subDays(weekStartDateObj, 7)))}
            >
              Prev
            </button>

            <button
              className={`pill-btn ${
                weekStart === toYMD(getWeekStartMonday(new Date())) ? "active" : ""
              }`}
              onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}
            >
              This Week
            </button>

            <button
              className="pill-btn"
              onClick={() => setWeekStart(toYMD(addDays(weekStartDateObj, 7)))}
            >
              Next
            </button>
          </div>
        </section>

        <div className="timeline">
          {loading ? (
            <div className="loader-inline">
              <div className="spinner"></div>
              <span>Syncing hours...</span>
            </div>
          ) : (
            days.map((d) => {
              const ymd = toYMD(d);
              const ts = timesheetForDate(ymd);
              const worked = ts ? calcWorkedMinutes(ts) : 0;

              return (
                <div
                  key={ymd}
                  className={`timeline-card ${worked > 0 ? "has-data" : ""}`}
                >
                  <div className="card-side">
                    <span className="day-abbr">
                      {prettyDate(d).substring(0, 3)}
                    </span>
                    <span className="day-num">{d.getDate()}</span>
                  </div>

                  <div className="card-main">
                    {ts ? (
                      <>
                        <div className="card-row">
                          <span className="store-tag">
                            {getStoreLabel(ts.storeId)}
                          </span>
                          <span className="hours-total">
                            {minutesToHours(worked)}h
                          </span>
                        </div>

                        <div className="time-grid">
                          <div className="time-box">
                            <label>IN</label>
                            <span>{ts.startInput || "--:--"}</span>
                          </div>
                          <div className="time-box">
                            <label>BREAK</label>
                            <span>{ts.breakStartInput ? "Done" : "None"}</span>
                          </div>
                          <div className="time-box">
                            <label>OUT</label>
                            <span>{ts.endInput || "--:--"}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="no-entry">No shift recorded</span>
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