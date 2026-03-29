import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, collectionGroup, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import { useNavigate } from "react-router-dom";
import { deleteSavedView, loadSavedViews, saveSavedView } from "../../utils/adminSavedViews";
import "./AdminDashboard.css";

const PAGE_SIZE = 16;

const fmtTime = (ts) => {
  if (!ts?.toDate) return "-";
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const statusFromTimesheet = (ts) => {
  if (!ts) return { label: "Absent", cls: "stNot" };
  if (ts.endActual) return { label: "Finished", cls: "stDone" };
  if (ts.breakStartActual && !ts.breakEndActual) return { label: "On Break", cls: "stBreak" };
  if (ts.startActual) return { label: "Clocked In", cls: "stWork" };
  return { label: "Absent", cls: "stNot" };
};

const DEFAULT_FILTERS = {
  storeId: "all",
  department: "all",
  status: "all",
  search: "",
};

export default function AdminDashboard() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { stores, getStoreLabel } = useStores();
  const today = useMemo(() => toYMD(new Date()), []);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [savedViews, setSavedViews] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [rosterToday, setRosterToday] = useState([]);
  const [tsByUid, setTsByUid] = useState({});
  const [dailyStocks, setDailyStocks] = useState([]);
  const [usersByUid, setUsersByUid] = useState({});

  const loadToday = useCallback(
    async (manual = false) => {
      setLoading(true);
      try {
        const [rosterSnap, tsSnap, stockSnap, userSnap] = await Promise.all([
          getDocs(query(collectionGroup(db, "shifts"), where("date", "==", today))),
          getDocs(query(collection(db, "timesheets"), where("date", "==", today))),
          getDocs(query(collection(db, "dailyStockTake"), where("date", "==", today))),
          getDocs(query(collection(db, "users"), where("role", "in", ["staff", "manager"]), limit(160))),
        ]);

        const roster = rosterSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        const tsMap = {};
        tsSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.uid) tsMap[data.uid] = data;
        });
        const userMap = {};
        userSnap.docs.forEach((docSnap) => {
          userMap[docSnap.id] = docSnap.data();
        });

        setRosterToday(roster);
        setTsByUid(tsMap);
        setDailyStocks(stockSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setUsersByUid(userMap);

        if (manual) showToast("Dashboard refreshed", "success");
      } catch (error) {
        console.error(error);
        showToast("Failed to sync dashboard data", "error");
      } finally {
        setLoading(false);
      }
    },
    [today, showToast]
  );

  useEffect(() => {
    loadToday(false);
    setSavedViews(loadSavedViews("dashboard"));
  }, [loadToday]);

  const filteredRows = useMemo(() => {
    const queryText = filters.search.trim().toLowerCase();

    return rosterToday
      .map((row) => {
        const ts = tsByUid[row.uid] || null;
        const status = statusFromTimesheet(ts);
        const profile = usersByUid[row.uid] || {};
        return {
          ...row,
          ts,
          statusLabel: status.label,
          statusCls: status.cls,
          department: String(profile.department || row.department || "").toLowerCase(),
        };
      })
      .filter((row) => {
        const storeMatch = filters.storeId === "all" || row.storeId === filters.storeId;
        const departmentMatch = filters.department === "all" || row.department === filters.department;
        const statusMatch = filters.status === "all" || row.statusCls === filters.status;
        const searchMatch =
          !queryText ||
          String(row.staffName || "").toLowerCase().includes(queryText) ||
          String(row.uid || "").toLowerCase().includes(queryText);
        return storeMatch && departmentMatch && statusMatch && searchMatch;
      })
      .sort(
        (a, b) =>
          (a.storeId || "").localeCompare(b.storeId || "") ||
          (a.startPlanned || "").localeCompare(b.startPlanned || "")
      );
  }, [filters, rosterToday, tsByUid, usersByUid]);

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const stats = useMemo(() => {
    const next = { rostered: filteredRows.length, notStarted: 0, working: 0, onBreak: 0, done: 0 };
    filteredRows.forEach((row) => {
      if (!row.ts) next.notStarted += 1;
      else if (row.ts.endActual) next.done += 1;
      else if (row.ts.breakStartActual && !row.ts.breakEndActual) next.onBreak += 1;
      else if (row.ts.startActual) next.working += 1;
    });
    return next;
  }, [filteredRows]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveView() {
    const name = window.prompt("Save this dashboard view as:");
    if (!name?.trim()) return;
    setSavedViews(saveSavedView("dashboard", name.trim(), filters));
    showToast("Dashboard view saved", "success");
  }

  const primaryStockAlerts = useMemo(
    () => dailyStocks.filter((stock) => !stock.adminProcessed).slice(0, 4),
    [dailyStocks]
  );

  return (
    <div className="admdash-wrapper">
      <section className="admdash-shell">
        <header className="admdash-header">
          <div className="admdash-title-area">
            <p className="admdash-kicker">Operations</p>
            <h1 className="admdash-title">Live Dashboard</h1>
            <p className="admdash-subtitle">Real-time status for <b>{today}</b></p>
          </div>

          <div className="admdash-actions">
            <button className="admdash-action-btn" type="button" onClick={handleSaveView}>Save view</button>
            <button
              className={`admdash-action-btn refresh-pill ${loading ? "is-syncing" : ""}`}
              onClick={() => loadToday(true)}
              disabled={loading}
              type="button"
            >
              <svg className="admdash-sync-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
              Sync
            </button>
            <button className="admdash-action-btn view-manager-btn" type="button" onClick={() => navigate("/admin/analytics")}>
              Analytics
            </button>
          </div>
        </header>

        <section className="admdash-stats-row">
          <div className="admdash-stat-card"><span>Rostered</span><strong>{stats.rostered}</strong></div>
          <div className="admdash-stat-card warning"><span>Absent</span><strong>{stats.notStarted}</strong></div>
          <div className="admdash-stat-card success"><span>Working</span><strong>{stats.working}</strong></div>
          <div className="admdash-stat-card break"><span>On Break</span><strong>{stats.onBreak}</strong></div>
          <div className="admdash-stat-card blue"><span>Done</span><strong>{stats.done}</strong></div>
        </section>

        <section className="admdash-filters">
          <select className="admdash-select" value={filters.storeId} onChange={(e) => updateFilter("storeId", e.target.value)}>
            <option value="all">All Stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>{store.label}</option>
            ))}
          </select>
          <select className="admdash-select" value={filters.department} onChange={(e) => updateFilter("department", e.target.value)}>
            <option value="all">All Departments</option>
            <option value="shop">Shop</option>
            <option value="kitchen">Kitchen</option>
            <option value="manager">Manager</option>
          </select>
          <select className="admdash-select" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="stNot">Absent</option>
            <option value="stWork">Clocked In</option>
            <option value="stBreak">On Break</option>
            <option value="stDone">Finished</option>
          </select>
          <div className="admdash-search-box">
            <input placeholder="Search staff..." value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} />
          </div>
        </section>

        {savedViews.length > 0 ? (
          <section className="admdash-saved-row">
            {savedViews.map((view) => (
              <div key={view.id} className="admdash-saved-chip">
                <button type="button" onClick={() => setFilters(view.filters)}>{view.name}</button>
                <button type="button" onClick={() => setSavedViews(deleteSavedView("dashboard", view.id))}>×</button>
              </div>
            ))}
          </section>
        ) : null}

        <section className="admdash-content-grid">
          <aside className="admdash-side-rail">
            <section className="admdash-stock-section compact">
              <div className="admdash-stock-header compact">
                <h3>Stock Alerts</h3>
                <button className="admdash-text-link" onClick={() => navigate("/admin/stock-manager")} type="button">
                  Open
                </button>
              </div>
              <div className="admdash-stock-grid compact">
                {dailyStocks.length === 0 ? (
                  <div className="app-empty-state compact">
                    <div className="app-empty-icon">□</div>
                    <h2>No stock requests yet</h2>
                    <p>Fresh stock issues for today will show up here.</p>
                  </div>
                ) : (
                  primaryStockAlerts.map((stock) => (
                    <div
                      key={stock.id}
                      className={`admdash-stock-pill ${stock.adminProcessed ? "is-processed" : "is-pending"}`}
                      onClick={() => navigate("/admin/stock-manager")}
                    >
                      <span className="admdash-stock-shop">{stock.storeLabel}</span>
                      <span className="admdash-stock-status">
                        {stock.adminProcessed ? "Processed" : "New Request"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="admdash-summary-card">
              <div className="admdash-panel-head slim">
                <div>
                  <h3>Quick Summary</h3>
                  <p>Today at a glance</p>
                </div>
              </div>
              <div className="admdash-summary-grid">
                <div className="admdash-summary-item">
                  <span>Stores</span>
                  <strong>{filters.storeId === "all" ? stores.length : 1}</strong>
                </div>
                <div className="admdash-summary-item">
                  <span>Reqs</span>
                  <strong>{dailyStocks.length}</strong>
                </div>
                <div className="admdash-summary-item">
                  <span>Pending</span>
                  <strong>{dailyStocks.filter((stock) => !stock.adminProcessed).length}</strong>
                </div>
                <div className="admdash-summary-item">
                  <span>Visible</span>
                  <strong>{filteredRows.length}</strong>
                </div>
              </div>
            </section>
          </aside>

          <div className="admdash-live-board">
            <div className="admdash-panel-head">
              <div>
                <h2>Live Staff Board</h2>
                <p>{filteredRows.length} staff visible</p>
              </div>
            </div>

            <div className="admdash-table-wrap">
              {loading ? (
                <div className="app-inline-loader">
                  <div className="spinner" />
                  <span>Loading today&apos;s live board...</span>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="app-empty-state compact">
                  <div className="app-empty-icon">⌕</div>
                  <h2>No staff match this view</h2>
                  <p>Try a different store, department, or status filter.</p>
                </div>
              ) : (
                <div className="admdash-list compact">
                  {visibleRows.map((row) => (
                    <div key={row.id} className="admdash-row-card compact">
                      <div className="admdash-row-primary">
                        <div className="admdash-staff-identity">
                          <span className="admdash-staff-name">{row.staffName || "Unknown"}</span>
                          <span className="admdash-store-tag">{getStoreLabel(row.storeId)}</span>
                        </div>
                        <div className={`admdash-status-badge ${row.statusCls}`}>{row.statusLabel}</div>
                      </div>

                      <div className="admdash-row-details compact">
                        <div className="admdash-detail-item"><label>Planned</label><span>{row.startPlanned} - {row.endPlanned}</span></div>
                        <div className="admdash-detail-item"><label>Dept</label><span>{row.department || "-"}</span></div>
                        <div className="admdash-detail-item"><label>In</label><span>{fmtTime(row.ts?.startActual)}</span></div>
                        <div className="admdash-detail-item"><label>Out</label><span>{fmtTime(row.ts?.endActual)}</span></div>
                      </div>
                    </div>
                  ))}
                  {visibleCount < filteredRows.length ? (
                    <button className="admdash-load-more" type="button" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                      Load more
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
