import { useEffect, useMemo, useState, useCallback } from "react";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { addDays, toYMD } from "../../utils/payrollCalc";

import { subDays, getWeekStartMonday } from "../../utils/dates";
import "./PayrollHistory.css";
// import { STORES } from "../../utils/constants";

import { useStores } from "../../hooks/useStore";

function parseUrlParams() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // expected: /admin/payroll/:weekStart/:uid
  return { weekStart: parts[2], uid: parts[3] };
}

// Safe addDays for navigation (handles negative days reliably)
function addDaysJS(dateOrYMD, days) {
  const d =
    typeof dateOrYMD === "string"
      ? new Date(dateOrYMD + "T00:00:00")
      : new Date(dateOrYMD);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekStartMondayYMD(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // Sun=0, Mon=1...
  const diff = (day + 6) % 7; // Mon -> 0, Tue -> 1, Sun -> 6
  x.setDate(x.getDate() - diff);
  return toYMD(x);
}

export default function PayrollHistory() {
  const { weekStart: weekStartParam, uid } = parseUrlParams();

  // ✅ make weekStart dynamic (so we can switch week without leaving page)
  const [weekStartYMD, setWeekStartYMD] = useState(weekStartParam);
  const weekStartDateObj = new Date(weekStartYMD + "T00:00:00");

  // keep state synced if user opens a different URL directly
  useEffect(() => {
    if (weekStartParam && weekStartParam !== weekStartYMD) {
      setWeekStartYMD(weekStartParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartParam, uid]);

  const days = useMemo(() => {
    const start = new Date(weekStartYMD + "T00:00:00");
    return Array.from({ length: 7 }).map((_, i) => toYMD(addDays(start, i)));
  }, [weekStartYMD]);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStartYMD + "T00:00:00");
    const end = addDaysJS(start, 6);
    return `${toYMD(start)} → ${toYMD(end)}`;
  }, [weekStartYMD]);

  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, curr) => {
        acc.hours += Number(curr.hours || 0);
        acc.amount += Number(curr.amount || 0);
        return acc;
      },
      { hours: 0, amount: 0 }
    );
  }, [entries]);

  const load = useCallback(async () => {
    setLoading(true);

    const userSnap = await getDoc(doc(db, "users", uid));
    setUser(userSnap.exists() ? userSnap.data() : null);

    const out = [];
    for (const dayId of days) {
      const ref = doc(db, "payrollDays", dayId, "entries", uid);
      const snap = await getDoc(ref);
      out.push({ dayId, exists: snap.exists(), ...(snap.exists() ? snap.data() : {}) });
    }
    setEntries(out);

    setLoading(false);
  }, [uid, days]);

  useEffect(() => {
    load();
  }, [load]);

  // ✅ Update URL when week changes (so refresh keeps the selected week)
  useEffect(() => {
    if (!uid || !weekStartYMD) return;
    const expected = `/admin/payroll/${weekStartYMD}/${uid}`;
    if (window.location.pathname !== expected) {
      window.history.pushState({}, "", expected);
    }
  }, [weekStartYMD, uid]);

  async function saveEntry(dayId, patch) {
    const ref = doc(db, "payrollDays", dayId, "entries", uid);
    const snap = await getDoc(ref);
    const curr = snap.exists() ? snap.data() : null;

    const rate = patch.rate ?? curr?.rate ?? user?.hourlyRate ?? 0;
    const hours = patch.hours ?? curr?.hours ?? 0;
    const amount = Math.round(hours * rate * 100) / 100;

    await setDoc(
      ref,
      {
        uid,
        staffName:
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || uid,
        date: dayId,
        storeId: patch.storeId ?? curr?.storeId ?? "unknown",
        hours,
        rate,
        amount,
        source: patch.source ?? curr?.source ?? "manual",
        note: patch.note ?? curr?.note ?? "",
        editedBy: "admin",
        editedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: curr?.createdAt ?? serverTimestamp(),
      },
      { merge: true }
    );

    await load();
  }

  async function removeEntry(dayId) {
    if (!confirm(`Delete entry for ${dayId}?`)) return;
    await deleteDoc(doc(db, "payrollDays", dayId, "entries", uid));
    await load();
  }

  function goPrevWeek() {
    const prev = toYMD(addDaysJS(weekStartYMD, -7));
    setWeekStartYMD(prev);
  }

  function goNextWeek() {
    const next = toYMD(addDaysJS(weekStartYMD, 7));
    setWeekStartYMD(next);
  }

  function goThisWeek() {
    setWeekStartYMD(getWeekStartMondayYMD(new Date()));
  }

  if (loading) return <div className="payroll-container">Loading...</div>;
  if (!user) return <div className="payroll-container">User not found.</div>;

  return (
    <div className="payroll-container">

      <h2>Payroll History</h2>

      {/* ✅ Week filter bar (no classname changes, uses your existing styling) */}
      <div className="user-info-bar">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700 }}>
              {user.firstName} {user.lastName} — Rate: ${user.hourlyRate}/hr
            </div>
            <div style={{ opacity: 0.9, marginTop: 4 }}>Week: {weekLabel}</div>
          </div>
          <button className="close-btn" onClick={() => (window.location.href = "/admin/admin-payroll")}>
        Close
      </button>
        </div>

        <br></br>
        <div className="button-group">
            <button
                className="pill-btn"
                onClick={() => setWeekStartYMD(toYMD(subDays(weekStartDateObj, 7)))}
            >
                Prev
            </button>

            <button
                className={`pill-btn ${
                weekStartYMD === toYMD(getWeekStartMonday(new Date())) ? "active" : ""
                }`}
                onClick={() => setWeekStartYMD(toYMD(getWeekStartMonday(new Date())))}
            >
                This Week
            </button>

            <button
                className="pill-btn"
                onClick={() => setWeekStartYMD(toYMD(addDays(weekStartDateObj, 7)))}
            >
                Next
            </button>
            </div>
      </div>

      <div className="payroll-grid">
        <div className="grid-header">
          <div>Date</div>
          <div>Store</div>
          <div>Hours</div>
          <div>Rate</div>
          <div>Amount</div>
          <div>Source</div>
          <div>Note</div>
          <div>Actions</div>
        </div>

        {entries.map((e) => (
          <Row
            key={e.dayId}
            entry={e}
            defaultRate={user.hourlyRate}
            onSave={saveEntry}
            onDelete={removeEntry}
          />
        ))}

        <div className="grid-footer">
          <div className="footer-label">WEEKLY TOTAL:</div>
          <div data-label="Total Hours">{totals.hours.toFixed(2)} hrs</div>
          <div className="footer-separator">—</div>
          <div data-label="Total Amount" className="total-amount">
            ${totals.amount.toFixed(2)}
          </div>
          <div className="footer-spacer"></div>
        </div>
      </div>
    </div>
  );
}

// function Row({ entry, defaultRate, onSave, onDelete }) {
//   const [storeId, setStoreId] = useState(entry.storeId || "");
//   const [hours, setHours] = useState(entry.hours ?? "");
//   const [rate, setRate] = useState(entry.rate ?? defaultRate ?? "");
//   const [note, setNote] = useState(entry.note || "");
//   const [source, setSource] = useState(entry.source || "manual");

//   useEffect(() => {
//     setStoreId(entry.storeId || "");
//     setHours(entry.hours ?? "");
//     setRate(entry.rate ?? defaultRate ?? "");
//     setNote(entry.note || "");
//     setSource(entry.source || "manual");
//   }, [entry, defaultRate]);

//   const amount = Number(hours || 0) * Number(rate || 0);

//   return (
//     <div className="grid-row">
//       <div data-label="Date" className="col-date">{entry.dayId}</div>

//       <div data-label="Store">
//         <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
//           <option value="">Select</option>
//           {STORES.map((s) => (
//             <option key={s.id} value={s.id}>
//               {s.label}
//             </option>
//           ))}
//         </select>
//       </div>

//       <div data-label="Hours">
//         <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
//       </div>

//       <div data-label="Rate" className="hide-mobile">
//         <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
//       </div>

//       <div data-label="Total" className="col-amount">${amount.toFixed(2)}</div>

//       <div data-label="Source" className="hide-mobile">
//         <select value={source} onChange={(e) => setSource(e.target.value)}>
//           <option value="manual">Manual</option>
//           <option value="timesheet">Timesheet</option>
//         </select>
//       </div>

//       <div data-label="Note" className="hide-mobile">
//         <input value={note} onChange={(e) => setNote(e.target.value)} />
//       </div>

//       <div className="col-actions">
//         <button
//           className="btn-save"
//           onClick={() =>
//             onSave(entry.dayId, {
//               storeId,
//               hours: Number(hours || 0),
//               rate: Number(rate || 0),
//               note,
//               source,
//             })
//           }
//         >
//           Save
//         </button>

//         <button className="btn-delete" onClick={() => onDelete(entry.dayId)} disabled={!entry.exists}>
//           Del
//         </button>
//       </div>
//     </div>
//   );
// }


function Row({ entry, defaultRate, onSave, onDelete }) {
    const [storeId, setStoreId] = useState(entry.storeId || "");
    const [hours, setHours] = useState(entry.hours ?? "");
    const [rate, setRate] = useState(entry.rate ?? defaultRate ?? "");
    const [note, setNote] = useState(entry.note || "");
    const [source, setSource] = useState(entry.source || "manual");
  
    const [open, setOpen] = useState(false);
  
    useEffect(() => {
      setStoreId(entry.storeId || "");
      setHours(entry.hours ?? "");
      setRate(entry.rate ?? defaultRate ?? "");
      setNote(entry.note || "");
      setSource(entry.source || "manual");
    }, [entry, defaultRate]);
  
    const amount = Number(hours || 0) * Number(rate || 0);
  
    return (
      <div className="grid-row">
  
        {/* COLLAPSED HEADER */}
        <div
          className="collapse-header exception-grid"
          onClick={() => setOpen(!open)}
        >
          <div className="col-date colap-close">{entry.dayId}</div>
          <div className="col-amount colap-close">${amount.toFixed(2)}</div>
        </div>
  
        {/* ORIGINAL CONTENT (unchanged structure) */}
        {open && (
          <>
          <div className="col-date">{entry.dayId}</div>
            <div data-label="Store" className="">
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">Select</option>
                {STORES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
  
            <div data-label="Hours" className="">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
  
            <div data-label="Rate" className="hide-mobile ">
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
  
            <div data-label="Total" className="col-amount ">
              ${amount.toFixed(2)}
            </div>
  
            <div data-label="Source" className="hide-mobile ">
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="manual">Manual</option>
                <option value="timesheet">Timesheet</option>
              </select>
            </div>
  
            <div data-label="Note" className="hide-mobile ">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
  
            <div className="col-actions ">
              <button
                className="btn-save"
                onClick={() =>
                  onSave(entry.dayId, {
                    storeId,
                    hours: Number(hours),
                    rate: Number(rate),
                    note,
                    source,
                  })
                }
              >
                Save
              </button>

              {/* <div className="gap-btn"></div> */}
              <button
                className="btn-delete "
                onClick={() => onDelete(entry.dayId)}
                disabled={!entry.exists}
              >
                Delete
              </button>
            </div>
          </>
        )}
  
      </div>
    );
  }