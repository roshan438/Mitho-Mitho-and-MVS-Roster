import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import { notifyUsers } from "../../utils/notifications";
import { toYMD } from "../../utils/dates";
import { useStores } from "../../hooks/useStore";
import QRScanner from "../../components/QRScanner";
import {
  canRunKitchenQuickStock,
  DEFAULT_KITCHEN_STOCK_SETTINGS,
  ensureKitchenSession,
  filterKitchenInventoryItems,
  getKitchenStatusMeta,
  KITCHEN_STOCK_STATUSES,
  loadKitchenSessionEntries,
  loadKitchenStoreSettings,
  parseKitchenQuickStockQr,
  saveKitchenSessionEntry,
  syncKitchenSessionSummary,
} from "../../utils/kitchenQuickStockTake";
import "./KitchenQuickStockTake.css";

export default function KitchenQuickStockTake() {
  const { fbUser, profile } = useAuth();
  const { showToast } = useToast();
  const { getStoreLabel } = useStores();
  const navigate = useNavigate();
  const location = useLocation();

  const today = useMemo(() => toYMD(new Date()), []);
  const role = profile?.role || "staff";
  const uid = fbUser?.uid;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [todayShift, setTodayShift] = useState(null);
  const [timesheet, setTimesheet] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_KITCHEN_STOCK_SETTINGS);
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState({});
  const [mode, setMode] = useState("quick");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [search, setSearch] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customValue, setCustomValue] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customTargetId, setCustomTargetId] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTargetItem, setScanTargetItem] = useState(null);
  const [scanHint, setScanHint] = useState("Scan a shelf QR to count the next item fast.");
  const [scanCustomValue, setScanCustomValue] = useState("");
  const [detailItem, setDetailItem] = useState(null);
  const [managerSessions, setManagerSessions] = useState([]);

  const isManager = role === "manager";
  const effectiveDepartment = String(profile?.department || todayShift?.department || "").toLowerCase();
  const canPerform = canRunKitchenQuickStock({
    role,
    department: effectiveDepartment,
    shift: todayShift,
    timesheet,
  });
  const currentStoreId = todayShift?.storeId || "";
  const currentStoreLabel = useMemo(
    () => getStoreLabel(currentStoreId),
    [currentStoreId, getStoreLabel]
  );

  const filteredItems = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    return items.filter((item) => {
      const locationMatch =
        selectedLocation === "all" ||
        String(item.location || item.shelf || "Unsorted") === selectedLocation;

      if (!locationMatch) return false;
      if (!term) return true;

      return [
        item.name,
        item.code,
        item.location,
        item.shelf,
        item.category,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [items, search, selectedLocation]);

  const groupedLocations = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => String(item.location || item.shelf || "Unsorted")))
    );
  }, [items]);

  const completedCount = useMemo(
    () => items.filter((item) => Boolean(entries[item.id]?.status)).length,
    [entries, items]
  );
  const lowStockCount = useMemo(
    () => Object.values(entries).filter((entry) => entry.lowStock).length,
    [entries]
  );
  const activeItem = filteredItems[currentIndex] || filteredItems[0] || null;

  const loadManagerSessions = useCallback(async (storeId) => {
    if (!storeId || !isManager) return;
    const snap = await getDocs(
      query(
        collection(db, "stockTakeSessions"),
        where("storeId", "==", storeId),
        where("date", "==", today),
        where("department", "==", "kitchen"),
        orderBy("updatedAt", "desc")
      )
    );
    setManagerSessions(snap.docs.map((sessionDoc) => ({ id: sessionDoc.id, ...sessionDoc.data() })));
  }, [isManager, today]);

  const loadPage = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      setLoadError("We could not identify the signed-in staff account. Please reopen the page after login finishes.");
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      let rosterSnap;
      try {
        rosterSnap = await getDocs(
          query(
            collectionGroup(db, "shifts"),
            where("uid", "==", uid),
            where("date", "==", today)
          )
        );
      } catch (error) {
        console.error("Kitchen stock take roster load failed", error);
        throw error;
      }

      const shift = rosterSnap.empty
        ? null
        : { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() };
      setTodayShift(shift);

      if (!shift?.storeId) {
        setTimesheet(null);
        setItems([]);
        setSession(null);
        return;
      }

      let tsSnap;
      let settingsValue;
      let inventorySnap;
      try {
        [tsSnap, settingsValue, inventorySnap] = await Promise.all([
          getDoc(doc(db, "timesheets", `${uid}_${today}`)),
          loadKitchenStoreSettings(shift.storeId),
          getDocs(collection(db, "inventoryItems")),
        ]);
      } catch (error) {
        console.error("Kitchen stock take setup load failed", error);
        throw error;
      }

      const nextTimesheet = tsSnap.exists() ? tsSnap.data() : null;
      setTimesheet(nextTimesheet);
      setSettings(settingsValue);

      const inventoryItems = filterKitchenInventoryItems(
        inventorySnap.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() })),
        shift.storeId
      );
      setItems(inventoryItems);

      if (canRunKitchenQuickStock({
        role,
        department: String(profile?.department || shift?.department || "").toLowerCase(),
        shift,
        timesheet: nextTimesheet,
      })) {
        try {
          const nextSession = await ensureKitchenSession({
            userId: uid,
            userName: profile?.firstName || fbUser?.displayName || "Kitchen Staff",
            role,
            storeId: shift.storeId,
            storeLabel: getStoreLabel(shift.storeId),
            date: today,
            shift,
            settings: settingsValue,
          });

          setSession(nextSession);

          const sessionEntries = await loadKitchenSessionEntries(nextSession.id);
          const entryMap = {};
          sessionEntries.forEach((entry) => {
            entryMap[entry.itemId] = entry;
          });
          setEntries(entryMap);
        } catch (error) {
          console.error("Kitchen stock take session load failed", error);
          setSession(null);
          setEntries({});
          setLoadError("Kitchen stock take access is blocked right now. Firestore rules for stock take sessions or entries still need updating.");
        }
      } else {
        setSession(null);
        setEntries({});
      }

      try {
        await loadManagerSessions(shift.storeId);
      } catch (error) {
        console.error("Kitchen stock take manager sessions load failed", error);
      }
    } catch (error) {
      console.error("Kitchen stock take load failed", error);
      setLoadError("We could not load the kitchen stock take right now. Please check Firestore permissions for kitchen stock take data.");
      showToast("We could not load the kitchen stock take right now.", "error");
    } finally {
      setLoading(false);
    }
  }, [fbUser?.displayName, getStoreLabel, loadManagerSessions, profile?.department, profile?.firstName, role, showToast, today, uid]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!location.state?.promptedAfterClockOn) return;
    showToast("Kitchen stock take is required after clock-on for this store.", "info");
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate, showToast]);

  useEffect(() => {
    if (!activeItem) {
      setCurrentIndex(0);
      return;
    }

    const exactIndex = filteredItems.findIndex((item) => item.id === activeItem.id);
    if (exactIndex === -1) setCurrentIndex(0);
  }, [activeItem, filteredItems]);

  const advanceToNext = useCallback((itemId) => {
    const index = filteredItems.findIndex((item) => item.id === itemId);
    if (index === -1) return;
    const nextIndex = Math.min(index + 1, Math.max(filteredItems.length - 1, 0));
    setCurrentIndex(nextIndex);
  }, [filteredItems]);

  const notifyKitchenCompletion = useCallback(async (summary) => {
    if (!currentStoreId || !session?.id) return;

    const usersSnap = await getDocs(
      query(collection(db, "users"), where("role", "in", ["admin", "manager"]))
    );

    const recipientUids = usersSnap.docs
      .map((userDoc) => userDoc.data())
      .filter((user) => user?.role === "admin" || user?.status === "approved")
      .map((user) => user.uid)
      .filter(Boolean);

    if (recipientUids.length === 0) return;

    const lowStockMessage =
      summary.lowStockCount > 0
        ? ` ${summary.lowStockCount} low-stock item${summary.lowStockCount === 1 ? "" : "s"} flagged.`
        : "";

    await notifyUsers(db, recipientUids, {
      title: "Kitchen Stock Take Done",
      message: `${profile?.firstName || fbUser?.displayName || "Kitchen staff"} completed ${currentStoreLabel} kitchen stock take for ${today}.${lowStockMessage}`,
      type: summary.lowStockCount > 0 ? "warning" : "success",
      link: "/admin/stock-manager",
      metadata: {
        storeId: currentStoreId,
        sessionId: session.id,
        lowStockCount: summary.lowStockCount || 0,
        date: today,
      },
    });
  }, [currentStoreId, currentStoreLabel, fbUser?.displayName, profile?.firstName, session?.id, today]);

  const commitEntry = useCallback(async (item, status, options = {}) => {
    if (!session?.id || !item?.id) return;

    setSaving(true);
    try {
      const customRatio =
        status === "custom"
          ? Math.max(0, Math.min(1, Number(options.customRatio || 0)))
          : null;
      const customLabel =
        status === "custom"
          ? `${Math.round(customRatio * 100)}%`
          : "";

      await saveKitchenSessionEntry({
        sessionId: session.id,
        date: today,
        item,
        status,
        customRatio,
        customValue: customLabel,
        note: options.note || "",
        userId: uid,
        userName: profile?.firstName || fbUser?.displayName || "Kitchen Staff",
      });

      const summary = await syncKitchenSessionSummary(session.id, items.length);
      if (summary.status === "completed" && session?.status !== "completed") {
        try {
          await notifyKitchenCompletion(summary);
        } catch (notificationError) {
          console.error("Kitchen stock take notification failed", notificationError);
        }
      }
      setEntries((prev) => ({
        ...prev,
        [item.id]: {
          ...(prev[item.id] || {}),
          itemId: item.id,
          status,
          customRatio,
          customValue: customLabel,
          lowStock: status === "low" || status === "out" || (status === "custom" && customRatio <= 0.3),
        },
      }));
      setSession((prev) =>
        prev
          ? {
              ...prev,
              completedCount: summary.completedCount,
              lowStockCount: summary.lowStockCount,
              status: summary.status,
            }
          : prev
      );
      if (options.source === "scan") {
        setScanTargetItem(null);
        setScanCustomValue("");
        setScanHint(`Saved ${item.name}. Ready to scan the next item.`);
        setTimeout(() => setScanOpen(true), 180);
      }
      advanceToNext(item.id);
    } catch (error) {
      console.error("Kitchen stock entry save failed", error);
      showToast("That item could not be saved. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }, [advanceToNext, fbUser?.displayName, items.length, notifyKitchenCompletion, profile?.firstName, session?.id, session?.status, showToast, today, uid]);

  const handleCustomSave = async () => {
    const item = items.find((candidate) => candidate.id === customTargetId);
    if (!item) return;

    const percent = Number(customValue);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      showToast("Enter a stock level between 0 and 100 percent.", "warning");
      return;
    }

    await commitEntry(item, "custom", { customRatio: percent / 100 });
    setCustomOpen(false);
    setCustomTargetId("");
    setCustomValue("");
  };

  const handleQrResult = async (value) => {
    const parsed = parseKitchenQuickStockQr(value);
    if (!parsed) {
      showToast("That QR code is not a kitchen stock item.", "warning");
      return;
    }

    const itemIndex = filteredItems.findIndex((item) => item.id === parsed.itemId);
    const allIndex = items.findIndex((item) => item.id === parsed.itemId);
    if (allIndex === -1) {
      showToast("This item does not belong to the current store kitchen list.", "warning");
      return;
    }

    const matchedItem = items[allIndex];
    if (entries[matchedItem.id]?.status) {
      setScanHint(`${matchedItem.name} is already counted. Scan a different item.`);
      showToast(`${matchedItem.name} has already been scanned.`, "warning");
      return;
    }

    setSearch("");
    setSelectedLocation("all");
    setCurrentIndex(itemIndex >= 0 ? itemIndex : allIndex);
    setScanCustomValue("");
    setScanTargetItem(matchedItem);
    setScanHint(`Counting ${matchedItem.name}. Save it, then scan the next item.`);
  };

  const reopenSession = async (targetSession) => {
    try {
      await updateDoc(doc(db, "stockTakeSessions", targetSession.id), {
        status: "in_progress",
        reopenedAt: serverTimestamp(),
        reopenedBy: profile?.firstName || "Manager",
        reopenedCount: Number(targetSession.reopenedCount || 0) + 1,
        completedAt: null,
        updatedAt: serverTimestamp(),
      });
      showToast("Session reopened for the kitchen team.", "success");
      loadManagerSessions(currentStoreId);
      if (session?.id === targetSession.id) {
        setSession((prev) => (prev ? { ...prev, status: "in_progress" } : prev));
      }
    } catch (error) {
      console.error("Session reopen failed", error);
      showToast("We could not reopen that stock take session.", "error");
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card kitchen-stock-shell">Loading kitchen stock take...</div>
      </div>
    );
  }

  if (!todayShift?.storeId) {
    return (
      <div className="container">
        <div className="card kitchen-stock-shell">
          <h1>Kitchen Quick Stock Take</h1>
          <p className="small-note">There is no active store context for today, so we cannot load stock take items yet.</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container kitchen-stock-page">
        <div className="card kitchen-stock-shell">
          <h1>Kitchen Quick Stock Take</h1>
          <p className="small-note">{loadError}</p>
          <div className="hero-actions">
            <button className="action-button secondary" onClick={loadPage} type="button">
              Retry
            </button>
            <button className="action-button brand-filled" onClick={() => navigate("/staff/today")} type="button">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!settings.enabled) {
    return (
      <div className="container">
        <div className="card kitchen-stock-shell">
          <h1>Kitchen Quick Stock Take</h1>
          <p className="small-note">This feature is turned off for {currentStoreLabel} right now.</p>
        </div>
      </div>
    );
  }

  if (!canPerform && !isManager) {
    return (
      <div className="container">
        <div className="card kitchen-stock-shell">
          <h1>Kitchen Quick Stock Take</h1>
          <p className="small-note">Clock on to your kitchen shift first, then this fast stock take will unlock automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container kitchen-stock-page">
      <div className="kitchen-stock-shell">
        <header className="kitchen-stock-hero">
          <div>
            <p className="eyebrow">Kitchen Quick Stock Take</p>
            <h1>{currentStoreLabel}</h1>
            <p className="subcopy">Fast live count for this kitchen shift.</p>
          </div>
          <div className="hero-actions">
            <button className="action-button secondary" onClick={loadPage} type="button">
              Refresh
            </button>
            <button className="action-button brand-filled" onClick={() => setScanOpen(true)} type="button">
              Scan QR
            </button>
          </div>
        </header>

        <section className="kitchen-stock-summary-grid">
          <article className="summary-card">
            <span className="summary-label">Progress</span>
            <strong>{completedCount} / {items.length}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-label">Low stock</span>
            <strong>{lowStockCount}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-label">Rule</span>
            <strong>Per day</strong>
          </article>
          <article className="summary-card">
            <span className="summary-label">Session</span>
            <strong>{session?.status === "completed" ? "Complete" : "In progress"}</strong>
          </article>
        </section>

        <div className="guided-banner compact-hint">{scanHint}</div>

        <section className="kitchen-mode-bar">
          {[
            { id: "quick", label: "Quick List" },
            { id: "location", label: "By Shelf" },
            { id: "qr", label: "QR Guided" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={`mode-chip ${mode === option.id ? "active" : ""}`}
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </section>

        <section className="kitchen-controls">
          <input
            className="kitchen-search"
            placeholder="Search item, shelf, or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="kitchen-select"
            value={selectedLocation}
            onChange={(event) => {
              setSelectedLocation(event.target.value);
              setCurrentIndex(0);
            }}
          >
            <option value="all">All shelves</option>
            {groupedLocations.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </section>

        {items.length === 0 ? (
          <div className="card kitchen-empty-state">
            <h3>No kitchen inventory items yet</h3>
            <p>Add items with department set to kitchen in the stock manager first.</p>
          </div>
        ) : (
          <div className="kitchen-stock-layout">
            <aside className="kitchen-item-rail">
              {filteredItems.map((item, index) => {
                const entry = entries[item.id];
                const statusMeta = entry?.status ? getKitchenStatusMeta(entry.status) : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`item-rail-card ${activeItem?.id === item.id ? "active" : ""} ${entry?.lowStock ? "is-low" : ""}`}
                    onClick={() => setCurrentIndex(index)}
                  >
                    <span className="item-rail-name">{item.name}</span>
                    <span className="item-rail-meta">
                      {item.location || item.shelf || "Unsorted"} {statusMeta ? `• ${statusMeta.badge}` : "• Pending"}
                    </span>
                  </button>
                );
              })}
            </aside>

            <section className="kitchen-active-panel">
              {activeItem ? (
                <>
                  <div className="active-item-header">
                    <div>
                      <h2>{activeItem.name}</h2>
                    </div>
                    <div className="active-item-actions">
                      <span className={`session-pill ${entries[activeItem.id]?.lowStock ? "is-low" : ""}`}>
                        {entries[activeItem.id]?.status
                          ? getKitchenStatusMeta(entries[activeItem.id].status).badge
                          : "Waiting"}
                      </span>
                      <button
                        type="button"
                        className="mode-chip compact-info-chip"
                        onClick={() => setDetailItem(activeItem)}
                      >
                        Info
                      </button>
                    </div>
                  </div>

                  {mode === "location" && (
                    <div className="guided-banner">
                      Shelf flow is active. Finish this shelf, and the next item is ready straight away.
                    </div>
                  )}
                  {mode === "qr" && (
                    <div className="guided-banner">
                      Scan an item QR with format <code>KQS:{activeItem.id}</code> to jump directly to it.
                    </div>
                  )}

                  <div className="stock-action-grid">
                    {KITCHEN_STOCK_STATUSES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`stock-action-tile ${option.value === "out" ? "danger" : ""}`}
                        onClick={() => {
                          if (option.value === "custom") {
                            setCustomTargetId(activeItem.id);
                            setCustomValue(entries[activeItem.id]?.customRatio ? String(Math.round(entries[activeItem.id].customRatio * 100)) : "");
                            setCustomOpen(true);
                            return;
                          }
                          commitEntry(activeItem, option.value);
                        }}
                        disabled={saving}
                      >
                        <span>{option.label}</span>
                        <small>{option.quantityLabel}</small>
                      </button>
                    ))}
                  </div>

                  <div className="progress-strip">
                    <div
                      className="progress-strip-fill"
                      style={{ width: `${items.length ? (completedCount / items.length) * 100 : 0}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="card kitchen-empty-state">
                  <h3>No items match this filter</h3>
                  <p>Try another shelf or clear the search to keep moving.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {(isManager || settings.managerCanReopen) && managerSessions.length > 0 && (
          <section className="manager-session-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">Manager view</p>
                <h3>Today&apos;s kitchen stock sessions</h3>
              </div>
            </div>
            <div className="manager-session-list">
              {managerSessions.map((sessionRow) => (
                <article key={sessionRow.id} className="manager-session-card">
                  <div>
                    <strong>{sessionRow.userName || "Kitchen Staff"}</strong>
                    <p>
                      {sessionRow.completedCount || 0}/{sessionRow.itemCount || 0} complete • {sessionRow.lowStockCount || 0} low stock
                    </p>
                  </div>
                  <div className="manager-session-actions">
                    <span className={`session-pill ${sessionRow.status === "completed" ? "is-complete" : ""}`}>
                      {sessionRow.status === "completed" ? "Completed" : "In progress"}
                    </span>
                    {isManager && settings.managerCanReopen && sessionRow.status === "completed" && (
                      <button type="button" className="action-button secondary" onClick={() => reopenSession(sessionRow)}>
                        Reopen
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {customOpen && (
        <div className="modal-overlay">
          <div className="stock-custom-modal">
            <h3>Custom stock level</h3>
            <p>Enter the estimated percent left for this item.</p>
            <input
              className="kitchen-search"
              type="number"
              min="0"
              max="100"
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder="0-100"
            />
            <div className="modal-actions">
              <button type="button" className="action-button brand-filled" onClick={handleCustomSave}>
                Save
              </button>
              <button
                type="button"
                className="action-button secondary"
                onClick={() => {
                  setCustomOpen(false);
                  setCustomTargetId("");
                  setCustomValue("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {scanTargetItem && (
        <div className="modal-overlay">
          <div className="stock-custom-modal scan-quick-modal">
            <div className="scan-quick-head">
              <div>
                <h3>{scanTargetItem.name}</h3>
                <p>{scanTargetItem.location || scanTargetItem.shelf || "Unsorted shelf"}</p>
              </div>
              <button
                type="button"
                className="mode-chip compact-info-chip"
                onClick={() => {
                  setScanTargetItem(null);
                  setScanCustomValue("");
                }}
              >
                ×
              </button>
            </div>

            <div className="scan-quick-actions">
              {["full", "half", "low", "out"].map((value) => {
                const option = KITCHEN_STOCK_STATUSES.find((item) => item.value === value);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`scan-quick-btn ${value === "out" ? "danger" : ""}`}
                    onClick={() => commitEntry(scanTargetItem, value, { source: "scan" })}
                    disabled={saving}
                  >
                    {option?.badge || value}
                  </button>
                );
              })}
            </div>

            <div className="scan-custom-row">
              <input
                className="kitchen-search scan-custom-input"
                type="number"
                min="0"
                max="100"
                placeholder="%"
                value={scanCustomValue}
                onChange={(event) => setScanCustomValue(event.target.value)}
              />
              <button
                type="button"
                className="scan-quick-btn"
                onClick={() => {
                  const percent = Number(scanCustomValue);
                  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
                    showToast("Enter 0 to 100 for custom stock.", "warning");
                    return;
                  }
                  commitEntry(scanTargetItem, "custom", {
                    source: "scan",
                    customRatio: percent / 100,
                  });
                }}
                disabled={saving}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {detailItem && (
        <div className="modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="stock-custom-modal item-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="scan-quick-head">
              <div>
                <h3>{detailItem.name}</h3>
                <p>{detailItem.location || detailItem.shelf || "Unsorted shelf"}</p>
              </div>
              <button type="button" className="mode-chip compact-info-chip" onClick={() => setDetailItem(null)}>
                ×
              </button>
            </div>
            <div className="item-detail-grid">
              <span><strong>Code</strong><em>{detailItem.code || "-"}</em></span>
              <span><strong>Shelf</strong><em>{detailItem.shelf || "-"}</em></span>
              <span><strong>Category</strong><em>{detailItem.category || "-"}</em></span>
              <span><strong>Par</strong><em>{detailItem.parLevel || "-"}</em></span>
              <span><strong>QR</strong><code>{detailItem.qrValue || `KQS:${detailItem.id}`}</code></span>
            </div>
          </div>
        </div>
      )}

      <QRScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={handleQrResult}
        title="Scan Kitchen Stock Item"
      />
    </div>
  );
}
