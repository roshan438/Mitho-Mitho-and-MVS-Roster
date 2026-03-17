










import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { addDays, getWeekStartMonday, toYMD } from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import { createNotification } from "../../utils/notifications";
import "./Audit.css";

function fmtTime(ts) {
  if (!ts || !ts.toDate) return "-";
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesBetween(a, b) {
  if (!a?.toDate || !b?.toDate) return null;
  const ms = b.toDate().getTime() - a.toDate().getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function inputBreakMinutes(bStart, bEnd) {
  const toMin = (hm) => {
    if (!hm) return null;
    const [h, m] = String(hm).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const s = toMin(bStart);
  const e = toMin(bEnd);
  if (s == null || e == null) return null;
  let diff = e - s;
  if (diff < 0) diff += 1440;
  return Math.max(0, diff);
}

function tsToLocalInput(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToTimestamp(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

export default function Audit() {
  const { fbUser } = useAuth();
  const { showToast } = useToast();
  const { stores, getStoreLabel } = useStores();
  const [preset, setPreset] = useState("week");
  const [dateFrom, setDateFrom] = useState(toYMD(getWeekStartMonday(new Date())));
  const [dateTo, setDateTo] = useState(toYMD(addDays(getWeekStartMonday(new Date()), 7)));
  const [storeId, setStoreId] = useState("all");
  const [employeeUid, setEmployeeUid] = useState("all");
  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffByUid, setStaffByUid] = useState({});
  const [openEditorId, setOpenEditorId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [openStaffUid, setOpenStaffUid] = useState(null);
  const [edit, setEdit] = useState({
    auditStatus: "none",
    adminNote: "",
    start: "",
    breakStart: "",
    breakEnd: "",
    end: "",
  });

  const finishedCount = timesheets.filter((t) => t.effEnd).length;
  const reviewedCount = timesheets.filter((t) => t.auditStatus === "reviewed").length;
  const approvedCount = timesheets.filter((t) => t.auditStatus === "approved").length;

  const groupedTimesheets = useMemo(() => {
    const groups = new Map();

    timesheets.forEach((timesheet) => {
      const key = timesheet.uid || timesheet.staffName || timesheet.id;
      if (!groups.has(key)) {
        groups.set(key, {
          uid: timesheet.uid || key,
          staffName: timesheet.staffName,
          storeLabel: getStoreLabel(timesheet.storeId),
          logs: [],
          total: 0,
          approved: 0,
          reviewed: 0,
        });
      }

      const group = groups.get(key);
      group.logs.push(timesheet);
      group.total += 1;
      if (timesheet.auditStatus === "approved") group.approved += 1;
      if (timesheet.auditStatus === "reviewed") group.reviewed += 1;
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        logs: [...group.logs].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      }))
      .sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [getStoreLabel, timesheets]);

  const loadStaffList = useCallback(async () => {
    try {
      const qs = query(collection(db, "users"), where("role", "==", "staff"), where("status", "==", "approved"));
      const snap = await getDocs(qs);
      const list = snap.docs.map(d => ({
        uid: d.id,
        name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim() || d.data().email
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      const map = {};
      list.forEach(x => map[x.uid] = x.name);
      setStaffList(list);
      setStaffByUid(map);
    } catch (e) {
      showToast("Staff load failed", "error");
    }
  }, [showToast]);

  const loadAudit = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      let qTs = query(collection(db, "timesheets"), where("date", ">=", dateFrom), where("date", "<", dateTo));
      if (employeeUid !== "all") {
        qTs = query(collection(db, "timesheets"), where("uid", "==", employeeUid), where("date", ">=", dateFrom), where("date", "<", dateTo));
      }
      
      const snap = await getDocs(qTs);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (storeId !== "all") list = list.filter(x => x.storeId === storeId);

      list = list.map(t => {
        const eff = (k) => t.actualOverrides?.[k] || t[k] || null;
        const start = eff("startActual");
        const bStart = eff("breakStartActual");
        const bEnd = eff("breakEndActual");
        const end = eff("endActual");

        return {
          ...t,
          staffName: staffByUid[t.uid] || t.staffName || "Unknown",
          startActualFmt: fmtTime(start),
          breakMinutes: minutesBetween(bStart, bEnd),
          endActualFmt: fmtTime(end),
          effStart: start, effBreakStart: bStart, effBreakEnd: bEnd, effEnd: end,
          breakInputMinutes: inputBreakMinutes(t.breakStartInput, t.breakEndInput),
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      setTimesheets(list);
      if (isManual) showToast("Audit logs updated", "success");
    } catch (e) {
      showToast("Error fetching logs", "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, storeId, employeeUid, staffByUid, showToast]);

  useEffect(() => { loadStaffList(); }, [loadStaffList]);
  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => {
    const now = new Date();
    if (preset === "day") {
      setDateFrom(toYMD(now));
      setDateTo(toYMD(addDays(now, 1)));
    } else if (preset === "week") {
      const ws = getWeekStartMonday(now);
      setDateFrom(toYMD(ws));
      setDateTo(toYMD(addDays(ws, 7)));
    }
  }, [preset]);

  const saveEditor = async (t) => {
    if (!fbUser) return showToast("Unauthorized", "error");
    setSavingId(t.id);
    try {
      const patch = {
        auditStatus: edit.auditStatus,
        adminNote: edit.adminNote,
        auditUpdatedAt: serverTimestamp(),
        auditUpdatedBy: fbUser.uid,
        actualOverrides: {
          startActual: localInputToTimestamp(edit.start),
          breakStartActual: localInputToTimestamp(edit.breakStart),
          breakEndActual: localInputToTimestamp(edit.breakEnd),
          endActual: localInputToTimestamp(edit.end),
        }
      };
      await updateDoc(doc(db, "timesheets", t.id), patch);
      if (t.uid && ["approved", "reviewed"].includes(edit.auditStatus)) {
        await createNotification(db, {
          uid: t.uid,
          title: edit.auditStatus === "approved" ? "Timesheet approved" : "Timesheet reviewed",
          message: `Your timesheet for ${t.date} at ${getStoreLabel(t.storeId)} was ${edit.auditStatus}.`,
          type: edit.auditStatus === "approved" ? "success" : "info",
          link: "/staff/my-timesheets",
          metadata: {
            timesheetId: t.id,
            status: edit.auditStatus,
          },
        });
      }
      showToast("Saved successfully", "success");
      setOpenEditorId(null);
      loadAudit();
    } catch (e) {
      showToast("Save failed", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="audit-page">
      <header className="audit-topbar">
        <div className="audit-header-text">
          <p className="audit-kicker">Operations</p>
          <h1 className="audit-title">Audit Logs</h1>
          <span className="audit-subtitle">Verify & override timestamps</span>
        </div>
        <button className={`audit-refresh-btn ${loading ? 'spinning' : ''}`} onClick={() => loadAudit(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </header>

      <main className="audit-main">
        <section className="audit-filter-shell">
          <div className="audit-preset-tabs">
            {["day", "week", "custom"].map((p) => (
              <button key={p} className={`audit-preset-btn ${preset === p ? "active" : ""}`} onClick={() => setPreset(p)}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="audit-custom-row animate-slide-down">
              <div className="audit-field">
                <label>From</label>
                <input type="date" className="app-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="audit-field">
                <label>To (Excl)</label>
                <input type="date" className="app-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="audit-filter-grid">
            <div className="audit-field">
              <label>Store</label>
              <select className="app-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="all">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="audit-field">
              <label>Staff</label>
              <select className="app-input" value={employeeUid} onChange={(e) => setEmployeeUid(e.target.value)}>
                <option value="all">All Staff</option>
                {staffList.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="audit-summary-row">
          <div className="audit-summary-tile">
            <label>Total Logs</label>
            <div className="value">{timesheets.length}</div>
          </div>
          <div className="audit-summary-tile">
            <label>Finished</label>
            <div className="value warn">{finishedCount}</div>
          </div>
          <div className="audit-summary-tile">
            <label>Reviewed</label>
            <div className="value">{reviewedCount}</div>
          </div>
          <div className="audit-summary-tile">
            <label>Approved</label>
            <div className="value">{approvedCount}</div>
          </div>
        </section>

        <div className="audit-list-panel">
          {loading ? (
            <div className="audit-empty"><div className="spinner"></div><span>Loading...</span></div>
          ) : timesheets.length === 0 ? (
            <div className="audit-empty"><p>No data found.</p></div>
          ) : (
            groupedTimesheets.map((group) => (
              <section key={group.uid} className="audit-staff-group">
                <button
                  type="button"
                  className="audit-staff-header"
                  onClick={() =>
                    setOpenStaffUid((current) => (current === group.uid ? null : group.uid))
                  }
                >
                  <div className="audit-staff-title-wrap">
                    <span className="audit-person-name">{group.staffName}</span>
                    <span className="audit-person-meta">{group.storeLabel}</span>
                  </div>
                  <div className="audit-staff-summary">
                    <span className="audit-mini-chip">{group.total} logs</span>
                    <span className="audit-mini-chip ok">{group.approved} ok</span>
                    <span className="audit-mini-chip warn">{group.reviewed} rev</span>
                    <span className="audit-expand-label">{openStaffUid === group.uid ? "Hide" : "Open"}</span>
                  </div>
                </button>

                {openStaffUid === group.uid && (
                  <div className="audit-staff-log-list">
                    {group.logs.map((t) => (
                      <div key={t.id} className={`audit-log-row ${openEditorId === t.id ? 'is-editing' : ''}`}>
                        <button className="audit-log-header" type="button" onClick={() => {
                          if (openEditorId === t.id) setOpenEditorId(null);
                          else {
                            setOpenEditorId(t.id);
                            setEdit({
                              auditStatus: t.auditStatus || "none",
                              adminNote: t.adminNote || "",
                              start: tsToLocalInput(t.effStart),
                              breakStart: tsToLocalInput(t.effBreakStart),
                              breakEnd: tsToLocalInput(t.effBreakEnd),
                              end: tsToLocalInput(t.effEnd),
                            });
                          }
                        }}>
                          <div className="audit-person-col">
                            <span className="audit-log-date">{t.date}</span>
                          </div>
                          <div className="audit-metric-row">
                            <span className="audit-metric"><small>In</small><strong>{t.startActualFmt}</strong></span>
                            <span className="audit-metric"><small>Break</small><strong>{t.breakMinutes ?? 0}m</strong></span>
                            <span className="audit-metric"><small>Out</small><strong>{t.endActualFmt}</strong></span>
                          </div>
                          <div className="audit-status-col">
                             <span className={`audit-chip ${t.auditStatus === 'approved' ? 'ok' : t.auditStatus === 'reviewed' ? 'warn' : ''}`}>
                                {t.auditStatus || 'Unmarked'}
                             </span>
                             <span className="audit-expand-label">{openEditorId === t.id ? "Hide" : "Edit"}</span>
                          </div>
                        </button>

                        <div className="audit-log-body">
                           <div className="audit-compare-grid">
                              <div className="audit-compare-box">
                                <label>Clock On</label>
                                <span className="audit-actual">{t.startActualFmt}</span>
                                <span className="audit-typed">Typed: {t.startInput || '--'}</span>
                              </div>
                              <div className="audit-compare-box">
                                <label>Break</label>
                                <span className="audit-actual">{t.breakMinutes ?? 0}m</span>
                                <span className="audit-typed">Typed: {t.breakInputMinutes ?? 0}m</span>
                              </div>
                              <div className="audit-compare-box">
                                <label>Clock Off</label>
                                <span className="audit-actual">{t.endActualFmt}</span>
                                <span className="audit-typed">Typed: {t.endInput || '--'}</span>
                              </div>
                           </div>

                           {openEditorId === t.id && (
                             <div className="audit-editor animate-slide-down">
                                <div className="audit-edit-field">
                                   <label>Status</label>
                                   <select className="app-input" value={edit.auditStatus} onChange={e => setEdit(p => ({...p, auditStatus: e.target.value}))}>
                                      <option value="none">Unmarked</option>
                                      <option value="reviewed">Reviewed</option>
                                      <option value="approved">Approved</option>
                                   </select>
                                </div>
                                <div className="audit-edit-field">
                                   <label>Admin Note</label>
                                   <textarea className="app-input" value={edit.adminNote} onChange={e => setEdit(p => ({...p, adminNote: e.target.value}))} placeholder="Internal notes..."/>
                                </div>
                                <div className="audit-override-grid">
                                   <div className="audit-field-box"><label>Start</label><input type="datetime-local" className="app-input" value={edit.start} onChange={e=>setEdit(p=>({...p, start: e.target.value}))}/></div>
                                   <div className="audit-field-box"><label>End</label><input type="datetime-local" className="app-input" value={edit.end} onChange={e=>setEdit(p=>({...p, end: e.target.value}))}/></div>
                                </div>
                                <div className="audit-editor-actions">
                                   <button className="audit-btn audit-btn-secondary" onClick={() => setOpenEditorId(null)}>Cancel</button>
                                   <button className="audit-btn audit-btn-primary" onClick={() => saveEditor(t)} disabled={savingId === t.id}>
                                     {savingId === t.id ? "Saving..." : "Apply"}
                                   </button>
                                </div>
                             </div>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
