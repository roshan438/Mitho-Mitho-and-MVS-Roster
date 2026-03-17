

















import { useEffect, useMemo, useState, useCallback } from "react";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { addDays, toYMD } from "../../utils/payrollCalc";
import "./PayrollHistory.css";
import { useStores } from "../../hooks/useStore";

function parseUrlParams() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return { weekStart: parts[2], uid: parts[3] };
}

function addDaysJS(dateOrYMD, days) {
  const d =
    typeof dateOrYMD === "string"
      ? new Date(dateOrYMD + "T00:00:00")
      : new Date(dateOrYMD);
  d.setDate(d.getDate() + days);
  return d;
}

export default function PayrollHistory() {
  const { weekStart: weekStartParam, uid } = parseUrlParams();
  const { stores } = useStores();

  const [weekStartYMD, setWeekStartYMD] = useState(weekStartParam);
  useEffect(() => {
    if (weekStartParam && weekStartParam !== weekStartYMD) {
      setWeekStartYMD(weekStartParam);
    }
  }, [weekStartParam, weekStartYMD]);

  const days = useMemo(() => {
    const start = new Date(weekStartYMD + "T00:00:00");
    return Array.from({ length: 7 }).map((_, i) =>
      toYMD(addDays(start, i))
    );
  }, [weekStartYMD]);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStartYMD + "T00:00:00");
    const end = addDaysJS(start, 6);
    return `${toYMD(start)} → ${toYMD(end)}`;
  }, [weekStartYMD]);

  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

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

    const weekSnap = await getDoc(doc(db, "payrollWeeks", weekStartYMD));
    setIsLocked(weekSnap.exists() && weekSnap.data()?.locked === true);

    const out = [];
    for (const dayId of days) {
      const ref = doc(db, "payrollDays", dayId, "entries", uid);
      const snap = await getDoc(ref);
      out.push({
        dayId,
        exists: snap.exists(),
        ...(snap.exists() ? snap.data() : {})
      });
    }

    setEntries(out);
    setLoading(false);
  }, [uid, days, weekStartYMD]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!uid || !weekStartYMD) return;
    const expected = `/admin/payroll/${weekStartYMD}/${uid}`;
    if (window.location.pathname !== expected) {
      window.history.pushState({}, "", expected);
    }
  }, [weekStartYMD, uid]);

  async function saveEntry(dayId, patch) {
    if (isLocked) return;
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
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          user?.email ||
          uid,
        date: dayId,
        storeId: patch.storeId ?? curr?.storeId ?? "",
        hours,
        rate,
        amount,
        source: patch.source ?? curr?.source ?? "manual",
        note: patch.note ?? curr?.note ?? "",
        editedBy: "admin",
        editedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: curr?.createdAt ?? serverTimestamp()
      },
      { merge: true }
    );

    await load();
  }

  async function removeEntry(dayId) {
    if (isLocked) return;
    if (!window.confirm(`Delete entry for ${dayId}?`)) return;
    await deleteDoc(doc(db, "payrollDays", dayId, "entries", uid));
    await load();
  }

  if (loading) return <div className="payroll-container">Loading...</div>;
  if (!user) return <div className="payroll-container">User not found.</div>;

  return (
    <div className="payroll-container">
      <h2>Payroll History</h2>

      <div className="user-info-bar">
        <div>
          <strong>
            {user.firstName} {user.lastName}
          </strong>{" "}
          — Rate: ${user.hourlyRate}/hr
          <div style={{ marginTop: 4 }}>Week: {weekLabel}</div>
        </div>
      </div>

      {isLocked && (
        <div className="validation-box">
          This payroll week is locked. Daily payroll entries are read-only until unlocked.
        </div>
      )}

      <div className="payroll-list">
        {entries.map((e) => (
          <Row
            key={e.dayId}
            entry={e}
            defaultRate={user.hourlyRate}
            stores={stores}
            isLocked={isLocked}
            onSave={saveEntry}
            onDelete={removeEntry}
          />
        ))}

        <div className="weekly-total">
          <strong>Total: </strong>
          {totals.hours.toFixed(2)} hrs — ${totals.amount.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function Row({ entry, defaultRate, stores, isLocked, onSave, onDelete }) {
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
    <div className="row-wrapper">
      <div
        className="collapse-header"
        onClick={() => setOpen(!open)}
      >
        <span>{entry.dayId}</span>
        <span>${amount.toFixed(2)}</span>
      </div>

      {open && (
        <div className="row-body">
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Select Store</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Hours"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />

          <input
            type="number"
            placeholder="Rate"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />

          <input
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="row-actions">
            <button
              onClick={() =>
                onSave(entry.dayId, {
                  storeId,
                  hours: Number(hours),
                  rate: Number(rate),
                  note,
                  source
                })
              }
              disabled={isLocked}
            >
              Save
            </button>

            <button
              onClick={() => onDelete(entry.dayId)}
              disabled={!entry.exists || isLocked}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
