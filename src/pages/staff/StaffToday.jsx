























import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collectionGroup,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  getDoc,
  collection,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { STORES as LEGACY_STORES } from "../../utils/constants";
import { prettyTime, toYMD } from "../../utils/dates";
import { findKitchenSession, loadKitchenStoreSettings } from "../../utils/kitchenQuickStockTake";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import QRScanner from "../../components/QRScanner";
import ClearableTimeInput from "../../components/ClearableTimeInput";
import { useNavigate } from "react-router-dom";
import "./StaffToday.css";
const getLegacyStoreMeta = (sId) => LEGACY_STORES.find((s) => s.id === sId) || null;

const hmToMinutes = (hm) => {
  if (!hm) return null;
  const [h, m] = String(hm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

function haversineMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function getCurrentPositionPromise(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function parseQrPayload(text) {
  try {
    const obj = JSON.parse(String(text || ""));
    if (obj && obj.v === 1 && obj.storeId && obj.code) return obj;
  } catch {
    return null;
  }
  return null;
}


function parseStockBulkText(text) {
  if (!text?.trim()) return [];

  const lines = text.split("\n");
  const parsed = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\s+/);

    let qty = 1;
    let nameParts = [...parts];

    const lastPart = parts[parts.length - 1];
    if (!isNaN(lastPart)) {
      qty = Number(lastPart);
      nameParts.pop();
    }

    const name = nameParts.join(" ");

    if (!name) {
      throw new Error(`Missing item name on line ${i + 1}`);
    }
    if (/\d/.test(name)) {
      throw new Error(
        `Item name cannot contain numbers (line ${i + 1})`
      );
    }

    if (qty <= 0) {
      throw new Error(`Invalid quantity on line ${i + 1}`);
    }

    parsed.push({
      name: name.trim(),
      qtyRequested: qty,
      status: "pending",
      qtySent: 0,
    });
  }

  return parsed;
}

export default function StaffToday() {
  const { fbUser, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const uid = fbUser?.uid;

  const today = useMemo(() => toYMD(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toYMD(d);
  }, []);

  const [loading, setLoading] = useState(true);
  const [todayShift, setTodayShift] = useState(null);
  const [timesheet, setTimesheet] = useState(null);
  const [dbItems, setDbItems] = useState([]);
  const [, setStockDraft] = useState([]);
  const [allStoreRequests, setAllStoreRequests] = useState([]);
  const [stockTakeDone, setStockTakeDone] = useState(false);
  const [isAdminProcessed, setIsAdminProcessed] = useState(false);

  const [showStockModal, setShowStockModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [activeKitchenDispatch, setActiveKitchenDispatch] = useState(null);
  const [submittingStock, setSubmittingStock] = useState(false);
  const [storeClosingTime, setStoreClosingTime] = useState("");
  const [radiusM, setRadiusM] = useState(3000);
  const [storeMeta, setStoreMeta] = useState(null);
  const [geo, setGeo] = useState(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [qrExpectedObj, setQrExpectedObj] = useState(null);
  const [qrInput, setQrInput] = useState("");

  const [startInput, setStartInput] = useState("");
  const [breakStartInput, setBreakStartInput] = useState("");
  const [breakEndInput, setBreakEndInput] = useState("");
  const [endInput, setEndInput] = useState("");

  const [stockBulkText, setStockBulkText] = useState("");

  const isKitchen = profile?.department === "kitchen" || todayShift?.storeId === "kitchen";
  const distanceM = useMemo(() => {
    if (!geo || !storeMeta?.lat || !storeMeta?.lng) return null;
    return Math.round(haversineMeters(geo.lat, geo.lng, storeMeta.lat, storeMeta.lng));
  }, [geo, storeMeta]);

  const geoOk = useMemo(() => {
    if (!geo) return false;
    return distanceM <= radiusM && (geo.accuracy ?? 999) <= 150;
  }, [geo, distanceM, radiusM]);

  const qrOk = useMemo(() => {
    if (isKitchen) return true;
    if (!qrExpectedObj) return false;

    const raw = String(qrInput || "").trim();
    const scannedObj = parseQrPayload(raw);

    if (scannedObj) {
      return (
        String(scannedObj.storeId) === String(todayShift?.storeId) &&
        String(scannedObj.code) === String(qrExpectedObj.code)
      );
    }
    return raw === String(qrExpectedObj.code);
  }, [qrInput, qrExpectedObj, todayShift, isKitchen]);

  const canClockOn = useMemo(() => geoOk && qrOk, [geoOk, qrOk]);
  const isClosingShift = useMemo(() => {
    if (isKitchen) return false;

    const shiftEnd = hmToMinutes(todayShift?.endPlanned);
    const closingEnd = hmToMinutes(storeClosingTime);

    if (shiftEnd == null || closingEnd == null) return false;

    return shiftEnd >= closingEnd;
  }, [todayShift?.endPlanned, storeClosingTime, isKitchen]);

  const stockRequiredForClockOff = !isKitchen && isClosingShift;
  const canOpenKitchenStockTake = useMemo(
    () =>
      String(profile?.department || todayShift?.department || "").toLowerCase() === "kitchen" &&
      Boolean(todayShift?.storeId) &&
      Boolean(timesheet?.startActual) &&
      !timesheet?.endActual,
    [profile?.department, timesheet?.endActual, timesheet?.startActual, todayShift?.department, todayShift?.storeId]
  );
  const refreshLocation = useCallback(async () => {
    setGeoBusy(true);
    try {
      const res = await getCurrentPositionPromise({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      setGeo({
        lat: res.coords.latitude,
        lng: res.coords.longitude,
        accuracy: res.coords.accuracy,
      });
    } catch {
      setGeo(null);
    } finally {
      setGeoBusy(false);
    }
  }, []);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const rosterQ = query(
        collectionGroup(db, "shifts"),
        where("uid", "==", uid),
        where("date", "==", today)
      );
      const rosterSnap = await getDocs(rosterQ);

      if (!rosterSnap.empty) {
        const s = { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() };
        setTodayShift(s);

        const tsSnap = await getDoc(doc(db, "timesheets", `${uid}_${today}`));
        if (tsSnap.exists()) {
          const ts = tsSnap.data();
          setTimesheet(ts);
          setStartInput(ts.startInput || "");
          setBreakStartInput(ts.breakStartInput || "");
          setBreakEndInput(ts.breakEndInput || "");
          setEndInput(ts.endInput || "");
        } else {
          setTimesheet(null);
          setStartInput("");
          setBreakStartInput("");
          setBreakEndInput("");
          setEndInput("");
        }
      } else {
        setTodayShift(null);
        setTimesheet(null);
        setStoreMeta(null);
      }
    } catch (error) {
      console.error("Error loading today shift:", error);
      showToast("Failed to load shift", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, today, uid]);

  const checkStockStatus = useCallback(async (storeId) => {
    if (!storeId) return;

    try {
      const todayDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${today}`));
      if (todayDoc.exists()) {
        setDbItems(todayDoc.data().items || []);
        setIsAdminProcessed(todayDoc.data().adminProcessed || false);
      } else {
        setDbItems([]);
        setIsAdminProcessed(false);
      }
      const tomorrowDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${tomorrow}`));
      if (tomorrowDoc.exists()) {
        setStockTakeDone(true);
        setStockDraft(
          (tomorrowDoc.data().items || []).map((item) => ({
            ...item,
            id: Math.random(),
          }))
        );
      } else {
        setStockTakeDone(false);
        setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]);
      }
    } catch (error) {
      console.error("Error checking stock status:", error);
      showToast("Failed to sync stock status", "error");
    }
  }, [showToast, today, tomorrow]);

  const loadAllStoreRequests = useCallback(async () => {
    const q = query(collection(db, "dailyStockTake"), where("date", "==", today));
    const snap = await getDocs(q);
    setAllStoreRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, [today]);

  const getKitchenDispatchPercent = useCallback((request) => {
    const items = Array.isArray(request?.items) ? request.items : [];
    if (!items.length) return 0;

    const totals = items.reduce(
      (acc, item) => {
        const requested = Math.max(Number(item.qtyRequested) || 0, 0);
        const sent = Math.max(Number(item.qtySent) || 0, 0);
        acc.requested += requested;
        acc.sent += Math.min(sent, requested);
        return acc;
      },
      { requested: 0, sent: 0 }
    );

    if (!totals.requested) return 0;
    return Math.round((totals.sent / totals.requested) * 100);
  }, []);

  const loadStoreQr = useCallback(async (storeId) => {
    try {
      const snap = await getDoc(doc(db, "storeQr", storeId));
      if (snap.exists()) {
        const data = snap.data();
        setQrExpectedObj(
          data.currentPayload
            ? parseQrPayload(data.currentPayload)
            : { code: data.currentCode }
        );
      } else {
        setQrExpectedObj(null);
      }
    } catch (error) {
      console.error("Error loading QR:", error);
    }
  }, []);

  const loadStoreSettings = useCallback(async (storeId) => {
    try {
      const fallbackStore = getLegacyStoreMeta(storeId);
      setRadiusM(fallbackStore?.radiusM || 3000);
      const settingsSnap = await getDoc(doc(db, "storeSettings", storeId));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (data?.radiusM) setRadiusM(data.radiusM);
      } else if (fallbackStore?.radiusM) {
        setRadiusM(fallbackStore.radiusM);
      }
      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (storeSnap.exists()) {
        const data = storeSnap.data();
        setStoreMeta({
          id: storeId,
          ...fallbackStore,
          ...data,
        });
        if (data?.closingTime) {
          setStoreClosingTime(data.closingTime);
        } else {
          setStoreClosingTime("");
        }
      } else {
        setStoreMeta(fallbackStore);
        setStoreClosingTime("");
      }
    } catch (error) {
      console.error("Error loading store settings:", error);
      setRadiusM(getLegacyStoreMeta(storeId)?.radiusM || 3000);
      setStoreMeta(getLegacyStoreMeta(storeId));
    }
  }, []);

  useEffect(() => {
    if (uid) loadToday();
  }, [loadToday, uid]);

  useEffect(() => {
    if (todayShift?.storeId) {
      loadStoreSettings(todayShift.storeId);
      loadStoreQr(todayShift.storeId);
      checkStockStatus(todayShift.storeId);
      if (isKitchen) loadAllStoreRequests();
      refreshLocation();
    }
  }, [
    checkStockStatus,
    isKitchen,
    loadAllStoreRequests,
    loadStoreQr,
    loadStoreSettings,
    refreshLocation,
    todayShift,
  ]);

  function storeLabel(storeId) {
    return storeMeta?.id === storeId
      ? storeMeta.label || storeId || "-"
      : getLegacyStoreMeta(storeId)?.label || storeId || "-";
  }
  async function doClockOn() {
    if (!canClockOn) return showToast("Verification required", "error");
    if (!startInput) return showToast("Enter start time first", "warning");

    await setDoc(
      doc(db, "timesheets", `${uid}_${today}`),
      {
        uid,
        staffName: profile?.firstName,
        storeId: todayShift.storeId,
        date: today,
        startInput,
        startActual: serverTimestamp(),
        status: "working",
      },
      { merge: true }
    );
    if (String(profile?.department || todayShift?.department || "").toLowerCase() === "kitchen") {
      try {
        const kitchenSettings = await loadKitchenStoreSettings(todayShift.storeId);
        if (kitchenSettings.enabled && kitchenSettings.requireAfterClockOn) {
          const existingSession = await findKitchenSession({
            storeId: todayShift.storeId,
            date: today,
            userId: uid,
            shiftId: todayShift.id,
            completionRule: kitchenSettings.completionRule,
          });

          if (!existingSession || existingSession.status !== "completed") {
            navigate("/staff/kitchen-stock-take", {
              state: { promptedAfterClockOn: true },
            });
          }
        }
      } catch (error) {
        console.error("Kitchen quick stock take prompt failed", error);
      }
    }
    loadToday();
  }

  async function doStartBreak() {
    if (!breakStartInput) return showToast("Enter break start time", "warning");

    await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
      breakStartInput,
      breakStartActual: serverTimestamp(),
      status: "on_break",
    });
    showToast("Break started", "info");
    loadToday();
  }

  async function doEndBreak() {
    if (!breakEndInput) return showToast("Enter break end time", "warning");

    await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
      breakEndInput,
      breakEndActual: serverTimestamp(),
      status: "working",
    });
    showToast("Break ended", "success");
    loadToday();
  }

  async function doClockOff() {
    if (!endInput) return showToast("Enter finish time first", "warning");

    if (isKitchen) {
      const pending = allStoreRequests.some((r) => !r.adminProcessed);
      if (pending) return showToast("Please process all store requests first!", "warning");
    } else if (stockRequiredForClockOff) {
      if (!stockTakeDone) return showToast("Complete tomorrow's stock first!", "error");
    }

    await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
      endInput,
      endActual: serverTimestamp(),
      status: "clocked_out",
    });
    loadToday();
  }
  
  
  
  const handleOpenStockModal = async () => {
    setLoading(true);
    try {
      const tomorrowSnap = await getDoc(
        doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`)
      );
  
      if (tomorrowSnap.exists()) {
        const existingData = tomorrowSnap.data();
        const existingItems = existingData.items || [];
  
        setStockDraft(
          existingItems.map((item) => ({
            ...item,
            id: Math.random(),
          }))
        );
  
        const bulkText = existingItems
          .map((item) => {
            const qty = Number(item.qtyRequested || 1);
            return qty === 1 ? `${item.name}` : `${item.name} ${qty}`;
          })
          .join("\n");
  
        setStockBulkText(bulkText);
      } else {
        setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]);
        setStockBulkText("");
      }
  
      setShowStockModal(true);
    } catch {
      showToast("Error loading existing request", "error");
    } finally {
      setLoading(false);
    }
  };

  

  async function handleStockSubmit() {
    try {
      const finalItems = parseStockBulkText(stockBulkText);
  
      if (finalItems.length === 0) {
        showToast("Please enter at least one item", "error");
        return;
      }
  
      setSubmittingStock(true);
  
      await setDoc(
        doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`),
        {
          storeId: todayShift.storeId,
          storeLabel: storeLabel(todayShift.storeId),
          date: tomorrow,
          lastUpdatedByName: profile?.firstName,
          items: finalItems,
          adminProcessed: false,
        },
        { merge: true }
      );
  
      setStockDraft(
        finalItems.map((item) => ({
          ...item,
          id: Math.random(),
        }))
      );
  
      setStockTakeDone(true);
      setShowStockModal(false);
      showToast("Request Sent", "success");
    } catch (error) {
      showToast(error.message || "Failed to save stock", "error");
    } finally {
      setSubmittingStock(false);
    }
  }
  
  
  
  
  
  
  const handleKitchenQtyChange = (docId, idx, val) => {
    setAllStoreRequests((prev) =>
      prev.map((req) => {
        if (req.id !== docId) return req;
        const newItems = [...req.items];
        newItems[idx].qtySent = Number(val);
        return { ...req, items: newItems };
      })
    );
  };

  const handleKitchenSubmit = async (record) => {
    await updateDoc(doc(db, "dailyStockTake", record.id), {
      items: record.items,
      adminProcessed: true,
      processedAt: serverTimestamp(),
    });
    showToast("Dispatched", "success");
    loadAllStoreRequests();
  };

  if (loading) {
    return (
      <div className="container staff-today-page">
        <div className="card staff-today-card">
          <div className="app-inline-loader">
            <div className="spinner" />
            <span>Loading today&apos;s shift…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container staff-today-page">
      <div className="card staff-today-card">
        <div className="dashboard-header">
          <div className="header-content">
            <h1 className="dashboard-title">Shift Dashboard</h1>
            <p className="dashboard-date">
              {today} {isKitchen && <span className="kitchen-pill">KITCHEN</span>}
            </p>
          </div>

          <div className="header-actions add-item-dash">
            {!isKitchen && timesheet?.startActual 
            && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="view-log-btn" onClick={() => setShowDispatchModal(true)}>
                  🚚 Log
                </button>
                  <button
                    className={`stock-btn ${stockTakeDone ? "is-done" : ""}`}
                    onClick={handleOpenStockModal}
                  >
                    {stockTakeDone ? "📝 Edit Stock" : "📦 Stock"}
                  </button>
              </div>
            )}

            {canOpenKitchenStockTake && (
              <button
                className="stock-btn is-done"
                onClick={() => navigate("/staff/kitchen-stock-take")}
                type="button"
              >
                Start Kitchen Stock Take
              </button>
            )}

            <button className="refresh-circle" onClick={loadToday}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
        </div>

        {!todayShift ? (
          <div className="app-empty-state">
            <div className="app-empty-icon">Free</div>
            <h2>No shift today</h2>
            <p>You&apos;re all clear for today. Check back later if the roster changes.</p>
          </div>
        ) : (
          <>
            <div className="shift-info-card">
              <div className="info-segment">
                <span className="info-label">Store</span>
                <b>{storeLabel(todayShift.storeId)}</b>
              </div>
              <div className="info-segment">
                <span className="info-label">Roster</span>
                <b>
                  {prettyTime(todayShift.startPlanned)} - {prettyTime(todayShift.endPlanned)}
                </b>
              </div>
            </div>

            {!timesheet?.startActual ? (
              <div className="clock-card">
                {!canClockOn && (<>
                <h2 className="clock-header">Verification</h2>

                  <div className="status-container compact-verify">
                    <div className="verify-item">
                      <div className="verify-meta">
                        <span className="status-index">1</span>
                        <div className="status-label">Location</div>
                      </div>
                      <span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>
                        {geoOk ? "In range" : "Move closer"}
                      </span>
                      <button
                        className="mini-action-button secondary"
                        onClick={loadToday}
                        disabled={geoBusy}
                      >
                        {geoBusy ? "Locating" : "Refresh"}
                      </button>
                    </div>

                    {!isKitchen && (
                      <>
                        <div className="divider" />
                        <div className="verify-item">
                          <div className="verify-meta">
                            <span className="status-index">2</span>
                            <div className="status-label">QR</div>
                          </div>
                          <span className={`status-badge ${qrOk ? "is-ok" : "is-warn"}`}>
                            {qrOk ? "Verified" : "Pending"}
                          </span>
                          <button
                            className="mini-action-button primary"
                            onClick={() => setScanOpen(true)}
                            disabled={!geoOk}
                          >
                            Scan
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>)}

                {canClockOn && (
                  <div className="time-entry-card animation-fade-in" style={{ marginTop: "20px" }}>
                    <ClearableTimeInput
                      className="time-picker"
                      value={startInput}
                      onChange={(e) => setStartInput(e.target.value)}
                      clearLabel="Clear clock on time"
                    />
                    <button
                      className="action-button brand-filled"
                      onClick={doClockOn}
                      disabled={!startInput}
                    >
                      Clock On
                    </button>
                  </div>
                )}
              </div>
            ) : !timesheet?.endActual ? (
              <div className="flow">
{isKitchen && (
  <div className="kitchen-dispatch-area staff-orders-panel">
    <h3 className="section-label">Today's Orders</h3>

    {allStoreRequests.length === 0 ? (
      <p className="small-note">No orders today.</p>
    ) : (
      allStoreRequests.map((req) => {
        const percent = getKitchenDispatchPercent(req);

        return (
          <div key={req.id} className="dispatch-card enhanced">
            <div
              className="dispatch-header clickable enhanced-header"
              onClick={() => setActiveKitchenDispatch(req)}
            >
              <div className="store-block">
                <h4>{storeLabel(req.storeId)}</h4>
                <span className={`status-pill ${req.adminProcessed ? "done" : "pending"}`}>
                  {req.adminProcessed ? "Completed" : "Pending"}
                </span>
              </div>

              <div className="progress-mini">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span>{percent}%</span>
              </div>
            </div>
          </div>
        );
      })
    )}
  </div>
)}
                {!timesheet.breakStartActual ? (
                  <div className="break-card">
                    <ClearableTimeInput
                      className="time-picker"
                      value={breakStartInput}
                      onChange={(e) => setBreakStartInput(e.target.value)}
                      clearLabel="Clear break start time"
                    />
                    <button className="action-button outline" onClick={doStartBreak}>
                      Start Break
                    </button>
                  </div>
                ) : !timesheet.breakEndActual ? (
                  <div className="break-active-card">
                    <ClearableTimeInput
                      className="time-picker"
                      value={breakEndInput}
                      onChange={(e) => setBreakEndInput(e.target.value)}
                      clearLabel="Clear break end time"
                    />
                    <button className="action-button brand-filled" onClick={doEndBreak}>
                      End Break
                    </button>
                  </div>
                ) : null}
                <div
                  className={`clock-off-card ${
                    ((stockRequiredForClockOff && !stockTakeDone) ||
                      (isKitchen && allStoreRequests.some((r) => !r.adminProcessed)))
                      ? "is-locked"
                      : ""
                  }`}
                >
                  <h2 className="clock-off-header">Finish Shift</h2>

                  {stockRequiredForClockOff && !stockTakeDone && (
                    <p className="stock-warning-text">
                      Submit Tomorrow&apos;s Stock Take to unlock Clock Off
                    </p>
                  )}

                  {isKitchen && allStoreRequests.some((r) => !r.adminProcessed) && (
                    <p className="stock-warning-text" style={{ color: "#f87171" }}>
                      ⚠️ Dispatch all pending orders to unlock Clock Off
                    </p>
                  )}

                  <div className="input-group">
                    <ClearableTimeInput
                      className="time-picker"
                      value={endInput}
                      onChange={(e) => setEndInput(e.target.value)}
                      clearLabel="Clear clock off time"
                    />
                    <button
                      className="action-button brand-filled"
                      onClick={doClockOff}
                      disabled={
                        (stockRequiredForClockOff && !stockTakeDone) ||
                        (isKitchen && allStoreRequests.some((r) => !r.adminProcessed)) ||
                        !endInput
                      }
                    >
                      Clock Off
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="summary-card">
                <h3>Shift Completed ✅</h3>
                {prettyTime(timesheet.startInput)} - {prettyTime(timesheet.endInput)}
              </div>
            )}
          </>
        )}
      </div>
      {showDispatchModal && (
        <div className="modal-overlay" onClick={() => setShowDispatchModal(false)}>
          <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Today's Dispatch Log</h3>
            </div>
            <div className="stock-list-container">
              <div className="log-row header">
                <span>Item</span>
                <span>Req</span>
                <span>Sent</span>
              </div>
              {dbItems.length > 0 ? (
                dbItems.map((it, idx) => (
                  <div key={idx} className="log-row">
                    <span>{it.name}</span>
                    <span>{it.qtyRequested}</span>
                    <span className={isAdminProcessed ? "text-green" : ""}>
                      {isAdminProcessed ? it.qtySent : "..."}
                    </span>
                  </div>
                ))
              ) : (
                <p className="notice">No request found for today.</p>
              )}
            </div>
            <button
              className="action-button secondary"
              onClick={() => setShowDispatchModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {activeKitchenDispatch && (
        <div className="modal-overlay" onClick={() => setActiveKitchenDispatch(null)}>
          <div className="stock-modal kitchen-dispatch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header kitchen-dispatch-modal-head">
              <div className="kitchen-dispatch-head-copy">
                <h3>{storeLabel(activeKitchenDispatch.storeId)}</h3>
                <p>Today&apos;s dispatch</p>
              </div>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setActiveKitchenDispatch(null)}
                aria-label="Close dispatch editor"
              >
                ×
              </button>
            </div>

            <div className="kitchen-dispatch-progress">
              <span className={`status-pill ${activeKitchenDispatch.adminProcessed ? "done" : "pending"}`}>
                {activeKitchenDispatch.adminProcessed ? "Completed" : "Pending"}
              </span>
              <div className="progress-mini wide">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${getKitchenDispatchPercent(activeKitchenDispatch)}%` }}
                  />
                </div>
                <span>{getKitchenDispatchPercent(activeKitchenDispatch)}%</span>
              </div>
            </div>

            <div className="stock-list-container kitchen-dispatch-scroll">
              {activeKitchenDispatch.items.map((it, idx) => (
                <div key={idx} className="dispatch-row enhanced-row modal-row">
                  <div className="item-left">
                    <div className="item-name">{it.name}</div>
                    <div className="req-text">Req {it.qtyRequested}</div>
                  </div>

                  <input
                    type="number"
                    className="qty-send-input large"
                    value={it.qtySent || ""}
                    onChange={(e) =>
                      handleKitchenQtyChange(activeKitchenDispatch.id, idx, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>

            <button
              className="dispatch-submit-btn sticky"
              onClick={() => {
                handleKitchenSubmit(activeKitchenDispatch);
                setActiveKitchenDispatch(null);
              }}
            >
              Save Dispatch
            </button>
          </div>
        </div>
      )}
{showStockModal && (
  <div className="modal-overlay">
    <div className="stock-modal">
      <div className="modal-header add-item-dash">
        <h3>Stock for {tomorrow}</h3>
        {stockTakeDone && <p className="small-note-sub">Editing existing request</p>}
      </div>

      <div className="stock-list-container">
        <textarea
          className="stock-bulk-textarea"
          placeholder={`Enter one item per line

Examples:
Milk 2
Cheese 5
Onion
Tomato 10`}
          value={stockBulkText}
          onChange={(e) => setStockBulkText(e.target.value)}
          rows={10}
        />
      </div>

      <div className="modal-actions">
        <button
          onClick={handleStockSubmit}
          disabled={submittingStock}
          className="action-button brand-filled"
        >
          {stockTakeDone ? "Update Request" : "Send Request"}
        </button>
        <button
          onClick={() => setShowStockModal(false)}
          className="action-button secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}



      <QRScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={(res) => setQrInput(res)}
      />
    </div>
  );
}
