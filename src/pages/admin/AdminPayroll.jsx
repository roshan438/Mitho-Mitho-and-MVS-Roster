// // src/pages/admin/AdminPayroll.jsx
// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   collection,
//   doc,
//   getDoc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import "./Payroll.css";

// // ---------------- Helpers ----------------
// const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

// const money = (n) =>
//   Number(n || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

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
//   if (worked < 0) worked += 1440; // safety

//   const bs = hmToMinutes(ts.breakStartInput);
//   const be = hmToMinutes(ts.breakEndInput);

//   // ✅ If no break OR only one side missing -> treat break as 0 (your requirement)
//   if (bs != null && be != null) {
//     let br = be - bs;
//     if (br < 0) br += 1440;
//     worked -= br;
//   }
//   return Math.max(0, worked);
// };

// const minutesToHours = (min) => Math.round((min / 60) * 100) / 100;

// // Week Mon–Sun, Payday = next Thursday after that week.
// // If weekStart is Monday: payday = weekStart + 10 days.
// function getPaydayForWeekStart(weekStartYMD) {
//   const d = new Date(weekStartYMD + "T00:00:00");
//   const payday = addDays(d, 10);
//   return toYMD(payday);
// }

// export default function AdminPayroll() {
//   const { showToast } = useToast();

//   const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
//   const weekStartObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   const weekEndExclusive = useMemo(() => toYMD(addDays(weekStartObj, 7)), [weekStartObj]);
//   const weekEndInclusive = useMemo(() => toYMD(addDays(weekStartObj, 6)), [weekStartObj]);

//   const paydayYMD = useMemo(() => getPaydayForWeekStart(weekStart), [weekStart]);
//   const todayYMD = useMemo(() => toYMD(new Date()), []);
//   const isPaydayToday = todayYMD === paydayYMD;

//   const [loading, setLoading] = useState(true);

//   // staff: {uid, name, hourlyRate}
//   const [staffList, setStaffList] = useState([]);

//   // payroll rows: {uid, staffName, totalHours, totalAmount, paidTotal, remaining, status}
//   const [rows, setRows] = useState([]);

//   // input for partial payments
//   const [payInputs, setPayInputs] = useState({}); // uid -> "100"

//   // -------- Load staff list (approved staff + hourlyRate) --------
//   const loadStaff = useCallback(async () => {
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
//         hourlyRate: Number(d.data().hourlyRate || 0),
//       }))
//       .sort((a, b) => a.name.localeCompare(b.name));

//     setStaffList(list);
//   }, []);

//   // -------- Load payroll summary from payrollWeeks --------
//   const loadWeekRows = useCallback(async () => {
//     setLoading(true);
//     try {
//       const snap = await getDocs(collection(db, "payrollWeeks", weekStart, "staff"));
//       const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       // ensure payInputs keys exist
//       setPayInputs((prev) => {
//         const next = { ...prev };
//         list.forEach((r) => {
//           if (next[r.uid] == null) next[r.uid] = "";
//         });
//         return next;
//       });

//       // sort: remaining desc, then name
//       list.sort(
//         (a, b) =>
//           Number(b.remaining || 0) - Number(a.remaining || 0) ||
//           String(a.staffName || "").localeCompare(String(b.staffName || ""))
//       );

//       setRows(list);
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to load payroll week", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [weekStart, showToast]);

//   useEffect(() => {
//     loadStaff();
//   }, [loadStaff]);

//   useEffect(() => {
//     loadWeekRows();
//   }, [loadWeekRows]);

//   // -------- Sync from timesheets (Mon–Sun) into payrollDays + payrollWeeks --------
//   async function syncFromTimesheets() {
//     setLoading(true);
//     try {
//       if (!staffList.length) {
//         await loadStaff();
//       }

//       // Build map rates
//       const rateByUid = {};
//       const nameByUid = {};
//       staffList.forEach((s) => {
//         rateByUid[s.uid] = Number(s.hourlyRate || 0);
//         nameByUid[s.uid] = s.name;
//       });

//       // 1) Fetch timesheets in week range
//       const qTs = query(
//         collection(db, "timesheets"),
//         where("date", ">=", weekStart),
//         where("date", "<", weekEndExclusive)
//       );
//       const snap = await getDocs(qTs);
//       const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       // 2) Write payrollDays entries (per day + uid) & aggregate weekly totals
//       const agg = {}; // uid -> {hours, amount}

//       for (const ts of list) {
//         const uid = ts.uid;
//         if (!uid) continue;

//         const mins = calcWorkedMinutes(ts);
//         const workedHours = minutesToHours(mins);

//         const rate = Number(rateByUid[uid] || ts.hourlyRate || 0);
//         const amount = round2(workedHours * rate);

//         // payrollDays/{date}/entries/{uid}
//         const dayRef = doc(db, "payrollDays", ts.date, "entries", uid);
//         await setDoc(
//           dayRef,
//           {
//             uid,
//             staffName: nameByUid[uid] || ts.staffName || "Unknown",
//             date: ts.date,
//             storeId: ts.storeId || "unknown",
//             hours: workedHours,
//             rate,
//             amount,
//             source: "timesheet",
//             note: "",
//             updatedAt: serverTimestamp(),
//             createdAt: serverTimestamp(),
//           },
//           { merge: true }
//         );

//         // aggregate
//         if (!agg[uid]) agg[uid] = { hours: 0, amount: 0 };
//         agg[uid].hours = round2(agg[uid].hours + workedHours);
//         agg[uid].amount = round2(agg[uid].amount + amount);
//       }

//       // 3) Update payrollWeeks/{weekStart}/staff/{uid} totals but keep payment state
//       for (const uid of Object.keys(agg)) {
//         const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
//         const curSnap = await getDoc(ref);
//         const cur = curSnap.exists() ? curSnap.data() : null;

//         const totalHours = round2(agg[uid].hours);
//         const totalAmount = round2(agg[uid].amount);

//         const paidTotal = round2(Number(cur?.paidTotal || 0));
//         const remaining = round2(Math.max(0, totalAmount - paidTotal));

//         const status =
//           totalAmount === 0
//             ? "unpaid"
//             : remaining === 0
//             ? "paid"
//             : paidTotal > 0
//             ? "partial"
//             : "unpaid";

//         await setDoc(
//           ref,
//           {
//             uid,
//             staffName: cur?.staffName || nameByUid[uid] || uid,
//             weekStart,
//             weekEnd: weekEndInclusive,
//             payday: paydayYMD,
//             totalHours,
//             totalAmount,
//             paidTotal,
//             remaining,
//             status,
//             updatedAt: serverTimestamp(),
//             createdAt: cur?.createdAt || serverTimestamp(),
//           },
//           { merge: true }
//         );
//       }

//       showToast("Synced payroll from timesheets", "success");
//       await loadWeekRows();
//     } catch (e) {
//       console.error(e);
//       showToast("Sync failed", "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   // -------- Payment actions --------
//   async function pay(uid, mode) {
//     try {
//       const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
//       const snap = await getDoc(ref);
//       if (!snap.exists()) return showToast("Row not found. Sync first.", "error");

//       const r = snap.data();
//       const totalAmount = Number(r.totalAmount || 0);
//       const paidTotal = Number(r.paidTotal || 0);
//       const remaining = Number(r.remaining || 0);

//       if (remaining <= 0) return showToast("No remaining balance", "error");

//       let addPay = 0;

//       if (mode === "full") {
//         addPay = remaining;
//       } else {
//         const raw = String(payInputs[uid] || "").trim();
//         const n = Number(raw);
//         if (!raw || Number.isNaN(n) || n <= 0) return showToast("Enter valid amount", "error");
//         addPay = Math.min(n, remaining);
//       }

//       const newPaid = round2(paidTotal + addPay);
//       const newRemaining = round2(Math.max(0, totalAmount - newPaid));
//       const status =
//         totalAmount === 0
//           ? "unpaid"
//           : newRemaining === 0
//           ? "paid"
//           : newPaid > 0
//           ? "partial"
//           : "unpaid";

//       await updateDoc(ref, {
//         paidTotal: newPaid,
//         remaining: newRemaining,
//         status,
//         lastPaymentAt: serverTimestamp(),
//         lastPaymentAmount: addPay,
//         updatedAt: serverTimestamp(),
//       });

//       // optional: payment log
//       const logRef = doc(
//         db,
//         "payrollWeeks",
//         weekStart,
//         "staff",
//         uid,
//         "payments",
//         `${Date.now()}`
//       );
//       await setDoc(logRef, {
//         uid,
//         weekStart,
//         amount: addPay,
//         createdAt: serverTimestamp(),
//         note: mode === "full" ? "Paid full remaining" : "Partial payment",
//       });

//       setPayInputs((p) => ({ ...p, [uid]: "" }));
//       showToast("Payment saved", "success");
//       await loadWeekRows();
//     } catch (e) {
//       console.error(e);
//       showToast("Payment failed", "error");
//     }
//   }

//   const totals = useMemo(() => {
//     const totalAmount = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
//     const paid = rows.reduce((s, r) => s + Number(r.paidTotal || 0), 0);
//     const remaining = rows.reduce((s, r) => s + Number(r.remaining || 0), 0);
//     return {
//       totalAmount: round2(totalAmount),
//       paid: round2(paid),
//       remaining: round2(remaining),
//     };
//   }, [rows]);

//   return (
//     <div className="mobile-app-wrapper">
//       <header className="app-header">
//         <div className="header-text">
//           <h1 className="main-title">Admin Payroll</h1>
//           <span className="subtitle">
//             Week {weekStart} → {weekEndInclusive} • Payday: {paydayYMD}
//           </span>
//         </div>

//         <button
//           className={`refresh-circle ${loading ? "spinning" : ""}`}
//           onClick={syncFromTimesheets}
//           disabled={loading}
//           title="Sync from timesheets"
//         >
//           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//             <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//           </svg>
//         </button>
//       </header>

//       <main className="scroll-content">
//         {/* Payday highlight (uses existing stats-bar look) */}
//         {isPaydayToday && (
//           <section className="stats-bar">
//             <div className="stat-item">
//               <label>Payday</label>
//               <div className="value brand">Today</div>
//             </div>
//             <div className="stat-divider" />
//             <div className="stat-item">
//               <label>Reminder</label>
//               <div className="value">Pay staff balances</div>
//             </div>
//           </section>
//         )}

//         {/* Week picker */}
//         <section className="payroll-filters-container">
//           <div className="filters-grid">
//             <div className="filter-field">
//               <label>Week Start (Mon)</label>
//               <input
//                 type="date"
//                 value={weekStart}
//                 onChange={(e) => setWeekStart(e.target.value)}
//                 disabled={loading}
//               />
//             </div>

//             <div className="filter-field">
//               <label>Week End</label>
//               <input type="date" value={weekEndInclusive} disabled />
//             </div>

//             <div className="filter-field">
//               <label>Payday</label>
//               <input type="date" value={paydayYMD} disabled />
//             </div>

//             <div className="filter-field">
//               <label>Actions</label>
//               <button className="tab-item active" onClick={syncFromTimesheets} disabled={loading}>
//                 Sync from Timesheets
//               </button>
//             </div>
//           </div>
//         </section>

//         {/* Totals */}
//         <section className="stats-bar mid ">
//           <div className="stat-item mid">
//             <label>Total</label>
//             <div className="value">{money(totals.totalAmount)}</div>
//           </div>
//           <div className="stat-divider" />
//           <div className="stat-item mid">
//             <label>Paid</label>
//             <div className="value paid-balance">{money(totals.paid)}</div>
//           </div>
//           <div className="stat-divider" />
//           <div className="stat-item mid">
//             <label>Remaining</label>
//             <div className="value remain-balance">{money(totals.remaining)}</div>
//           </div>
//         </section>

//         {/* List */}
//         <div className="payroll-list timeline">
//           {loading ? (
//             <div className="loader-inline">
//               <div className="spinner"></div>
//               <span>Loading payroll...</span>
//             </div>
//           ) : rows.length === 0 ? (
//             <div className="empty-state-container">
//               <p>No payroll rows yet. Click Sync.</p>
//             </div>
//           ) : (
//             rows.map((r) => {
//               const remaining = Number(r.remaining || 0);
//               const status = String(r.status || "unpaid");

//               return (
//                 <div key={r.uid} className="payroll-card">
//                   <div className="payroll-card-main">
//                     <div className="staff-header">
//                       {/* clickable to your PayrollHistory page */}
//                       <span
//                         className="staff-name"
//                         style={{ cursor: "pointer" }}
//                         onClick={() => (window.location.href = `/admin/payroll/${weekStart}/${r.uid}`)}
//                         title="Open history"
//                       >
//                         {r.staffName || r.uid}
//                       </span>

//                       <span className="shift-tag">
//                         {status.toUpperCase()}
//                       </span>
//                     </div>

//                     <div className="payroll-details">
//                       <div className="pay-col">
//                         <label>Hours</label>
//                         <span>{Number(r.totalHours || 0).toFixed(2)}h</span>
//                       </div>
//                       <div className="pay-col">
//                         <label>Total</label>
//                         <span>{money(r.totalAmount)}</span>
//                       </div>
//                       <div className="pay-col">
//                         <label>Paid</label>
//                         <span>{money(r.paidTotal)}</span>
//                       </div>
//                       <div className="pay-col total">
//                         <label>Remaining</label>
//                         <span className="brand">{money(r.remaining)}</span>
//                       </div>
//                     </div>

//                     {/* Payment controls (re-using existing layout classes; no new CSS required) */}
//                     <div className="payroll-details" style={{ marginTop: 10 }}>
//                       <div className="pay-col">
//                         <label>Partial Pay</label>
//                         <input
//                         className=""
//                           value={payInputs[r.uid] || ""}
//                           onChange={(e) =>
//                             setPayInputs((p) => ({ ...p, [r.uid]: e.target.value }))
//                           }
//                           placeholder="e.g. 100"
//                           disabled={remaining <= 0}
//                         />
//                       </div>

//                       <div className="pay-col">
//                         <label>Action</label>
//                         <button
//                           className={`tab-item ${remaining <= 0 ? "" : "active"}`}
//                           onClick={() => pay(r.uid, "partial")}
//                           disabled={remaining <= 0}
//                         >
//                           Pay Part
//                         </button>
//                       </div>

//                       <div className="pay-col total">
//                         <label>Action</label>
//                         <button
//                           className={`tab-item ${remaining <= 0 ? "" : "active"}`}
//                           onClick={() => pay(r.uid, "full")}
//                           disabled={remaining <= 0}
//                         >
//                           Mark Paid
//                         </button>
//                       </div>
//                     </div>
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







// // src/pages/admin/AdminPayroll.jsx
// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   collection,
//   collectionGroup,
//   doc,
//   getDoc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import "./Payroll.css";

// // ---------------- Helpers ----------------
// const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

// const money = (n) =>
//   Number(n || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

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
//   if (worked < 0) worked += 1440; // safety

//   const bs = hmToMinutes(ts.breakStartInput);
//   const be = hmToMinutes(ts.breakEndInput);

//   // If break missing, treat break as 0 ✅
//   if (bs != null && be != null) {
//     let br = be - bs;
//     if (br < 0) br += 1440;
//     worked -= br;
//   }
//   return Math.max(0, worked);
// };

// const minutesToHours = (min) => Math.round((min / 60) * 100) / 100;

// // Week Mon–Sun, Payday = next Thursday after that week.
// // If weekStart is Monday: payday = weekStart + 10 days.
// function getPaydayForWeekStart(weekStartYMD) {
//   const d = new Date(weekStartYMD + "T00:00:00");
//   const payday = addDays(d, 10);
//   return toYMD(payday);
// }

// function chunk(arr, size) {
//   const out = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }

// export default function AdminPayroll() {
//   const { showToast } = useToast();

//   const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
//   const weekStartObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
//   const weekEndExclusive = useMemo(() => toYMD(addDays(weekStartObj, 7)), [weekStartObj]);
//   const weekEndInclusive = useMemo(() => toYMD(addDays(weekStartObj, 6)), [weekStartObj]);

//   const paydayYMD = useMemo(() => getPaydayForWeekStart(weekStart), [weekStart]);
//   const todayYMD = useMemo(() => toYMD(new Date()), []);
//   const isPaydayToday = todayYMD === paydayYMD;

//   const [loading, setLoading] = useState(true);

//   // staff: {uid, name, hourlyRate}
//   const [staffList, setStaffList] = useState([]);

//   // payroll rows: {uid, staffName, totalHours, totalAmount, paidTotal, remaining, status}
//   const [rows, setRows] = useState([]);

//   // input for partial payments
//   const [payInputs, setPayInputs] = useState({}); // uid -> "100"

//   // ✅ ALL-WEEKS totals per staff (remaining/paid/total)
//   const [allWeeksByUid, setAllWeeksByUid] = useState({}); // uid -> { remaining, totalAmount, paidTotal }

//   // -------- Load staff list (approved staff + hourlyRate) --------
//   const loadStaff = useCallback(async () => {
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
//         hourlyRate: Number(d.data().hourlyRate || 0),
//       }))
//       .sort((a, b) => a.name.localeCompare(b.name));

//     setStaffList(list);
//   }, []);

//   // -------- Load payroll summary from payrollWeeks --------
//   const loadWeekRows = useCallback(async () => {
//     setLoading(true);
//     try {
//       const snap = await getDocs(collection(db, "payrollWeeks", weekStart, "staff"));
//       const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       // ensure payInputs keys exist
//       setPayInputs((prev) => {
//         const next = { ...prev };
//         list.forEach((r) => {
//           if (next[r.uid] == null) next[r.uid] = "";
//         });
//         return next;
//       });

//       // sort: remaining desc, then name
//       list.sort(
//         (a, b) =>
//           Number(b.remaining || 0) - Number(a.remaining || 0) ||
//           String(a.staffName || "").localeCompare(String(b.staffName || ""))
//       );

//       setRows(list);
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to load payroll week", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [weekStart, showToast]);

//   // ✅ Load ALL-WEEKS remaining/paid/total for the staff currently visible
//   const loadAllWeeksTotals = useCallback(async (uids) => {
//     if (!uids || uids.length === 0) return;

//     try {
//       const out = {};
//       const batches = chunk(uids, 10); // "in" max 10
//       for (const part of batches) {
//         const qAll = query(collectionGroup(db, "staff"), where("uid", "in", part));
//         const snap = await getDocs(qAll);

//         snap.docs.forEach((d) => {
//           const data = d.data() || {};
//           const uid = data.uid || d.id;
//           if (!out[uid]) out[uid] = { remaining: 0, totalAmount: 0, paidTotal: 0 };

//           out[uid].remaining = round2(out[uid].remaining + Number(data.remaining || 0));
//           out[uid].totalAmount = round2(out[uid].totalAmount + Number(data.totalAmount || 0));
//           out[uid].paidTotal = round2(out[uid].paidTotal + Number(data.paidTotal || 0));
//         });
//       }

//       setAllWeeksByUid((prev) => ({ ...prev, ...out }));
//     } catch (e) {
//       console.error(e);
//       // (optional) showToast, but keep UI smooth
//     }
//   }, []);

//   useEffect(() => {
//     loadStaff();
//   }, [loadStaff]);

//   useEffect(() => {
//     loadWeekRows();
//   }, [loadWeekRows]);

//   // whenever rows change, refresh all-weeks totals for those uids
//   useEffect(() => {
//     const uids = rows.map((r) => r.uid).filter(Boolean);
//     loadAllWeeksTotals(uids);
//   }, [rows, loadAllWeeksTotals]);

//   // -------- Sync from timesheets (Mon–Sun) into payrollDays + payrollWeeks --------
//   async function syncFromTimesheets() {
//     setLoading(true);
//     try {
//       if (!staffList.length) {
//         await loadStaff();
//       }

//       // Build map rates
//       const rateByUid = {};
//       const nameByUid = {};
//       staffList.forEach((s) => {
//         rateByUid[s.uid] = Number(s.hourlyRate || 0);
//         nameByUid[s.uid] = s.name;
//       });

//       // 1) Fetch timesheets in week range
//       const qTs = query(
//         collection(db, "timesheets"),
//         where("date", ">=", weekStart),
//         where("date", "<", weekEndExclusive)
//       );
//       const snap = await getDocs(qTs);
//       const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       // 2) Write payrollDays entries (per day + uid) & aggregate weekly totals
//       const agg = {}; // uid -> {hours, amount}

//       for (const ts of list) {
//         const uid = ts.uid;
//         if (!uid) continue;

//         const mins = calcWorkedMinutes(ts);
//         const workedHours = minutesToHours(mins);

//         const rate = Number(rateByUid[uid] || ts.hourlyRate || 0);
//         const amount = round2(workedHours * rate);

//         // payrollDays/{date}/entries/{uid}
//         const dayRef = doc(db, "payrollDays", ts.date, "entries", uid);
//         await setDoc(
//           dayRef,
//           {
//             uid,
//             staffName: nameByUid[uid] || ts.staffName || "Unknown",
//             date: ts.date,
//             storeId: ts.storeId || "unknown",
//             hours: workedHours,
//             rate,
//             amount,
//             source: "timesheet",
//             note: "",
//             updatedAt: serverTimestamp(),
//             createdAt: serverTimestamp(),
//           },
//           { merge: true }
//         );

//         // aggregate
//         if (!agg[uid]) agg[uid] = { hours: 0, amount: 0 };
//         agg[uid].hours = round2(agg[uid].hours + workedHours);
//         agg[uid].amount = round2(agg[uid].amount + amount);
//       }

//       // 3) Update payrollWeeks/{weekStart}/staff/{uid} totals but keep payment state
//       for (const uid of Object.keys(agg)) {
//         const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
//         const curSnap = await getDoc(ref);
//         const cur = curSnap.exists() ? curSnap.data() : null;

//         const totalHours = round2(agg[uid].hours);
//         const totalAmount = round2(agg[uid].amount);

//         const paidTotal = round2(Number(cur?.paidTotal || 0));
//         const remaining = round2(Math.max(0, totalAmount - paidTotal));

//         const status =
//           totalAmount === 0
//             ? "unpaid"
//             : remaining === 0
//             ? "paid"
//             : paidTotal > 0
//             ? "partial"
//             : "unpaid";

//         await setDoc(
//           ref,
//           {
//             uid,
//             staffName: cur?.staffName || nameByUid[uid] || uid,
//             weekStart,
//             weekEnd: weekEndInclusive,
//             payday: paydayYMD,
//             totalHours,
//             totalAmount,
//             paidTotal,
//             remaining,
//             status,
//             updatedAt: serverTimestamp(),
//             createdAt: cur?.createdAt || serverTimestamp(),
//           },
//           { merge: true }
//         );
//       }

//       showToast("Synced payroll from timesheets", "success");
//       await loadWeekRows();
//     } catch (e) {
//       console.error(e);
//       showToast("Sync failed", "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   // -------- Payment actions --------
//   async function pay(uid, mode) {
//     try {
//       const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
//       const snap = await getDoc(ref);
//       if (!snap.exists()) return showToast("Row not found. Sync first.", "error");

//       const r = snap.data();
//       const totalAmount = Number(r.totalAmount || 0);
//       const paidTotal = Number(r.paidTotal || 0);
//       const remaining = Number(r.remaining || 0);

//       if (remaining <= 0) return showToast("No remaining balance", "error");

//       let addPay = 0;

//       if (mode === "full") {
//         addPay = remaining;
//       } else {
//         const raw = String(payInputs[uid] || "").trim();
//         const n = Number(raw);
//         if (!raw || Number.isNaN(n) || n <= 0) return showToast("Enter valid amount", "error");
//         addPay = Math.min(n, remaining);
//       }

//       const newPaid = round2(paidTotal + addPay);
//       const newRemaining = round2(Math.max(0, totalAmount - newPaid));
//       const status =
//         totalAmount === 0
//           ? "unpaid"
//           : newRemaining === 0
//           ? "paid"
//           : newPaid > 0
//           ? "partial"
//           : "unpaid";

//       await updateDoc(ref, {
//         paidTotal: newPaid,
//         remaining: newRemaining,
//         status,
//         lastPaymentAt: serverTimestamp(),
//         lastPaymentAmount: addPay,
//         updatedAt: serverTimestamp(),
//       });

//       // payment log (keeps history)
//       const logRef = doc(db, "payrollWeeks", weekStart, "staff", uid, "payments", `${Date.now()}`);
//       await setDoc(logRef, {
//         type: "payment",
//         uid,
//         weekStart,
//         amount: addPay,
//         createdAt: serverTimestamp(),
//         note: mode === "full" ? "Mark Paid" : "Pay Part",
//       });

//       setPayInputs((p) => ({ ...p, [uid]: "" }));
//       showToast("Payment saved", "success");
//       await loadWeekRows();
//     } catch (e) {
//       console.error(e);
//       showToast("Payment failed", "error");
//     }
//   }

//   // ✅ Reset: paidTotal back to 0 (unpaid again)
//   async function resetPaid(uid) {
//     try {
//       const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
//       const snap = await getDoc(ref);
//       if (!snap.exists()) return showToast("Row not found. Sync first.", "error");

//       const r = snap.data();
//       const totalAmount = round2(Number(r.totalAmount || 0));

//       await updateDoc(ref, {
//         paidTotal: 0,
//         remaining: totalAmount,
//         status: totalAmount === 0 ? "unpaid" : "unpaid",
//         lastResetAt: serverTimestamp(),
//         updatedAt: serverTimestamp(),
//       });

//       // log reset (keeps history)
//       const logRef = doc(db, "payrollWeeks", weekStart, "staff", uid, "payments", `${Date.now()}`);
//       await setDoc(logRef, {
//         type: "reset",
//         uid,
//         weekStart,
//         amount: 0,
//         createdAt: serverTimestamp(),
//         note: "Reset paid to 0 (unpaid again)",
//       });

//       setPayInputs((p) => ({ ...p, [uid]: "" }));
//       showToast("Reset done", "success");
//       await loadWeekRows();
//     } catch (e) {
//       console.error(e);
//       showToast("Reset failed", "error");
//     }
//   }

//   const totals = useMemo(() => {
//     const totalAmount = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
//     const paid = rows.reduce((s, r) => s + Number(r.paidTotal || 0), 0);
//     const remaining = rows.reduce((s, r) => s + Number(r.remaining || 0), 0);
//     return {
//       totalAmount: round2(totalAmount),
//       paid: round2(paid),
//       remaining: round2(remaining),
//     };
//   }, [rows]);

//   return (
//     <div className="mobile-app-wrapper">
//       <header className="app-header">
//         <div className="header-text">
//           <h1 className="main-title">Admin Payroll</h1>
//           <span className="subtitle">
//             Week {weekStart} → {weekEndInclusive} • Payday: {paydayYMD}
//           </span>
//         </div>

//         <button
//           className={`refresh-circle ${loading ? "spinning" : ""}`}
//           onClick={syncFromTimesheets}
//           disabled={loading}
//           title="Sync from timesheets"
//         >
//           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//             <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//           </svg>
//         </button>
//       </header>

//       <main className="scroll-content">
//         {/* Payday highlight */}
//         {isPaydayToday && (
//           <section className="stats-bar">
//             <div className="stat-item">
//               <label>Payday</label>
//               <div className="value brand">Today</div>
//             </div>
//             <div className="stat-divider" />
//             <div className="stat-item">
//               <label>Reminder</label>
//               <div className="value">Pay staff balances</div>
//             </div>
//           </section>
//         )}

//         {/* Week picker */}
//         <section className="payroll-filters-container">
//           <div className="filters-grid">
//             <div className="filter-field">
//               <label>Week Start (Mon)</label>
//               <input
//                 type="date"
//                 value={weekStart}
//                 onChange={(e) => setWeekStart(e.target.value)}
//                 disabled={loading}
//               />
//             </div>

//             <div className="filter-field">
//               <label>Week End</label>
//               <input type="date" value={weekEndInclusive} disabled />
//             </div>

//             <div className="filter-field">
//               <label>Payday</label>
//               <input type="date" value={paydayYMD} disabled />
//             </div>

//             <div className="filter-field">
//               <label>Actions</label>
//               <button className="tab-item active" onClick={syncFromTimesheets} disabled={loading}>
//                 Sync from Timesheets
//               </button>
//             </div>
//           </div>
//         </section>

//         {/* Totals */}
//         <section className="stats-bar mid ">
//           <div className="stat-item mid">
//             <label>Total</label>
//             <div className="value">{money(totals.totalAmount)}</div>
//           </div>
//           <div className="stat-divider" />
//           <div className="stat-item mid">
//             <label>Paid</label>
//             <div className="value paid-balance">{money(totals.paid)}</div>
//           </div>
//           <div className="stat-divider" />
//           <div className="stat-item mid">
//             <label>Remaining</label>
//             <div className="value remain-balance">{money(totals.remaining)}</div>
//           </div>
//         </section>

//         {/* List */}
//         <div className="payroll-list timeline">
//           {loading ? (
//             <div className="loader-inline">
//               <div className="spinner"></div>
//               <span>Loading payroll...</span>
//             </div>
//           ) : rows.length === 0 ? (
//             <div className="empty-state-container">
//               <p>No payroll rows yet. Click Sync.</p>
//             </div>
//           ) : (
//             rows.map((r) => {
//               const remaining = Number(r.remaining || 0);
//               const status = String(r.status || "unpaid");

//               const all = allWeeksByUid[r.uid] || null;
//               const allRemaining = all ? Number(all.remaining || 0) : null;

//               return (
//                 <div key={r.uid} className="payroll-card">
//                   <div className="payroll-card-main">
//                     <div className="staff-header">
//                       {/* clickable to history */}
//                       <span
//                         className="staff-name"
//                         style={{ cursor: "pointer" }}
//                         onClick={() => (window.location.href = `/admin/payroll/${weekStart}/${r.uid}`)}
//                         title="Open history"
//                       >
//                         {r.staffName || r.uid}
//                       </span>

//                       {/* ✅ Right side: ALL-WEEKS remaining (requested) */}
//                       <span className="shift-tag" title="All weeks remaining">
//                         {allRemaining == null ? "ALL: —" : `ALL: ${money(allRemaining)}`}
//                       </span>
//                     </div>

//                     <div className="payroll-details">
//                       <div className="pay-col">
//                         <label>Status</label>
//                         <span>{status.toUpperCase()}</span>
//                       </div>
//                       <div className="pay-col">
//                         <label>Hours</label>
//                         <span>{Number(r.totalHours || 0).toFixed(2)}h</span>
//                       </div>
//                       <div className="pay-col">
//                         <label>Total</label>
//                         <span>{money(r.totalAmount)}</span>
//                       </div>
//                       <div className="pay-col">
//                         <label>Paid</label>
//                         <span>{money(r.paidTotal)}</span>
//                       </div>
//                       <div className="pay-col total">
//                         <label>Remaining</label>
//                         <span className="brand">{money(r.remaining)}</span>
//                       </div>
//                     </div>

//                     {/* Payment controls */}
//                     <div className="payroll-details" style={{ marginTop: 10 }}>
//                       <div className="pay-col">
//                         <label>Partial Pay</label>
//                         <input
//                           value={payInputs[r.uid] || ""}
//                           onChange={(e) =>
//                             setPayInputs((p) => ({ ...p, [r.uid]: e.target.value }))
//                           }
//                           placeholder="e.g. 100"
//                           disabled={remaining <= 0}
//                         />
//                       </div>

//                       <div className="pay-col">
//                         <label>Action</label>
//                         <button
//                           className={`tab-item ${remaining <= 0 ? "" : "active"}`}
//                           onClick={() => pay(r.uid, "partial")}
//                           disabled={remaining <= 0}
//                         >
//                           Pay Part
//                         </button>
//                       </div>

//                       <div className="pay-col">
//                         <label>Action</label>
//                         <button
//                           className={`tab-item ${remaining <= 0 ? "" : "active"}`}
//                           onClick={() => pay(r.uid, "full")}
//                           disabled={remaining <= 0}
//                         >
//                           Mark Paid
//                         </button>
//                       </div>

//                       {/* ✅ Reset Paid (set paid back to 0) */}
//                       <div className="pay-col total">
//                         <label>Action</label>
//                         <button
//                           className={`tab-item ${Number(r.paidTotal || 0) > 0 ? "active" : ""}`}
//                           onClick={() => resetPaid(r.uid)}
//                           disabled={Number(r.paidTotal || 0) <= 0}
//                           title="Set paidTotal back to 0"
//                         >
//                           Reset Paid
//                         </button>
//                       </div>
//                     </div>
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


















// src/pages/admin/AdminPayroll.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  documentId,
  runTransaction,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import "./Payroll.css";

// ---------------- Helpers ----------------
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const money = (n) =>
  Number(n || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

const hmToMinutes = (hm) => {
  if (!hm) return null;
  const [h, m] = String(hm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
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

  // If break missing, treat break as 0 ✅
  if (bs != null && be != null) {
    let br = be - bs;
    if (br < 0) br += 1440;
    worked -= br;
  }
  return Math.max(0, worked);
};

const minutesToHours = (min) => Math.round((Number(min || 0) / 60) * 100) / 100;

// Week Mon–Sun, Payday = next Thursday after that week.
// If weekStart is Monday: payday = weekStart + 10 days.
function getPaydayForWeekStart(weekStartYMD) {
  const d = new Date(weekStartYMD + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const payday = addDays(d, 10);
  return toYMD(payday);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function AdminPayroll() {
  const { showToast } = useToast();

  // ✅ IMPORTANT: keep this ALWAYS YYYY-MM-DD for <input type="date" />
  const [weekStart, setWeekStart] = useState(() =>
    toYMD(getWeekStartMonday(new Date()))
  );

  const weekStartObj = useMemo(() => {
    if (!isYMD(weekStart)) return null;
    const d = new Date(weekStart + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }, [weekStart]);

  const weekEndExclusive = useMemo(() => {
    if (!weekStartObj) return "";
    return toYMD(addDays(weekStartObj, 7));
  }, [weekStartObj]);

  const weekEndInclusive = useMemo(() => {
    if (!weekStartObj) return "";
    return toYMD(addDays(weekStartObj, 6));
  }, [weekStartObj]);

  const paydayYMD = useMemo(() => {
    if (!isYMD(weekStart)) return "";
    return getPaydayForWeekStart(weekStart);
  }, [weekStart]);

  const todayYMD = useMemo(() => toYMD(new Date()), []);
  const isPaydayToday = Boolean(paydayYMD) && todayYMD === paydayYMD;

  const [loading, setLoading] = useState(true);

  // staff: {uid, name, hourlyRate}
  const [staffList, setStaffList] = useState([]);

  // payroll rows: {uid, staffName, totalHours, totalAmount, paidTotal, remaining, status}
  const [rows, setRows] = useState([]);

  // input for partial payments
  const [payInputs, setPayInputs] = useState({}); // uid -> "100"

  // ✅ lifetime totals (from payrollTotals/{uid})
  const [allTotalsByUid, setAllTotalsByUid] = useState({}); // uid -> { totalAmount, paidTotal, remaining, totalHours }

  // -------- Load staff list (approved staff + hourlyRate) --------
  const loadStaff = useCallback(async () => {
    try {
      const qs = query(
        collection(db, "users"),
        where("role", "==", "staff"),
        where("status", "==", "approved")
      );
      const snap = await getDocs(qs);

      const list = snap.docs
        .map((d) => ({
          uid: d.id,
          name:
            `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() ||
            d.data().email ||
            d.id,
          hourlyRate: Number(d.data().hourlyRate || 0),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setStaffList(list);
    } catch (e) {
      console.error(e);
      showToast("Failed to load staff", "error");
    }
  }, [showToast]);

  // -------- Load payroll summary from payrollWeeks/{weekStart}/staff --------
  const loadWeekRows = useCallback(async () => {
    if (!isYMD(weekStart)) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // ✅ Correct Firestore path: payrollWeeks/{weekStart}/staff
      const snap = await getDocs(collection(db, "payrollWeeks", weekStart, "staff"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // init pay input boxes once per uid
      setPayInputs((prev) => {
        const next = { ...prev };
        list.forEach((r) => {
          if (r?.uid && next[r.uid] == null) next[r.uid] = "";
        });
        return next;
      });

      list.sort(
        (a, b) =>
          Number(b.remaining || 0) - Number(a.remaining || 0) ||
          String(a.staffName || "").localeCompare(String(b.staffName || ""))
      );

      setRows(list);
    } catch (e) {
      console.error(e);
      showToast("Failed to load payroll week", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart, showToast]);

  // ✅ Load lifetime totals for current rows from payrollTotals/{uid}
  const loadLifetimeTotals = useCallback(async (uids) => {
    if (!uids || uids.length === 0) return;

    try {
      const out = {};
      const batches = chunk(uids, 10); // documentId IN max 10

      for (const part of batches) {
        const qTotals = query(
          collection(db, "payrollTotals"),
          where(documentId(), "in", part)
        );
        const snap = await getDocs(qTotals);

        snap.docs.forEach((d) => {
          const data = d.data() || {};
          out[d.id] = {
            totalAmount: round2(Number(data.totalAmount || 0)),
            paidTotal: round2(Number(data.paidTotal || 0)),
            remaining: round2(Number(data.remaining || 0)),
            totalHours: round2(Number(data.totalHours || 0)),
          };
        });

        // default if doc doesn't exist yet
        part.forEach((uid) => {
          if (!out[uid]) out[uid] = { totalAmount: 0, paidTotal: 0, remaining: 0, totalHours: 0 };
        });
      }

      setAllTotalsByUid((prev) => ({ ...prev, ...out }));
    } catch (e) {
      console.error("loadLifetimeTotals failed:", e);
    }
  }, []);

  // -------- Effects (kept stable to avoid max update depth) --------
  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // ✅ Only reload week rows when weekStart changes
  useEffect(() => {
    loadWeekRows();
  }, [loadWeekRows]);

  // ✅ Only reload lifetime totals when the set of UIDs changes
  const uidsKey = useMemo(() => {
    const uids = rows.map((r) => r.uid).filter(Boolean).sort();
    return uids.join("|");
  }, [rows]);

  useEffect(() => {
    if (!uidsKey) return;
    const uids = uidsKey.split("|").filter(Boolean);
    loadLifetimeTotals(uids);
  }, [uidsKey, loadLifetimeTotals]);

  // -------- PayrollTotals maintenance (idempotent per week) --------
  async function upsertTotalsForWeek({ uid, staffName, weekStartYMD, weekTotalHours, weekTotalAmount }) {
    const totalsRef = doc(db, "payrollTotals", uid);
    const weekRef = doc(db, "payrollTotals", uid, "weeks", weekStartYMD);

    await runTransaction(db, async (tx) => {
      const totalsSnap = await tx.get(totalsRef);
      const weekSnap = await tx.get(weekRef);

      const totals = totalsSnap.exists() ? totalsSnap.data() : {};
      const oldWeek = weekSnap.exists() ? weekSnap.data() : {};

      const oldWeekHours = Number(oldWeek.totalHours || 0);
      const oldWeekAmount = Number(oldWeek.totalAmount || 0);

      const deltaHours = round2(Number(weekTotalHours || 0) - oldWeekHours);
      const deltaAmount = round2(Number(weekTotalAmount || 0) - oldWeekAmount);

      const prevTotalHours = Number(totals.totalHours || 0);
      const prevTotalAmount = Number(totals.totalAmount || 0);
      const prevPaidTotal = Number(totals.paidTotal || 0);

      const newTotalHours = round2(prevTotalHours + deltaHours);
      const newTotalAmount = round2(prevTotalAmount + deltaAmount);
      const newRemaining = round2(Math.max(0, newTotalAmount - prevPaidTotal));

      tx.set(
        weekRef,
        {
          uid,
          staffName: staffName || oldWeek.staffName || uid,
          weekStart: weekStartYMD,
          totalHours: round2(weekTotalHours),
          totalAmount: round2(weekTotalAmount),
          updatedAt: serverTimestamp(),
          createdAt: oldWeek.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        totalsRef,
        {
          uid,
          staffName: staffName || totals.staffName || uid,
          totalHours: newTotalHours,
          totalAmount: newTotalAmount,
          paidTotal: round2(prevPaidTotal),
          remaining: newRemaining,
          updatedAt: serverTimestamp(),
          createdAt: totals.createdAt || serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  async function applyPaymentToTotals({ uid, staffName, weekStartYMD, addPay, newWeekPaidTotal }) {
    const totalsRef = doc(db, "payrollTotals", uid);
    const weekRef = doc(db, "payrollTotals", uid, "weeks", weekStartYMD);

    await runTransaction(db, async (tx) => {
      const totalsSnap = await tx.get(totalsRef);
      const weekSnap = await tx.get(weekRef);

      const totals = totalsSnap.exists() ? totalsSnap.data() : {};
      const week = weekSnap.exists() ? weekSnap.data() : {};

      const totalAmount = Number(totals.totalAmount || 0);
      const prevPaid = Number(totals.paidTotal || 0);

      const nextPaid = round2(prevPaid + Number(addPay || 0));
      const nextRemaining = round2(Math.max(0, totalAmount - nextPaid));

      tx.set(
        totalsRef,
        {
          uid,
          staffName: staffName || totals.staffName || uid,
          paidTotal: nextPaid,
          remaining: nextRemaining,
          updatedAt: serverTimestamp(),
          createdAt: totals.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        weekRef,
        {
          uid,
          staffName: staffName || week.staffName || uid,
          weekStart: weekStartYMD,
          paidTotal: round2(newWeekPaidTotal),
          updatedAt: serverTimestamp(),
          createdAt: week.createdAt || serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  async function resetWeekPaidInTotals({ uid, staffName, weekStartYMD, oldWeekPaid }) {
    const totalsRef = doc(db, "payrollTotals", uid);
    const weekRef = doc(db, "payrollTotals", uid, "weeks", weekStartYMD);

    await runTransaction(db, async (tx) => {
      const totalsSnap = await tx.get(totalsRef);
      const weekSnap = await tx.get(weekRef);

      const totals = totalsSnap.exists() ? totalsSnap.data() : {};
      const week = weekSnap.exists() ? weekSnap.data() : {};

      const totalAmount = Number(totals.totalAmount || 0);
      const prevPaid = Number(totals.paidTotal || 0);

      const nextPaid = round2(Math.max(0, prevPaid - Number(oldWeekPaid || 0)));
      const nextRemaining = round2(Math.max(0, totalAmount - nextPaid));

      tx.set(
        totalsRef,
        {
          uid,
          staffName: staffName || totals.staffName || uid,
          paidTotal: nextPaid,
          remaining: nextRemaining,
          updatedAt: serverTimestamp(),
          createdAt: totals.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        weekRef,
        {
          uid,
          staffName: staffName || week.staffName || uid,
          weekStart: weekStartYMD,
          paidTotal: 0,
          updatedAt: serverTimestamp(),
          createdAt: week.createdAt || serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  // -------- Sync from timesheets (Mon–Sun) into payrollDays + payrollWeeks + payrollTotals --------
  async function syncFromTimesheets() {
    if (!isYMD(weekStart) || !weekStartObj || !isYMD(weekEndExclusive)) {
      showToast("Invalid week start date", "error");
      return;
    }

    setLoading(true);
    try {
      if (!staffList.length) {
        await loadStaff();
      }

      // Create parent week doc
      await setDoc(
        doc(db, "payrollWeeks", weekStart),
        { weekStart, weekEnd: weekEndInclusive, payday: paydayYMD, updatedAt: serverTimestamp() },
        { merge: true }
      );

      const rateByUid = {};
      const nameByUid = {};
      staffList.forEach((s) => {
        rateByUid[s.uid] = Number(s.hourlyRate || 0);
        nameByUid[s.uid] = s.name;
      });

      const qTs = query(
        collection(db, "timesheets"),
        where("date", ">=", weekStart),
        where("date", "<", weekEndExclusive)
      );
      const snap = await getDocs(qTs);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const agg = {}; // uid -> {hours, amount}

      for (const ts of list) {
        const uid = ts.uid;
        if (!uid) continue;

        const mins = calcWorkedMinutes(ts);
        const workedHours = minutesToHours(mins);

        const rate = Number(rateByUid[uid] || ts.hourlyRate || 0);
        const amount = round2(workedHours * rate);

        // payrollDays/{date}/entries/{uid}
        const dayRef = doc(db, "payrollDays", ts.date, "entries", uid);
        await setDoc(
          dayRef,
          {
            uid,
            staffName: nameByUid[uid] || ts.staffName || "Unknown",
            date: ts.date,
            storeId: ts.storeId || "unknown",
            hours: workedHours,
            rate,
            amount,
            source: "timesheet",
            note: "",
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (!agg[uid]) agg[uid] = { hours: 0, amount: 0 };
        agg[uid].hours = round2(agg[uid].hours + workedHours);
        agg[uid].amount = round2(agg[uid].amount + amount);
      }

      for (const uid of Object.keys(agg)) {
        // payrollWeeks/{weekStart}/staff/{uid}
        const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
        const curSnap = await getDoc(ref);
        const cur = curSnap.exists() ? curSnap.data() : null;

        const totalHours = round2(agg[uid].hours);
        const totalAmount = round2(agg[uid].amount);

        const paidTotal = round2(Number(cur?.paidTotal || 0));
        const remaining = round2(Math.max(0, totalAmount - paidTotal));

        const status =
          totalAmount === 0
            ? "unpaid"
            : remaining === 0
            ? "paid"
            : paidTotal > 0
            ? "partial"
            : "unpaid";

        const staffName = cur?.staffName || nameByUid[uid] || uid;

        await setDoc(
          ref,
          {
            uid,
            staffName,
            weekStart,
            weekEnd: weekEndInclusive,
            payday: paydayYMD,
            totalHours,
            totalAmount,
            paidTotal,
            remaining,
            status,
            updatedAt: serverTimestamp(),
            createdAt: cur?.createdAt || serverTimestamp(),
          },
          { merge: true }
        );

        // update lifetime totals (idempotent)
        await upsertTotalsForWeek({
          uid,
          staffName,
          weekStartYMD: weekStart,
          weekTotalHours: totalHours,
          weekTotalAmount: totalAmount,
        });
      }

      showToast("Synced payroll from timesheets", "success");
      await loadWeekRows();
    } catch (e) {
      console.error(e);
      showToast("Sync failed", "error");
    } finally {
      setLoading(false);
    }
  }

  // -------- Payment actions --------
  async function pay(uid, mode) {
    try {
      const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return showToast("Row not found. Sync first.", "error");

      const r = snap.data();
      const staffName = r.staffName || uid;

      const totalAmount = Number(r.totalAmount || 0);
      const paidTotal = Number(r.paidTotal || 0);
      const remaining = Number(r.remaining || 0);

      if (remaining <= 0) return showToast("No remaining balance", "error");

      let addPay = 0;

      if (mode === "full") {
        addPay = remaining;
      } else {
        const raw = String(payInputs[uid] || "").trim();
        const n = Number(raw);
        if (!raw || Number.isNaN(n) || n <= 0) return showToast("Enter valid amount", "error");
        addPay = Math.min(n, remaining);
      }

      const newPaid = round2(paidTotal + addPay);
      const newRemaining = round2(Math.max(0, totalAmount - newPaid));
      const status =
        totalAmount === 0
          ? "unpaid"
          : newRemaining === 0
          ? "paid"
          : newPaid > 0
          ? "partial"
          : "unpaid";

      await updateDoc(ref, {
        paidTotal: newPaid,
        remaining: newRemaining,
        status,
        lastPaymentAt: serverTimestamp(),
        lastPaymentAmount: addPay,
        updatedAt: serverTimestamp(),
      });

      const logRef = doc(
        db,
        "payrollWeeks",
        weekStart,
        "staff",
        uid,
        "payments",
        `${Date.now()}`
      );
      await setDoc(logRef, {
        type: "payment",
        uid,
        weekStart,
        amount: addPay,
        createdAt: serverTimestamp(),
        note: mode === "full" ? "Mark Paid" : "Pay Part",
      });

      // update lifetime totals
      await applyPaymentToTotals({
        uid,
        staffName,
        weekStartYMD: weekStart,
        addPay,
        newWeekPaidTotal: newPaid,
      });

      setPayInputs((p) => ({ ...p, [uid]: "" }));
      showToast("Payment saved", "success");
      await loadWeekRows();
    } catch (e) {
      console.error(e);
      showToast("Payment failed", "error");
    }
  }

  async function resetPaid(uid) {
    try {
      const ref = doc(db, "payrollWeeks", weekStart, "staff", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return showToast("Row not found. Sync first.", "error");

      const r = snap.data();
      const staffName = r.staffName || uid;

      const totalAmount = round2(Number(r.totalAmount || 0));
      const oldPaid = round2(Number(r.paidTotal || 0));

      if (oldPaid <= 0) return showToast("Nothing to reset", "error");

      await updateDoc(ref, {
        paidTotal: 0,
        remaining: totalAmount,
        status: totalAmount === 0 ? "unpaid" : "unpaid",
        lastResetAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const logRef = doc(
        db,
        "payrollWeeks",
        weekStart,
        "staff",
        uid,
        "payments",
        `${Date.now()}`
      );
      await setDoc(logRef, {
        type: "reset",
        uid,
        weekStart,
        amount: 0,
        createdAt: serverTimestamp(),
        note: "Reset paid to 0 (unpaid again)",
      });

      // update lifetime totals (subtract old paid from lifetime)
      await resetWeekPaidInTotals({
        uid,
        staffName,
        weekStartYMD: weekStart,
        oldWeekPaid: oldPaid,
      });

      setPayInputs((p) => ({ ...p, [uid]: "" }));
      showToast("Reset done", "success");
      await loadWeekRows();
    } catch (e) {
      console.error(e);
      showToast("Reset failed", "error");
    }
  }

  const totals = useMemo(() => {
    const totalAmount = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
    const paid = rows.reduce((s, r) => s + Number(r.paidTotal || 0), 0);
    const remaining = rows.reduce((s, r) => s + Number(r.remaining || 0), 0);
    return {
      totalAmount: round2(totalAmount),
      paid: round2(paid),
      remaining: round2(remaining),
    };
  }, [rows]);

  return (
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Admin Payroll</h1>
          <span className="subtitle">
            Week {weekStart} → {weekEndInclusive} • Payday: {paydayYMD}
          </span>
        </div>

        <button
          className={`refresh-circle ${loading ? "spinning" : ""}`}
          onClick={syncFromTimesheets}
          disabled={loading}
          title="Sync from timesheets"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </header>

      <main className="scroll-content">
        {isPaydayToday && (
          <section className="stats-bar">
            <div className="stat-item">
              <label>Payday</label>
              <div className="value brand">Today</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <label>Reminder</label>
              <div className="value">Pay staff balances</div>
            </div>
          </section>
        )}

        <section className="payroll-filters-container">
          <div className="filters-grid">
            <div className="filter-field">
              <label>Week Start (Mon)</label>
              <input
                type="date"
                value={isYMD(weekStart) ? weekStart : ""}
                onChange={(e) => {
                  const v = e.target.value; // ✅ already YYYY-MM-DD
                  if (!v) return;
                  setWeekStart(v);
                }}
                disabled={loading}
              />
            </div>

            <div className="filter-field">
              <label>Week End</label>
              <input type="date" value={weekEndInclusive || ""} disabled />
            </div>

            <div className="filter-field">
              <label>Payday</label>
              <input type="date" value={paydayYMD || ""} disabled />
            </div>

            <div className="filter-field">
              <label>Actions</label>
              <button className="tab-item active" onClick={syncFromTimesheets} disabled={loading}>
                Sync from Timesheets
              </button>
            </div>
          </div>
        </section>

        <section className="stats-bar mid">
          <div className="stat-item mid">
            <label>Total</label>
            <div className="value">{money(totals.totalAmount)}</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item mid">
            <label>Paid</label>
            <div className="value paid-balance">{money(totals.paid)}</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item mid">
            <label>Remaining</label>
            <div className="value remain-balance">{money(totals.remaining)}</div>
          </div>
        </section>

        <div className="payroll-list timeline">
          {loading ? (
            <div className="loader-inline">
              <div className="spinner"></div>
              <span>Loading payroll...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state-container">
              <p>No payroll rows yet. Click Sync.</p>
            </div>
          ) : (
            rows.map((r) => {
              const remaining = Number(r.remaining || 0);
              const status = String(r.status || "unpaid");

              const all = allTotalsByUid[r.uid] || null;
              const allRemaining = all ? Number(all.remaining || 0) : null;

              return (
                <div key={r.uid} className="payroll-card">
                  <div className="payroll-card-main">
                    <div className="staff-header">
                      <span
                        className="staff-name"
                        style={{ cursor: "pointer" }}
                        onClick={() => (window.location.href = `/admin/payroll/${weekStart}/${r.uid}`)}
                        title="Open history"
                      >
                        {r.staffName || r.uid}
                      </span>

                      <span className="shift-tag" title="All-time remaining">
                        {allRemaining == null ? "ALL: —" : `ALL: ${money(allRemaining)}`}
                      </span>
                    </div>

                    <div className="payroll-details">
                      <div className="pay-col">
                        <label>Status</label>
                        <span>{status.toUpperCase()}</span>
                      </div>
                      <div className="pay-col">
                        <label>Hours</label>
                        <span>{Number(r.totalHours || 0).toFixed(2)}h</span>
                      </div>
                      <div className="pay-col">
                        <label>Total</label>
                        <span>{money(r.totalAmount)}</span>
                      </div>
                      <div className="pay-col">
                        <label>Paid</label>
                        <span>{money(r.paidTotal)}</span>
                      </div>
                      <div className="pay-col total">
                        <label>Remaining</label>
                        <span className="brand">{money(r.remaining)}</span>
                      </div>
                    </div>

                    <div className="payroll-details" style={{ marginTop: 10 }}>
                      <div className="pay-col">
                        <label>Partial Pay</label>
                        <input
                          value={payInputs[r.uid] || ""}
                          onChange={(e) =>
                            setPayInputs((p) => ({ ...p, [r.uid]: e.target.value }))
                          }
                          placeholder="e.g. 100"
                          disabled={remaining <= 0}
                        />
                      </div>

                      <div className="pay-col">
                        <label>Action</label>
                        <button
                          className={`tab-item ${remaining <= 0 ? "" : "active"}`}
                          onClick={() => pay(r.uid, "partial")}
                          disabled={remaining <= 0}
                        >
                          Pay Part
                        </button>
                      </div>

                      <div className="pay-col">
                        <label>Action</label>
                        <button
                          className={`tab-item ${remaining <= 0 ? "" : "active"}`}
                          onClick={() => pay(r.uid, "full")}
                          disabled={remaining <= 0}
                        >
                          Mark Paid
                        </button>
                      </div>

                      <div className="pay-col total">
                        <label>Action</label>
                        <button
                          className={`tab-item ${Number(r.paidTotal || 0) > 0 ? "active" : ""}`}
                          onClick={() => resetPaid(r.uid)}
                          disabled={Number(r.paidTotal || 0) <= 0}
                          title="Set paidTotal back to 0"
                        >
                          Reset Paid
                        </button>
                      </div>
                    </div>

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
