// import { useEffect, useMemo, useState } from "react";
// import {
//   collection,
//   getDocs,
//   query,
//   where,
//   documentId,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
// import "./Payroll.css";

// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function hmToMinutes(hm) {
//   if (!hm) return null;
//   const [h, m] = hm.split(":").map(Number);
//   if (Number.isNaN(h) || Number.isNaN(m)) return null;
//   return h * 60 + m;
// }

// function calcWorkedMinutes(ts) {
//   const start = hmToMinutes(ts.startInput);
//   const end = hmToMinutes(ts.endInput);
//   if (start == null || end == null) return 0;

//   let worked = end - start;
//   if (worked < 0) worked += 24 * 60; // overnight safety

//   const bs = hmToMinutes(ts.breakStartInput);
//   const be = hmToMinutes(ts.breakEndInput);
//   if (bs != null && be != null) {
//     let br = be - bs;
//     if (br < 0) br += 24 * 60;
//     worked -= br;
//   }

//   return Math.max(0, worked);
// }

// function money(n) {
//   const v = Number(n || 0);
//   return v.toLocaleString(undefined, { style: "currency", currency: "AUD" });
// }

// function hours(nMinutes) {
//   return Math.round((nMinutes / 60) * 100) / 100;
// }

// function uniq(arr) {
//   return Array.from(new Set(arr));
// }

// function chunk(arr, size) {
//   const out = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }

// export default function Payroll() {
//   // Filters
//   const [rangePreset, setRangePreset] = useState("week"); // day | week | month | year | custom
//   const [dateFrom, setDateFrom] = useState(toYMD(getWeekStartMonday(new Date())));
//   const [dateTo, setDateTo] = useState(toYMD(addDays(getWeekStartMonday(new Date()), 7))); // exclusive
//   const [storeId, setStoreId] = useState("all");
//   const [employeeUid, setEmployeeUid] = useState("all");

//   // Data
//   const [loading, setLoading] = useState(true);
//   const [staffList, setStaffList] = useState([]); // approved staff
//   const [ratesByUid, setRatesByUid] = useState({}); // {uid: {name, hourlyRate}}
//   const [timesheets, setTimesheets] = useState([]);

//   useEffect(() => {
//     loadStaffDropdown();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     applyPreset(rangePreset);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [rangePreset]);

//   useEffect(() => {
//     loadPayroll();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [dateFrom, dateTo, storeId, employeeUid]);

//   async function loadStaffDropdown() {
//     // staff list for filter dropdown
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
//         email: d.data().email || "",
//       }))
//       .sort((a, b) => a.name.localeCompare(b.name));

//     setStaffList(list);

//     const map = {};
//     list.forEach((s) => {
//       map[s.uid] = { name: s.name, hourlyRate: s.hourlyRate };
//     });
//     setRatesByUid(map);
//   }

//   function applyPreset(preset) {
//     const now = new Date();

//     if (preset === "day") {
//       const ymd = toYMD(now);
//       setDateFrom(ymd);
//       setDateTo(toYMD(addDays(now, 1)));
//     }

//     if (preset === "week") {
//       const ws = getWeekStartMonday(now);
//       setDateFrom(toYMD(ws));
//       setDateTo(toYMD(addDays(ws, 7)));
//     }

//     if (preset === "month") {
//       const start = new Date(now.getFullYear(), now.getMonth(), 1);
//       const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
//       setDateFrom(toYMD(start));
//       setDateTo(toYMD(end));
//     }

//     if (preset === "year") {
//       const start = new Date(now.getFullYear(), 0, 1);
//       const end = new Date(now.getFullYear() + 1, 0, 1);
//       setDateFrom(toYMD(start));
//       setDateTo(toYMD(end));
//     }
//   }

//   async function ensureRatesForUids(uids) {
//     const uniqueUids = uniq(uids).filter(Boolean);
//     const missing = uniqueUids.filter((u) => !ratesByUid[u]);

//     if (missing.length === 0) return ratesByUid;

//     // Firestore "in" query limit is 10 values
//     const chunks = chunk(missing, 10);
//     const map = { ...ratesByUid };

//     for (const c of chunks) {
//       const qUsers = query(collection(db, "users"), where(documentId(), "in", c));
//       const snap = await getDocs(qUsers);
//       snap.docs.forEach((d) => {
//         const data = d.data();
//         map[d.id] = {
//           name:
//             `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
//             data.email ||
//             d.id,
//           hourlyRate: Number(data.hourlyRate || 0),
//         };
//       });
//     }

//     setRatesByUid(map);
//     return map;
//   }

//   async function loadPayroll() {
//     setLoading(true);

//     // timesheets query by date range
//     let qTs = query(
//       collection(db, "timesheets"),
//       where("date", ">=", dateFrom),
//       where("date", "<", dateTo)
//     );

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

//     if (storeId !== "all") {
//       list = list.filter((x) => x.storeId === storeId);
//     }

//     // ensure we have rates loaded for any uids that appear
//     const uidList = list.map((x) => x.uid);
//     const rateMap = await ensureRatesForUids(uidList);

//     // compute derived fields
//     list = list
//       .map((ts) => {
//         const mins = calcWorkedMinutes(ts);
//         const rate = Number(rateMap[ts.uid]?.hourlyRate || 0);
//         const amount = hours(mins) * rate;

//         return {
//           ...ts,
//           workedMinutes: mins,
//           workedHours: hours(mins),
//           hourlyRate: rate,
//           amount,
//           staffName:
//             rateMap[ts.uid]?.name ||
//             ts.staffName ||
//             ts.uid ||
//             "Unknown",
//         };
//       })
//       .sort((a, b) => (a.date + a.staffName).localeCompare(b.date + b.staffName));

//     setTimesheets(list);
//     setLoading(false);
//   }

//   // Totals
//   const totals = useMemo(() => {
//     const totalMinutes = timesheets.reduce((sum, x) => sum + (x.workedMinutes || 0), 0);
//     const totalAmount = timesheets.reduce((sum, x) => sum + (x.amount || 0), 0);

//     // per staff
//     const byStaff = {};
//     timesheets.forEach((x) => {
//       const key = x.uid || "unknown";
//       if (!byStaff[key]) {
//         byStaff[key] = {
//           uid: key,
//           staffName: x.staffName || key,
//           hours: 0,
//           amount: 0,
//         };
//       }
//       byStaff[key].hours += x.workedHours || 0;
//       byStaff[key].amount += x.amount || 0;
//     });

//     const staffRows = Object.values(byStaff).sort((a, b) => b.amount - a.amount);

//     return {
//       totalMinutes,
//       totalHours: hours(totalMinutes),
//       totalAmount,
//       staffRows,
//     };
//   }, [timesheets]);

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="top">
//           <div>
//             <h1 className="h1">Payroll</h1>
//             <p className="p">
//               Pay is calculated from <b>input times</b>. Filters change totals instantly.
//             </p>
//           </div>

//           <button className="btn" onClick={loadPayroll}>
//             Refresh
//           </button>
//         </div>

//         <div className="spacer" />

//         <div className="filters">
//           <div className="seg">
//             {["day", "week", "month", "year", "custom"].map((p) => (
//               <button
//                 key={p}
//                 className={`segBtn ${rangePreset === p ? "segActive" : ""}`}
//                 onClick={() => setRangePreset(p)}
//               >
//                 {p.toUpperCase()}
//               </button>
//             ))}
//           </div>

//           <div className="filterGrid">
//             <div className="field">
//               <div className="label">From</div>
//               <input
//                 className="input"
//                 type="date"
//                 value={dateFrom}
//                 onChange={(e) => {
//                   setRangePreset("custom");
//                   setDateFrom(e.target.value);
//                 }}
//               />
//             </div>

//             <div className="field">
//               <div className="label">To (exclusive)</div>
//               <input
//                 className="input"
//                 type="date"
//                 value={dateTo}
//                 onChange={(e) => {
//                   setRangePreset("custom");
//                   setDateTo(e.target.value);
//                 }}
//               />
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
//           </div>
//         </div>

//         <div className="spacer" />

//         <div className="totals">
//           <div className="totCard">
//             <div className="totLabel">Total hours</div>
//             <div className="totValue">{totals.totalHours} h</div>
//           </div>
//           <div className="totCard">
//             <div className="totLabel">Total salary</div>
//             <div className="totValue">{money(totals.totalAmount)}</div>
//           </div>
//         </div>

//         <div className="spacer" />

//         <div className="split">
//           <div className="panel">
//             <div className="panelTitle">By employee</div>
//             {totals.staffRows.length === 0 ? (
//               <div className="empty">No data</div>
//             ) : (
//               <div className="list">
//                 {totals.staffRows.map((r) => (
//                   <div key={r.uid} className="rowItem">
//                     <div>
//                       <div className="name">{r.staffName}</div>
//                       <div className="sub">{r.hours.toFixed(2)} h</div>
//                     </div>
//                     <div className="amt">{money(r.amount)}</div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           <div className="panel">
//             <div className="panelTitle">Timesheets</div>
//             {loading ? (
//               <div className="empty">Loading…</div>
//             ) : timesheets.length === 0 ? (
//               <div className="empty">No timesheets for this filter.</div>
//             ) : (
//               <div className="table">
//                 <div className="thead">
//                   <div>Date</div>
//                   <div>Staff</div>
//                   <div>Store</div>
//                   <div>Hours</div>
//                   <div>Rate</div>
//                   <div>Amount</div>
//                 </div>

//                 {timesheets.map((t) => (
//                   <div key={t.id} className="trow">
//                     <div>{t.date}</div>
//                     <div className="strong">{t.staffName}</div>
//                     <div>{storeLabel(t.storeId)}</div>
//                     <div>{(t.workedHours || 0).toFixed(2)}</div>
//                     <div>{money(t.hourlyRate).replace("A$", "$")}/h</div>
//                     <div className="strong">{money(t.amount)}</div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="spacer" />
//         <div className="hint">
//           Tip: “To (exclusive)” means if you want to include Sunday, set To = next Monday.
//         </div>
//       </div>
//     </div>
//   );
// }



















import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { STORES } from "../../utils/constants";
import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext"; // Import Toast
import "./Payroll.css";

// --- Helpers ---
const storeLabel = (storeId) => STORES.find((s) => s.id === storeId)?.label || storeId || "-";
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

const money = (n) => Number(n || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
const hours = (nMinutes) => Math.round((nMinutes / 60) * 100) / 100;
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export default function Payroll() {
  const { showToast } = useToast();

  // Filters
  const [rangePreset, setRangePreset] = useState("week");
  const [dateFrom, setDateFrom] = useState(toYMD(getWeekStartMonday(new Date())));
  const [dateTo, setDateTo] = useState(toYMD(addDays(getWeekStartMonday(new Date()), 7)));
  const [storeId, setStoreId] = useState("all");
  const [employeeUid, setEmployeeUid] = useState("all");

  // Data
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [ratesByUid, setRatesByUid] = useState({});
  const [timesheets, setTimesheets] = useState([]);

  const loadStaffDropdown = useCallback(async () => {
    try {
      const qs = query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"));
      const snap = await getDocs(qs);
      const list = snap.docs.map((d) => ({
        uid: d.id,
        name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.data().email,
        hourlyRate: Number(d.data().hourlyRate || 0),
      })).sort((a, b) => a.name.localeCompare(b.name));

      setStaffList(list);
      const map = {};
      list.forEach((s) => { map[s.uid] = { name: s.name, hourlyRate: s.hourlyRate }; });
      setRatesByUid(map);
    } catch (e) {
      showToast("Error loading staff list", "error");
    }
  }, [showToast]);

  const loadPayroll = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      let qTs = query(collection(db, "timesheets"), where("date", ">=", dateFrom), where("date", "<", dateTo));
      if (employeeUid !== "all") {
        qTs = query(collection(db, "timesheets"), where("uid", "==", employeeUid), where("date", ">=", dateFrom), where("date", "<", dateTo));
      }

      const snap = await getDocs(qTs);
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (storeId !== "all") list = list.filter((x) => x.storeId === storeId);

      // Map rates and compute amounts
      list = list.map((ts) => {
        const mins = calcWorkedMinutes(ts);
        const rate = ratesByUid[ts.uid]?.hourlyRate || 0;
        const amount = hours(mins) * rate;
        return {
          ...ts,
          workedHours: hours(mins),
          amount,
          staffName: ratesByUid[ts.uid]?.name || ts.staffName || "Unknown",
          hourlyRate: rate,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      setTimesheets(list);
      if (isManual) showToast("Payroll data updated", "success");
    } catch (e) {
      showToast("Failed to load payroll", "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, storeId, employeeUid, ratesByUid, showToast]);

  useEffect(() => { loadStaffDropdown(); }, [loadStaffDropdown]);
  
  useEffect(() => {
    const now = new Date();
    if (rangePreset === "day") { setDateFrom(toYMD(now)); setDateTo(toYMD(addDays(now, 1))); }
    if (rangePreset === "week") { const ws = getWeekStartMonday(now); setDateFrom(toYMD(ws)); setDateTo(toYMD(addDays(ws, 7))); }
    if (rangePreset === "month") { setDateFrom(toYMD(new Date(now.getFullYear(), now.getMonth(), 1))); setDateTo(toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 1))); }
  }, [rangePreset]);

  useEffect(() => { loadPayroll(); }, [loadPayroll]);

  const totals = useMemo(() => {
    const h = timesheets.reduce((s, x) => s + (x.workedHours || 0), 0);
    const a = timesheets.reduce((s, x) => s + (x.amount || 0), 0);
    return { h: h.toFixed(2), a };
  }, [timesheets]);

  return (
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Payroll</h1>
          <span className="subtitle">Calculation based on input times</span>
        </div>
        <button className={`refresh-circle ${loading ? 'spinning' : ''}`} onClick={() => loadPayroll(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </header>

      <main className="scroll-content">
        <section className="payroll-filters-container">
          <div className="preset-tabs">
            {["day", "week", "month", "custom"].map((p) => (
              <button key={p} className={`tab-item ${rangePreset === p ? "active" : ""}`} onClick={() => setRangePreset(p)}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="filters-grid">
            <div className="filter-field">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setRangePreset("custom"); setDateFrom(e.target.value); }} />
            </div>
            <div className="filter-field">
              <label>To (Excl)</label>
              <input type="date" value={dateTo} onChange={(e) => { setRangePreset("custom"); setDateTo(e.target.value); }} />
            </div>
            <div className="filter-field">
              <label>Store</label>
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="all">All Stores</option>
                {STORES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label>Staff</label>
              <select value={employeeUid} onChange={(e) => setEmployeeUid(e.target.value)}>
                <option value="all">All Staff</option>
                {staffList.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="stats-bar">
          <div className="stat-item">
            <label>Total Hours</label>
            <div className="value">{totals.h}<small>h</small></div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <label>Total Salary</label>
            <div className="value brand">{money(totals.a)}</div>
          </div>
        </section>

        <div className="payroll-list timeline">
          {loading ? (
            <div className="loader-inline"><div className="spinner"></div><span>Calculating...</span></div>
          ) : timesheets.length === 0 ? (
            <div className="empty-state-container"><p>No data found.</p></div>
          ) : (
            timesheets.map((t) => (
              <div key={t.id} className="payroll-card">
                <div className="payroll-card-main">
                  <div className="staff-header">
                    <span className="staff-name">{t.staffName}</span>
                    <span className="shift-tag">{t.date} • {storeLabel(t.storeId)}</span>
                  </div>
                  <div className="payroll-details">
                    <div className="pay-col">
                      <label>Hours</label>
                      <span>{t.workedHours}h</span>
                    </div>
                    <div className="pay-col">
                      <label>Rate</label>
                      <span>{money(t.hourlyRate)}/h</span>
                    </div>
                    <div className="pay-col total">
                      <label>Amount</label>
                      <span className="brand">{money(t.amount)}</span>
                    </div>
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