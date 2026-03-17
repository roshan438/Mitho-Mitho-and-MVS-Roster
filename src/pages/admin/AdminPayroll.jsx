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
import "./AdminPayroll.css";
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
  if (bs != null && be != null) {
    let br = be - bs;
    if (br < 0) br += 1440;
    worked -= br;
  }
  return Math.max(0, worked);
};

const minutesToHours = (min) => Math.round((Number(min || 0) / 60) * 100) / 100;
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
  const [staffList, setStaffList] = useState([]);
  const [weekMeta, setWeekMeta] = useState({
    reviewStatus: "draft",
    locked: false,
  });
  const [rows, setRows] = useState([]);
  const [payInputs, setPayInputs] = useState({}); // uid -> "100"
  const [allTotalsByUid, setAllTotalsByUid] = useState({}); // uid -> { totalAmount, paidTotal, remaining, totalHours }
  const [openPayrollUid, setOpenPayrollUid] = useState(null);
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
  const loadWeekRows = useCallback(async () => {
    if (!isYMD(weekStart)) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const weekSnap = await getDoc(doc(db, "payrollWeeks", weekStart));
      const weekData = weekSnap.exists() ? weekSnap.data() : {};
      setWeekMeta({
        reviewStatus: weekData.reviewStatus || "draft",
        reviewedAt: weekData.reviewedAt || null,
        reviewedBy: weekData.reviewedBy || "",
        locked: weekData.locked === true,
        lockedAt: weekData.lockedAt || null,
        lockedBy: weekData.lockedBy || "",
      });
      const snap = await getDocs(collection(db, "payrollWeeks", weekStart, "staff"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
        part.forEach((uid) => {
          if (!out[uid]) out[uid] = { totalAmount: 0, paidTotal: 0, remaining: 0, totalHours: 0 };
        });
      }

      setAllTotalsByUid((prev) => ({ ...prev, ...out }));
    } catch (e) {
      console.error("loadLifetimeTotals failed:", e);
    }
  }, []);
  useEffect(() => {
    loadStaff();
  }, [loadStaff]);
  useEffect(() => {
    loadWeekRows();
  }, [loadWeekRows]);
  const uidsKey = useMemo(() => {
    const uids = rows.map((r) => r.uid).filter(Boolean).sort();
    return uids.join("|");
  }, [rows]);

  useEffect(() => {
    if (!uidsKey) return;
    const uids = uidsKey.split("|").filter(Boolean);
    loadLifetimeTotals(uids);
  }, [uidsKey, loadLifetimeTotals]);

  const isWeekLocked = weekMeta.locked === true;
  const isWeekReviewed = weekMeta.reviewStatus === "reviewed";
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
  async function syncFromTimesheets() {
    if (!isYMD(weekStart) || !weekStartObj || !isYMD(weekEndExclusive)) {
      showToast("Invalid week start date", "error");
      return;
    }

    if (isWeekLocked) {
      showToast("This payroll week is locked. Unlock it before syncing.", "error");
      return;
    }

    setLoading(true);
    try {
      if (!staffList.length) {
        await loadStaff();
      }
      await setDoc(
        doc(db, "payrollWeeks", weekStart),
        {
          weekStart,
          weekEnd: weekEndInclusive,
          payday: paydayYMD,
          reviewStatus: "draft",
          reviewedAt: null,
          reviewedBy: "",
          updatedAt: serverTimestamp(),
        },
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
  async function pay(uid, mode) {
    if (isWeekLocked) {
      showToast("This payroll week is locked. Unlock it before editing payments.", "error");
      return;
    }

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
    if (isWeekLocked) {
      showToast("This payroll week is locked. Unlock it before resetting payments.", "error");
      return;
    }

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

  async function markWeekReviewed() {
    if (rows.length === 0) {
      showToast("Sync payroll first so there is something to review.", "error");
      return;
    }
    if (isWeekLocked) {
      showToast("This payroll week is locked.", "error");
      return;
    }

    try {
      await setDoc(
        doc(db, "payrollWeeks", weekStart),
        {
          weekStart,
          weekEnd: weekEndInclusive,
          payday: paydayYMD,
          reviewStatus: "reviewed",
          reviewedAt: serverTimestamp(),
          reviewedBy: "admin",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setWeekMeta((prev) => ({
        ...prev,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
      }));
      showToast("Payroll week reviewed", "success");
      await loadWeekRows();
    } catch (error) {
      console.error(error);
      showToast("Failed to mark payroll week as reviewed", "error");
    }
  }

  async function toggleWeekLock() {
    if (!isWeekLocked && !isWeekReviewed) {
      showToast("Review the payroll week before locking it.", "error");
      return;
    }

    try {
      await setDoc(
        doc(db, "payrollWeeks", weekStart),
        {
          weekStart,
          weekEnd: weekEndInclusive,
          payday: paydayYMD,
          locked: !isWeekLocked,
          lockedAt: !isWeekLocked ? serverTimestamp() : null,
          lockedBy: !isWeekLocked ? "admin" : "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast(!isWeekLocked ? "Payroll locked" : "Payroll unlocked", "success");
      await loadWeekRows();
    } catch (error) {
      console.error(error);
      showToast("Failed to update payroll lock", "error");
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
            Week {weekStart} → {weekEndInclusive} <br></br>Payday: <span style={{color: '#f6a600'}}>{paydayYMD}</span>
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
        <section className={`payroll-week-state ${isWeekLocked ? "locked" : isWeekReviewed ? "reviewed" : "draft"}`}>
          <div>
            <strong>
              {isWeekLocked
                ? "Payroll locked"
                : isWeekReviewed
                ? "Payroll reviewed"
                : "Payroll draft"}
            </strong>
            <p>
              {isWeekLocked
                ? "This week is frozen until you unlock it."
                : isWeekReviewed
                ? "Totals are reviewed and ready to lock."
                : "Sync and review this week before final lock."}
            </p>
          </div>
        </section>

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
              <button
                className="tab-item active"
                onClick={syncFromTimesheets}
                disabled={loading || isWeekLocked}
              >
                Sync from Timesheets
              </button>
            </div>

            <div className="filter-field">
              <label>Review</label>
              <button
                className={`tab-item ${isWeekReviewed ? "" : "active"}`}
                onClick={markWeekReviewed}
                disabled={loading || rows.length === 0 || isWeekLocked}
              >
                {isWeekReviewed ? "Reviewed" : "Mark Reviewed"}
              </button>
            </div>

            <div className="filter-field">
              <label>Lock</label>
              <button
                className={`tab-item ${isWeekLocked || isWeekReviewed ? "active" : ""}`}
                onClick={toggleWeekLock}
                disabled={loading || (!isWeekLocked && !isWeekReviewed)}
              >
                {isWeekLocked ? "Unlock Payroll" : "Lock Payroll"}
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
                  <button
                    type="button"
                    className="payroll-card-main payroll-card-toggle"
                    onClick={() =>
                      setOpenPayrollUid((prev) => (prev === r.uid ? null : r.uid))
                    }
                  >
                    <div className="staff-header compact">
                      <span
                        className="staff-name"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/admin/payroll/${weekStart}/${r.uid}`;
                        }}
                        title="Open history"
                      >
                        {r.staffName || r.uid}
                      </span>
                    </div>

                    <div className="payroll-row-chips">
                      <span className="mini-chip neutral">{status.toUpperCase()}</span>
                      <span className="mini-chip hours">
                        {Number(r.totalHours || 0).toFixed(2)}h
                      </span>
                      <span className="mini-chip money">{money(r.remaining)}</span>
                      <span className="mini-chip soft" title="All-time remaining">
                        {allRemaining == null ? "ALL —" : `ALL ${money(allRemaining)}`}
                      </span>
                      <span className={`expand-chevron ${openPayrollUid === r.uid ? "open" : ""}`}>
                        ⌄
                      </span>
                    </div>
                  </button>

                  {openPayrollUid === r.uid && (
                    <div className="payroll-card-details">
                      <div className="payroll-details compact">
                        <div className="pay-col">
                          <label>Total</label>
                          <span>{money(r.totalAmount)}</span>
                        </div>
                        <div className="pay-col">
                          <label>Paid</label>
                          <span>{money(r.paidTotal)}</span>
                        </div>
                        <div className="pay-col total">
                          <label>Remain</label>
                          <span className="brand">{money(r.remaining)}</span>
                        </div>
                        <div className="pay-col">
                          <label>Week</label>
                          <span>{weekStart}</span>
                        </div>
                      </div>

                      <div className="payroll-actions-row">
                      <div className="pay-col">
                        <label>Partial</label>
                        <input
                          value={payInputs[r.uid] || ""}
                          onChange={(e) =>
                            setPayInputs((p) => ({ ...p, [r.uid]: e.target.value }))
                          }
                          placeholder="100"
                          disabled={remaining <= 0}
                        />
                      </div>

                        <button
                          className={`tab-item ${remaining <= 0 ? "" : "active"}`}
                          onClick={() => pay(r.uid, "partial")}
                          disabled={remaining <= 0 || isWeekLocked}
                        >
                          Part Pay
                        </button>

                        <button
                          className={`tab-item ${remaining <= 0 ? "" : "active"}`}
                          onClick={() => pay(r.uid, "full")}
                          disabled={remaining <= 0 || isWeekLocked}
                        >
                          Paid
                        </button>

                        <button
                          className={`tab-item ${Number(r.paidTotal || 0) > 0 ? "active" : ""}`}
                          onClick={() => resetPaid(r.uid)}
                          disabled={Number(r.paidTotal || 0) <= 0 || isWeekLocked}
                          title="Set paidTotal back to 0"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
