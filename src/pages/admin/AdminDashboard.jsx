





















import { useEffect, useMemo, useState, useCallback } from "react";
import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import { useNavigate } from "react-router-dom"; // ✅ Added for navigation
import "./AdminDashboard.css";


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

export default function AdminDashboard() {
  const { showToast } = useToast();
  const navigate = useNavigate(); // ✅ Hook for moving to Stock Manager
  const { stores, getStoreLabel } = useStores();
  const today = useMemo(() => toYMD(new Date()), []);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rosterToday, setRosterToday] = useState([]);
  const [tsByUid, setTsByUid] = useState({});
  const [dailyStocks, setDailyStocks] = useState([]);

  const loadToday = useCallback(
    async (manual = false) => {
      setLoading(true);
      try {
        const rosterQ = query(collectionGroup(db, "shifts"), where("date", "==", today));
        const rosterSnap = await getDocs(rosterQ);
        const roster = rosterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const tsQ = query(collection(db, "timesheets"), where("date", "==", today));
        const tsSnap = await getDocs(tsQ);
        const map = {};
        tsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.uid) map[data.uid] = data;
        });
        const stockQ = query(collection(db, "dailyStockTake"), where("date", "==", today));
        const stockSnap = await getDocs(stockQ);
        const stocks = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setRosterToday(roster);
        setTsByUid(map);
        setDailyStocks(stocks);

        if (manual) showToast("Data synced successfully", "success");
      } catch (e) {
        console.error(e);
        showToast("Failed to sync dashboard data", "error");
      } finally {
        setLoading(false);
      }
    },
    [today, showToast]
  );

  useEffect(() => {
    loadToday(false);
  }, [loadToday]);

  const filteredRows = useMemo(() => {
    let rows = rosterToday;
    if (storeFilter !== "all") rows = rows.filter((r) => r.storeId === storeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.staffName || "").toLowerCase().includes(q) ||
          (r.uid || "").toLowerCase().includes(q)
      );
    }
    return rows
      .map((r) => {
        const ts = tsByUid[r.uid] || null;
        const st = statusFromTimesheet(ts);
        return { ...r, ts, statusLabel: st.label, statusCls: st.cls };
      })
      .sort((a, b) => (a.storeId || "").localeCompare(b.storeId || "") || (a.startPlanned || "").localeCompare(b.startPlanned || ""));
  }, [rosterToday, storeFilter, search, tsByUid]);

  const stats = useMemo(() => {
    const s = { rostered: filteredRows.length, notStarted: 0, working: 0, onBreak: 0, done: 0 };
    filteredRows.forEach((r) => {
      if (!r.ts) s.notStarted++;
      else if (r.ts.endActual) s.done++;
      else if (r.ts.breakStartActual && !r.ts.breakEndActual) s.onBreak++;
      else if (r.ts.startActual) s.working++;
    });
    return s;
  }, [filteredRows]);

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
            <button
              className={`admdash-action-btn refresh-pill ${loading ? "spinning" : ""}`}
              onClick={() => loadToday(true)}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
              Sync
            </button>
            <button className="admdash-action-btn view-manager-btn" onClick={() => navigate("/admin/stock-manager")}>
              Stock
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
          <select className="admdash-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
            <option value="all">All Stores</option>
            {stores.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </select>

          <div className="admdash-search-box">
            <input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </section>

        <section className="admdash-content-grid">
          <aside className="admdash-side-rail">
            <section className="admdash-stock-section compact">
              <div className="admdash-stock-header compact">
                <h3>Stock Alerts</h3>
                <button className="admdash-text-link" onClick={() => navigate("/admin/stock-manager")}>
                  Open
                </button>
              </div>
              <div className="admdash-stock-grid compact">
                {dailyStocks.length === 0 ? (
                  <div className="admdash-empty-block">No stock requests submitted today yet.</div>
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
                  <strong>{storeFilter === "all" ? stores.length : 1}</strong>
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
                  <span>Live</span>
                  <strong>{stats.rostered - stats.notStarted}</strong>
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
                <div className="admdash-empty-block"><div className="spinner" /></div>
              ) : filteredRows.length === 0 ? (
                <div className="admdash-empty-block">No shifts found for today.</div>
              ) : (
                <div className="admdash-list compact">
                  {filteredRows.map((r) => (
                    <div key={r.id} className="admdash-row-card compact">
                      <div className="admdash-row-primary">
                        <div className="admdash-staff-identity">
                          <span className="admdash-staff-name">{r.staffName || "Unknown"}</span>
                          <span className="admdash-store-tag">{getStoreLabel(r.storeId)}</span>
                        </div>
                        <div className={`admdash-status-badge ${r.statusCls}`}>{r.statusLabel}</div>
                      </div>

                      <div className="admdash-row-details compact">
                        <div className="admdash-detail-item"><label>Planned</label><span>{r.startPlanned} - {r.endPlanned}</span></div>
                        <div className="admdash-detail-item"><label>In</label><span>{fmtTime(r.ts?.startActual)}</span></div>
                        <div className="admdash-detail-item"><label>Out</label><span>{fmtTime(r.ts?.endActual)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
