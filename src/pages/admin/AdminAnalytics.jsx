import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
import {
  buildUserDirectory,
  calculateAttendanceTrends,
  calculateLaborCost,
  calculateLeaveTrends,
  calculateNotificationEffectiveness,
  calculateShiftPatterns,
  clampDateRange,
  filterByCommonFields,
  money,
} from "../../utils/adminAnalytics";
import { deleteSavedView, loadSavedViews, saveSavedView } from "../../utils/adminSavedViews";
import { useToast } from "../../context/ToastContext";
import "./AdminAnalytics.css";

const DEFAULT_FILTERS = {
  dateFrom: toYMD(addDays(getWeekStartMonday(new Date()), -21)),
  dateTo: toYMD(addDays(new Date(), 1)),
  storeId: "all",
  department: "all",
  staffUid: "all",
  status: "all",
};

function MetricCard({ label, value, hint, tone = "" }) {
  return (
    <div className={`analytics-metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

function BreakdownList({ title, items, formatter = (value) => value, emptyText }) {
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-header">
        <h3>{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="analytics-empty">{emptyText}</div>
      ) : (
        <div className="analytics-breakdown-list">
          {items.map((item) => (
            <div key={item.label} className="analytics-breakdown-row">
              <span>{item.label}</span>
              <strong>{formatter(item.value)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniBarChart({ title, items, formatter = (value) => value, emptyText }) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <section className="analytics-panel">
      <div className="analytics-panel-header">
        <h3>{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="analytics-empty">{emptyText}</div>
      ) : (
        <div className="analytics-chart-list">
          {items.map((item) => {
            const width = max > 0 ? `${Math.max((item.value / max) * 100, 8)}%` : "8%";
            return (
              <div key={item.label} className="analytics-chart-row">
                <div className="analytics-chart-labels">
                  <span>{item.label}</span>
                  <strong>{formatter(item.value)}</strong>
                </div>
                <div className="analytics-chart-track">
                  <div className="analytics-chart-fill" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MiniDonut({ title, segments, emptyText }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const safeTotal = total || 1;
  let cursor = 0;
  const gradient = segments
    .map((segment) => {
      const start = (cursor / safeTotal) * 360;
      cursor += segment.value;
      const end = (cursor / safeTotal) * 360;
      return `${segment.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <section className="analytics-panel">
      <div className="analytics-panel-header">
        <h3>{title}</h3>
      </div>
      {total === 0 ? (
        <div className="analytics-empty">{emptyText}</div>
      ) : (
        <div className="analytics-donut-wrap">
          <div className="analytics-donut" style={{ background: `conic-gradient(${gradient})` }}>
            <div className="analytics-donut-hole">
              <strong>{total}</strong>
              <span>Total</span>
            </div>
          </div>
          <div className="analytics-donut-legend">
            {segments.map((segment) => (
              <div key={segment.label} className="analytics-legend-row">
                <span className="analytics-legend-dot" style={{ background: segment.color }} />
                <span>{segment.label}</span>
                <strong>{segment.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminAnalytics() {
  const { showToast } = useToast();
  const { stores, getStoreLabel } = useStores();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [savedViews, setSavedViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [shiftRequests, setShiftRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    setSavedViews(loadSavedViews("analytics"));
  }, []);

  const loadAnalytics = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const { start, end } = clampDateRange(filters);
      const startYmd = filters.dateFrom;
      const endYmd = filters.dateTo;

      const [
        usersSnap,
        timesheetSnap,
        shiftsSnap,
        leaveSnap,
        shiftRequestSnap,
        notificationsSnap,
      ] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "in", ["staff", "manager"]))),
        getDocs(query(collection(db, "timesheets"), where("date", ">=", startYmd), where("date", "<", endYmd))),
        getDocs(query(collectionGroup(db, "shifts"), where("date", ">=", startYmd), where("date", "<", endYmd))),
        getDocs(collection(db, "leaveRequests")),
        getDocs(collection(db, "shiftRequests")),
        getDocs(query(collection(db, "notifications"), where("createdAt", ">=", start), where("createdAt", "<", end))),
      ]);

      setUsers(usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setTimesheets(timesheetSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setShifts(shiftsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setLeaveRequests(leaveSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setShiftRequests(shiftRequestSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setNotifications(notificationsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));

      if (manual) showToast("Analytics refreshed", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to load analytics", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    loadAnalytics(false);
  }, [loadAnalytics]);

  const usersByUid = useMemo(() => buildUserDirectory(users), [users]);

  const filteredTimesheets = useMemo(
    () => filterByCommonFields(timesheets, filters, usersByUid),
    [filters, timesheets, usersByUid]
  );
  const filteredShifts = useMemo(
    () => filterByCommonFields(shifts, filters, usersByUid),
    [filters, shifts, usersByUid]
  );
  const filteredLeave = useMemo(
    () =>
      leaveRequests.filter((item) => {
        const staffMatch = filters.staffUid === "all" || item.uid === filters.staffUid;
        const statusMatch = filters.status === "all" || item.status === filters.status;
        const departmentMatch =
          filters.department === "all" ||
          String(usersByUid[item.uid]?.department || "").toLowerCase() === filters.department;
        return staffMatch && statusMatch && departmentMatch;
      }),
    [filters, leaveRequests, usersByUid]
  );
  const filteredShiftRequests = useMemo(
    () => filterByCommonFields(shiftRequests, filters, usersByUid),
    [filters, shiftRequests, usersByUid]
  );
  const filteredNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        const categoryUser = item.uid || "";
        const staffMatch = filters.staffUid === "all" || categoryUser === filters.staffUid;
        return staffMatch;
      }),
    [filters.staffUid, notifications]
  );

  const labor = useMemo(
    () => calculateLaborCost(filteredTimesheets, usersByUid, getStoreLabel),
    [filteredTimesheets, usersByUid, getStoreLabel]
  );
  const attendance = useMemo(
    () => calculateAttendanceTrends(filteredShifts, filteredTimesheets),
    [filteredShifts, filteredTimesheets]
  );
  const leaveTrend = useMemo(() => calculateLeaveTrends(filteredLeave), [filteredLeave]);
  const shiftPattern = useMemo(() => calculateShiftPatterns(filteredShiftRequests), [filteredShiftRequests]);
  const notificationMetrics = useMemo(
    () => calculateNotificationEffectiveness(filteredNotifications),
    [filteredNotifications]
  );
  const attendanceSegments = useMemo(
    () => [
      { label: "On time", value: attendance.onTime, color: "#4ade80" },
      { label: "Late", value: attendance.late, color: "#f59e0b" },
      { label: "Absent", value: attendance.absent, color: "#ef4444" },
    ],
    [attendance]
  );
  const notificationSegments = useMemo(
    () => [
      { label: "Acted", value: notificationMetrics.acted, color: "#4ade80" },
      { label: "Opened", value: Math.max(notificationMetrics.opened - notificationMetrics.acted, 0), color: "#38bdf8" },
      { label: "Ignored", value: notificationMetrics.ignored, color: "#f59e0b" },
    ],
    [notificationMetrics]
  );

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveView() {
    const name = window.prompt("Save this analytics view as:");
    if (!name?.trim()) return;
    setSavedViews(saveSavedView("analytics", name.trim(), filters));
    showToast("Analytics view saved", "success");
  }

  return (
    <div className="mobile-app-wrapper analytics-page">
      <header className="app-header analytics-header">
        <div className="header-text">
          <h1 className="main-title">Analytics</h1>
          <span className="subtitle">Labor, attendance, leave, shift release, and notification trends</span>
        </div>
        <div className="analytics-header-actions">
          <button className="pill-btn" type="button" onClick={handleSaveView}>
            Save view
          </button>
          <button className={`refresh-circle ${loading ? "spinning" : ""}`} onClick={() => loadAnalytics(true)} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </header>

      <main className="scroll-content analytics-content">
        <section className="analytics-filter-shell">
          <div className="analytics-filter-grid">
            <input type="date" className="app-input" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} />
            <input type="date" className="app-input" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} />
            <select className="app-input" value={filters.storeId} onChange={(e) => updateFilter("storeId", e.target.value)}>
              <option value="all">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.label}</option>
              ))}
            </select>
            <select className="app-input" value={filters.department} onChange={(e) => updateFilter("department", e.target.value)}>
              <option value="all">All departments</option>
              <option value="shop">Shop</option>
              <option value="kitchen">Kitchen</option>
              <option value="manager">Manager</option>
            </select>
            <select className="app-input" value={filters.staffUid} onChange={(e) => updateFilter("staffUid", e.target.value)}>
              <option value="all">All staff</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || user.id}
                </option>
              ))}
            </select>
            <select className="app-input" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="open">Open</option>
              <option value="claimed">Claimed</option>
            </select>
          </div>

          {savedViews.length > 0 ? (
            <div className="analytics-saved-row">
              {savedViews.map((view) => (
                <div key={view.id} className="analytics-saved-chip">
                  <button type="button" onClick={() => setFilters(view.filters)}>{view.name}</button>
                  <button type="button" onClick={() => setSavedViews(deleteSavedView("analytics", view.id))}>×</button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="analytics-metrics-grid">
          <MetricCard label="Labor Cost" value={money(labor.totalCost)} hint={`${labor.totalHours.toFixed(1)} worked hours`} tone="accent" />
          <MetricCard label="Absent Shifts" value={attendance.absent} hint={`${attendance.total} rostered shifts`} tone="danger" />
          <MetricCard label="Late Starts" value={attendance.late} hint={`${attendance.onTime} on time`} tone="warning" />
          <MetricCard label="Leave Requests" value={leaveTrend.total} hint={`${leaveTrend.byStatus.find((item) => item.label === "approved")?.value || 0} approved`} />
          <MetricCard label="Shift Releases" value={shiftPattern.total} hint={`${shiftPattern.approved} approved handovers`} />
          <MetricCard label="Notification Actions" value={notificationMetrics.acted} hint={`${notificationMetrics.opened} opened, ${notificationMetrics.ignored} ignored`} tone="success" />
        </section>

        <section className="analytics-grid">
          <MiniBarChart title="Labor Cost by Day" items={labor.byDay} formatter={money} emptyText="No labor records in this range." />
          <MiniBarChart title="Labor Cost by Store" items={labor.byStore} formatter={money} emptyText="No store labor data yet." />
          <MiniDonut title="Attendance Trend" segments={attendanceSegments} emptyText="No attendance trend available." />
          <MiniDonut title="Notification Effectiveness" segments={notificationSegments} emptyText="No notification activity yet." />
          <BreakdownList title="Leave by Type" items={leaveTrend.byType} emptyText="No leave requests in this range." />
          <BreakdownList title="Leave by Status" items={leaveTrend.byStatus} emptyText="No leave status data." />
          <BreakdownList title="Shift Request Statuses" items={shiftPattern.byStatus} emptyText="No shift request activity." />
          <MiniBarChart
            title="Notification Totals"
            items={[
              { label: "Sent", value: notificationMetrics.total },
              { label: "Opened", value: notificationMetrics.opened },
              { label: "Acted", value: notificationMetrics.acted },
              { label: "Ignored", value: notificationMetrics.ignored },
            ]}
            emptyText="No notification metrics available."
          />
        </section>
      </main>
    </div>
  );
}
