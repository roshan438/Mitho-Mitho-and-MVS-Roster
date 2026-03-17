








import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import "./Payroll.css";

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

const money = (n) =>
  Number(n || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });

const hours = (mins) => Math.round((mins / 60) * 100) / 100;
export default function Payroll() {
  const { showToast } = useToast();
  const { getStoreLabel } = useStores();

  const [rangePreset, setRangePreset] = useState("week");
  const [dateFrom, setDateFrom] = useState(
    toYMD(getWeekStartMonday(new Date()))
  );
  const [dateTo, setDateTo] = useState(
    toYMD(addDays(getWeekStartMonday(new Date()), 7))
  );
  const [storeId, setStoreId] = useState("all");
  const [employeeUid, setEmployeeUid] = useState("all");

  const [loading, setLoading] = useState(true);
  const [, setStaffList] = useState([]);
  const [ratesByUid, setRatesByUid] = useState({});
  const [timesheets, setTimesheets] = useState([]);
  const [openStaffUid, setOpenStaffUid] = useState(null);
  const loadStaffDropdown = useCallback(async () => {
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
            d.data().email,
          hourlyRate: Number(d.data().hourlyRate || 0),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setStaffList(list);

      const map = {};
      list.forEach((s) => {
        map[s.uid] = {
          name: s.name,
          hourlyRate: s.hourlyRate,
        };
      });

      setRatesByUid(map);
    } catch {
      showToast("Error loading staff", "error");
    }
  }, [showToast]);
  const loadPayroll = useCallback(async () => {
    setLoading(true);

    try {
      let qTs = query(
        collection(db, "timesheets"),
        where("date", ">=", dateFrom),
        where("date", "<", dateTo)
      );

      if (employeeUid !== "all") {
        qTs = query(
          collection(db, "timesheets"),
          where("uid", "==", employeeUid),
          where("date", ">=", dateFrom),
          where("date", "<", dateTo)
        );
      }

      const snap = await getDocs(qTs);

      let list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (storeId !== "all") {
        list = list.filter((x) => x.storeId === storeId);
      }

      list = list
        .map((ts) => {
          const mins = calcWorkedMinutes(ts);
          const workedHours = hours(mins);
          const rate = ratesByUid[ts.uid]?.hourlyRate || 0;
          const amount = workedHours * rate;

          return {
            ...ts,
            workedHours,
            hourlyRate: rate,
            amount,
            staffName:
              ratesByUid[ts.uid]?.name || ts.staffName || "Unknown",
          };
        })
        .sort(
          (a, b) =>
            a.staffName.localeCompare(b.staffName) ||
            a.date.localeCompare(b.date)
        );

      setTimesheets(list);
    } catch {
      showToast("Failed to load payroll", "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, storeId, employeeUid, ratesByUid, showToast]);

  useEffect(() => {
    loadStaffDropdown();
  }, [loadStaffDropdown]);

  useEffect(() => {
    const now = new Date();

    if (rangePreset === "week") {
      const ws = getWeekStartMonday(now);
      setDateFrom(toYMD(ws));
      setDateTo(toYMD(addDays(ws, 7)));
    }
  }, [rangePreset]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);
  const groupedPayroll = useMemo(() => {
    const grouped = {};

    for (const row of timesheets) {
      if (!grouped[row.uid]) {
        grouped[row.uid] = {
          uid: row.uid,
          staffName: row.staffName,
          totalHours: 0,
          totalAmount: 0,
          shifts: [],
        };
      }

      grouped[row.uid].shifts.push(row);
      grouped[row.uid].totalHours += Number(row.workedHours || 0);
      grouped[row.uid].totalAmount += Number(row.amount || 0);
    }

    return Object.values(grouped).sort((a, b) =>
      a.staffName.localeCompare(b.staffName)
    );
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
        {loading ? (
          <div className="loader-inline">
            <div className="spinner"></div>
            <span>Calculating...</span>
          </div>
        ) : (
          <div className="payroll-grouped-list">
            {groupedPayroll.map((group) => (
              <div key={group.uid} className="payroll-staff-card">
                <button
                  className="payroll-staff-header"
                  onClick={() =>
                    setOpenStaffUid(
                      openStaffUid === group.uid ? null : group.uid
                    )
                  }
                >
                  <div>
                    <div className="payroll-staff-name">
                      {group.staffName}
                    </div>
                    <div className="payroll-staff-sub">
                      {group.shifts.length} shift
                      {group.shifts.length > 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="payroll-staff-summary">
                    <span className="hours-pill">
                      {(group.totalHours).toFixed(2)}h
                    </span>
                    <span className="amount-pill">
                      {money(group.totalAmount)}
                    </span>
                  </div>
                </button>

                {openStaffUid === group.uid && (
                  <div className="payroll-staff-body">
                    {group.shifts.map((t) => (
                      <div key={t.id} className="payroll-day-card">
                        <div className="payroll-day-top">
                          <div>
                            <div className="payroll-day-date">
                              {t.date}
                            </div>
                            <div className="payroll-day-store">
                              {getStoreLabel(t.storeId)}
                            </div>
                          </div>
                        </div>

                        <div className="payroll-day-details">
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
                            <span className="brand">
                              {money(t.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
