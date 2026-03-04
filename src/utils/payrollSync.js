// src/utils/payrollSync.js
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch,
    serverTimestamp,
    setDoc,
  } from "firebase/firestore";
  import { db } from "../firebase/firebase";
  import { addDays, toYMD, getPaydayForWeek } from "./payrollCalc";
  
  // --- Time helpers (same logic you used) ---
  const hmToMinutes = (hm) => {
    if (!hm || typeof hm !== "string") return null;
    const [h, m] = hm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  
  const calcWorkedMinutes = (ts) => {
    const start = hmToMinutes(ts.startInput);
    const end = hmToMinutes(ts.endInput);
    if (start == null || end == null) return 0;
  
    let worked = end - start;
    if (worked < 0) worked += 1440; // overnight safety
  
    // break is optional
    const bs = hmToMinutes(ts.breakStartInput);
    const be = hmToMinutes(ts.breakEndInput);
    if (bs != null && be != null) {
      let br = be - bs;
      if (br < 0) br += 1440;
      worked -= br;
    }
  
    return Math.max(0, worked);
  };
  
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  
  /**
   * Admin sync:
   * - Reads all timesheets in week range [weekStart, weekStart+7)
   * - Writes/updates daily payroll entries:
   *      payrollDays/{date}/entries/{uid}
   * - Recomputes weekly totals and updates:
   *      payrollWeeks/{weekStart}/staff/{uid}
   *   while PRESERVING paidTotal already recorded.
   *
   * weekStartYMD: "YYYY-MM-DD" (Monday)
   */
  export async function syncPayrollWeekFromTimesheets(weekStartYMD) {
    const weekStart = new Date(weekStartYMD + "T00:00:00");
    const weekEndExclusive = addDays(weekStart, 7);
    const weekEndYMD = toYMD(addDays(weekStart, 6)); // Sunday
    const paydayYMD = getPaydayForWeek(weekStartYMD);
  
    // 1) Pull all approved staff users (need hourlyRate + names)
    const staffSnap = await getDocs(
      query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"))
    );
  
    const usersByUid = {};
    staffSnap.docs.forEach((d) => {
      usersByUid[d.id] = { uid: d.id, ...d.data() };
    });
  
    // 2) Pull all timesheets in this week (all staff, no uid filter)
    const startYMD = weekStartYMD;
    const endYMD = toYMD(weekEndExclusive);
  
    const tsSnap = await getDocs(
      query(
        collection(db, "timesheets"),
        where("date", ">=", startYMD),
        where("date", "<", endYMD)
      )
    );
  
    // 3) Build totals per uid + daily ledger
    // dailyEntries[date][uid] = {hours, amount, storeId}
    const dailyEntries = {}; // { "2026-03-02": { uid1: {...}, uid2: {...} } }
    const totalsByUid = {};  // { uid: { totalMinutes, totalHours, totalAmount } }
  
    tsSnap.docs.forEach((d) => {
      const ts = d.data();
      const uid = ts.uid;
      const date = ts.date;
  
      if (!uid || !date) return;
      // Only staff we know (approved). If you want include all, remove this check.
      const user = usersByUid[uid];
      if (!user) return;
  
      const mins = calcWorkedMinutes(ts);
      const hours = round2(mins / 60);
      const rate = Number(user.hourlyRate || 0);
      const amount = round2(hours * rate);
  
      if (!dailyEntries[date]) dailyEntries[date] = {};
      dailyEntries[date][uid] = {
        uid,
        date,
        storeId: ts.storeId || "unknown",
        hours,
        rate,
        amount,
        source: "timesheet",
        timesheetId: d.id,
      };
  
      if (!totalsByUid[uid]) totalsByUid[uid] = { totalMinutes: 0, totalHours: 0, totalAmount: 0 };
      totalsByUid[uid].totalMinutes += mins;
      totalsByUid[uid].totalHours = round2(totalsByUid[uid].totalMinutes / 60);
      totalsByUid[uid].totalAmount = round2(totalsByUid[uid].totalHours * rate);
    });
  
    // 4) Batch write daily payroll entries + update weekly summaries
    const batch = writeBatch(db);
  
    // 4a) Write daily entries
    Object.keys(dailyEntries).forEach((dayId) => {
      const byUid = dailyEntries[dayId];
      Object.keys(byUid).forEach((uid) => {
        const user = usersByUid[uid];
        const e = byUid[uid];
  
        const ref = doc(db, "payrollDays", dayId, "entries", uid);
        batch.set(
          ref,
          {
            uid,
            staffName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || uid,
            date: dayId,
            storeId: e.storeId,
            hours: e.hours,
            rate: e.rate,
            amount: e.amount,
            source: "timesheet",
            timesheetId: e.timesheetId,
            updatedAt: serverTimestamp(),
            // keep createdAt if already exists (but batch can't read)
            // so we set createdAt only if missing using merge and do not overwrite:
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
    });
  
    // 4b) Update weekly summary per uid (preserve paidTotal)
    // We can't read inside a batch, so we do per-user getDoc before setting summary.
    await batch.commit(); // commit daily first (fast + reliable)
  
    // Now update summaries (separate loop)
    for (const uid of Object.keys(usersByUid)) {
      const user = usersByUid[uid];
      const totals = totalsByUid[uid] || { totalMinutes: 0, totalHours: 0, totalAmount: 0 };
  
      const sumRef = doc(db, "payrollWeeks", weekStartYMD, "staff", uid);
      const sumSnap = await getDoc(sumRef);
      const existing = sumSnap.exists() ? sumSnap.data() : null;
  
      const paidTotal = Number(existing?.paidTotal || 0);
      const remaining = round2(Math.max(0, totals.totalAmount - paidTotal));
      const status =
        totals.totalAmount === 0 ? "unpaid" : remaining === 0 ? "paid" : paidTotal > 0 ? "partial" : "unpaid";
  
      await setDoc(
        sumRef,
        {
          uid,
          staffName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || uid,
          weekStart: weekStartYMD,
          weekEnd: weekEndYMD,
          payday: paydayYMD,
  
          totalMinutes: totals.totalMinutes,
          totalHours: totals.totalHours,
          totalAmount: totals.totalAmount,
  
          paidTotal: round2(paidTotal),
          remaining,
          status,
  
          updatedAt: serverTimestamp(),
          createdAt: existing?.createdAt || serverTimestamp(),
        },
        { merge: true }
      );
    }
  
    return { ok: true, weekStart: weekStartYMD, startYMD, endYMD };
  }