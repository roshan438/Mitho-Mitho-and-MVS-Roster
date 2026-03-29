






import { useEffect, useMemo, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { subDays, addDays, getWeekStartMonday, prettyDate, toYMD, weekDates } from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext"; // Import Toast Hook
import "./MyRoster.css";
import { prettyTime } from "../../utils/dates";
import {
  getShiftRequestStatusLabel,
  isFutureOrToday,
  isShiftRequestActive,
  SHIFT_REQUEST_STATUS,
} from "../../utils/shiftRequests";

export default function MyRoster() {
  const { fbUser } = useAuth();
  const { showToast } = useToast(); // Initialize Toast
  const { getStoreLabel } = useStores();
  const uid = fbUser?.uid;

  const [weekStart, setWeekStart] = useState(toYMD(getWeekStartMonday(new Date())));
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState([]);
  const [shiftRequests, setShiftRequests] = useState([]);
  const [requestingShiftId, setRequestingShiftId] = useState(null);
  const [claimingRequestId, setClaimingRequestId] = useState(null);

  const weekStartDateObj = useMemo(() => new Date(weekStart + "T00:00:00"), [weekStart]);
  const days = useMemo(() => weekDates(weekStartDateObj), [weekStartDateObj]);

  const loadMyWeek = useCallback(async (silent = false) => {
    if (!uid) return;
    if (!silent) setLoading(true);

    try {
      const startYMD = weekStart;
      const endYMD = toYMD(addDays(weekStartDateObj, 7));
      const requestWindowStart = toYMD(subDays(weekStartDateObj, 14));

      const q = query(
        collectionGroup(db, "shifts"),
        where("uid", "==", uid),
        where("date", ">=", startYMD),
        where("date", "<", endYMD)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        weekKey: d.ref.parent.parent?.id || "",
        ...d.data(),
      }))
        .sort((a, b) => (a.date + a.startPlanned).localeCompare(b.date + b.startPlanned));

      setShifts(list);

      const requestSnap = await getDocs(
        query(
          collection(db, "shiftRequests"),
          where("shiftDate", ">=", requestWindowStart),
          orderBy("shiftDate", "desc"),
          limit(80)
        )
      );

      const requestList = requestSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const aCreated = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bCreated = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bCreated - aCreated;
        });

      setShiftRequests(requestList);
      if (silent) showToast("Roster updated", "success");
    } catch (e) {
      console.error("Roster Load Error:", e);
      showToast("Failed to load your roster", "error");
    } finally {
      setLoading(false);
    }
  }, [uid, weekStart, weekStartDateObj, showToast]);

  useEffect(() => {
    loadMyWeek();
  }, [loadMyWeek]);

  const shiftsForDate = (ymd) => shifts.filter((s) => s.date === ymd);
  const activeRequestByShiftId = useMemo(() => {
    const map = {};
    shiftRequests.forEach((request) => {
      if (!request.shiftId || !isShiftRequestActive(request.status)) return;
      map[request.shiftId] = request;
    });
    return map;
  }, [shiftRequests]);

  const myShiftRequests = useMemo(() => {
    return shiftRequests.filter((request) => request.requestorUid === uid).slice(0, 5);
  }, [shiftRequests, uid]);

  const openShiftRequests = useMemo(() => {
    return shiftRequests.filter(
      (request) =>
        request.requestorUid !== uid &&
        request.status === SHIFT_REQUEST_STATUS.open &&
        isFutureOrToday(request.shiftDate)
    );
  }, [shiftRequests, uid]);

  async function submitShiftRequest(shift) {
    if (!uid) return;

    setRequestingShiftId(shift.id);
    try {
      await addDoc(collection(db, "shiftRequests"), {
        requestorUid: uid,
        requestorName: shift.staffName || fbUser?.email || uid,
        shiftId: shift.id,
        shiftWeekKey: shift.weekKey || "",
        shiftDate: shift.date,
        shiftStart: shift.startPlanned,
        shiftEnd: shift.endPlanned,
        storeId: shift.storeId || "",
        storeLabel: getStoreLabel(shift.storeId),
        status: SHIFT_REQUEST_STATUS.pending,
        note: "Staff requested release/swap",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast("Shift request submitted", "success");
      await loadMyWeek(true);
    } catch (error) {
      console.error(error);
      showToast("Failed to submit shift request", "error");
    } finally {
      setRequestingShiftId(null);
    }
  }

  async function claimOpenShift(request) {
    if (!uid) return;

    setClaimingRequestId(request.id);
    try {
      await updateDoc(doc(db, "shiftRequests", request.id), {
        status: SHIFT_REQUEST_STATUS.claimed,
        claimantUid: uid,
        claimantName: fbUser?.displayName || fbUser?.email || uid,
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast("Shift claim sent for approval", "success");
      await loadMyWeek(true);
    } catch (error) {
      console.error(error);
      showToast("Failed to claim open shift", "error");
    } finally {
      setClaimingRequestId(null);
    }
  }

  return (
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">My Roster</h1>
          <span className="subtitle">Weekly Schedule</span>
        </div>
        <button 
          className={`refresh-circle ${loading ? 'spinning' : ''}`} 
          onClick={() => loadMyWeek(true)} // Manual refresh triggers toast
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </header>
  
      <main className="scroll-content">
        <section className="date-nav">
          <div className="date-display calendar-shell">
            <span className="calendar-label">Week Starting</span>
            <input 
              className="date-picker-minimal" 
              type="date" 
              value={weekStart} 
              onChange={(e) => setWeekStart(e.target.value)} 
            />
          </div>
  
          <div className="button-group">
            <button className="pill-btn" onClick={() => setWeekStart(toYMD(subDays(weekStartDateObj, 7)))}>
              Prev
            </button>
            <button 
              className={`pill-btn ${weekStart === toYMD(getWeekStartMonday(new Date())) ? 'active' : ''}`} 
              onClick={() => setWeekStart(toYMD(getWeekStartMonday(new Date())))}
            >
              This Week
            </button>
            <button className="pill-btn" onClick={() => setWeekStart(toYMD(addDays(weekStartDateObj, 7)))}>
              Next
            </button>
          </div>
        </section>

        <section className="roster-section dual-grid">
          <div className="panel-card">
            <div className="section-heading">
              <h2>My Shift Requests</h2>
              <p>Swaps & releases</p>
            </div>

            {myShiftRequests.length === 0 ? (
              <div className="app-empty-state compact">
                <div className="app-empty-icon">↔</div>
                <h2>No shift requests yet</h2>
                <p>Your swap and release requests will show up here.</p>
              </div>
            ) : (
              <div className="mini-request-list">
                {myShiftRequests.map((request) => (
                  <div key={request.id} className="mini-request-card">
                    <div>
                      <strong>{request.shiftDate}</strong>
                      <span>
                        {prettyTime(request.shiftStart)} - {prettyTime(request.shiftEnd)}
                      </span>
                    </div>
                    <span className={`mini-status ${request.status || "pending"}`}>
                      {getShiftRequestStatusLabel(request.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-card">
            <div className="section-heading">
              <h2>Open Shifts</h2>
              <p>Claim extras</p>
            </div>

            {openShiftRequests.length === 0 ? (
              <div className="app-empty-state compact">
                <div className="app-empty-icon">+</div>
                <h2>No open shifts right now</h2>
                <p>Extra shifts available to claim will appear here first.</p>
              </div>
            ) : (
              <div className="open-shift-list">
                {openShiftRequests.slice(0, 5).map((request) => (
                  <article key={request.id} className="open-shift-card">
                    <div>
                      <strong>{request.shiftDate}</strong>
                      <p>
                        {request.storeLabel || getStoreLabel(request.storeId)} •{" "}
                        {prettyTime(request.shiftStart)} - {prettyTime(request.shiftEnd)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="claim-btn"
                      disabled={claimingRequestId === request.id}
                      onClick={() => claimOpenShift(request)}
                    >
                      {claimingRequestId === request.id ? "Claiming..." : "Claim"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
  
        <div className="timeline">
          {loading ? (
            <div className="app-inline-loader">
              <div className="spinner"></div>
              <span>Searching shifts...</span>
            </div>
          ) : (
            days.map((d) => {
              const ymd = toYMD(d);
              const dayShifts = shiftsForDate(ymd);
              const isToday = ymd === toYMD(new Date());
      
              return (
                <div key={ymd} className={`timeline-card ${isToday ? 'is-today' : ''} ${dayShifts.length > 0 ? 'has-data' : ''}`}>
                  <div className="card-side">
                    <span className="day-abbr">{prettyDate(d).split(',')[0].substring(0, 3)}</span>
                    <span className="day-num">{d.getDate()}</span>
                  </div>
      
                  <div className="card-main">
                    {dayShifts.length === 0 ? (
                      <span className="no-entry">Day Off</span>
                    ) : (
                      dayShifts.map((s) => (
                        <div key={s.id} className="shift-entry">
                          <div className="shift-accent" />
                          <div className="shift-details">
                            <div className="store-tag">{getStoreLabel(s.storeId)}</div>
                            <div className="shift-time">
                              {prettyTime(s.startPlanned)} — {prettyTime(s.endPlanned)}
                            </div>
                          </div>
                          {isFutureOrToday(s.date) && (
                            <button
                              type="button"
                              className="shift-action-btn"
                              disabled={Boolean(activeRequestByShiftId[s.id]) || requestingShiftId === s.id}
                              onClick={() => submitShiftRequest(s)}
                            >
                              {requestingShiftId === s.id
                                ? "Sending..."
                                : activeRequestByShiftId[s.id]
                                ? getShiftRequestStatusLabel(activeRequestByShiftId[s.id].status)
                                : "Request Swap"}
                            </button>
                          )}
                        </div>
                      ))
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
