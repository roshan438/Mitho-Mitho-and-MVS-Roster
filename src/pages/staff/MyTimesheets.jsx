import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
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
import { prettyTime } from "../../utils/dates";

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
                            <span>{prettyTime(ts.startInput) || "--:--"}</span>
                          </div>
                          <div className="time-box">
                            <label>BREAK</label>
                            <span>{prettyTime(ts.breakStartInput) ? "Done" : "None"}</span>
                          </div>
                          <div className="time-box">
                            <label>OUT</label>
                            <span>{prettyTime(ts.endInput) || "--:--"}</span>
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