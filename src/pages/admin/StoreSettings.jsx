















import { useEffect, useState, useCallback } from "react";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  collectionGroup,
  serverTimestamp,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import QRCode from "qrcode";
import { db } from "../../firebase/firebase";
import { useToast } from "../../context/ToastContext";
import "./StoreSettings.css";

function randomCode(prefix) {
  const d = new Date();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${rand}`;
}

function makeQrPayload({ storeId, code }) {
    return JSON.stringify({ v: 1, storeId, code });
  }

export default function StoreSettings() {
  const { showToast } = useToast();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStore, setNewStore] = useState({ id: "", label: "", lat: "", lng: "" });
  const [radiusM, setRadiusM] = useState(3000);
  const [kitchenSettings, setKitchenSettings] = useState({
    enabled: true,
    requireAfterClockOn: false,
    completionRule: "once_per_day",
    managerCanReopen: true,
  });
  const [qrCodeValue, setQrCodeValue] = useState(""); 
  const [qrPayload, setQrPayload] = useState(""); 
  const [qrDataUrl, setQrDataUrl] = useState("");

  const fetchStores = useCallback(async (nextSelectedId = null) => {
    try {
      const querySnapshot = await getDocs(collection(db, "stores"));
      const storeList = querySnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)));

      setStores(storeList);

      if (storeList.length === 0) {
        setStoreId("");
        return;
      }

      const preferredId = nextSelectedId ?? storeId;
      const nextStoreId =
        preferredId && storeList.some((store) => store.id === preferredId)
          ? preferredId
          : storeList[0].id;

      setStoreId(nextStoreId);
    } catch (error) {
      console.error("Error loading stores", error);
      showToast("Error loading stores", "error");
    }
  }, [showToast, storeId]);

  const loadStoreData = useCallback(async (isManual = false) => {
    if (!storeId) return;
    setLoading(true);
    try {
      const settingsSnap = await getDoc(doc(db, "storeSettings", storeId));
      if (settingsSnap.exists()) {
        const nextRadius = Number(settingsSnap.data()?.radiusM);
        setRadiusM(Number.isFinite(nextRadius) && nextRadius > 0 ? nextRadius : 3000);
        const nextKitchenSettings = settingsSnap.data()?.kitchenQuickStockTake || {};
        setKitchenSettings({
          enabled: nextKitchenSettings.enabled !== false,
          requireAfterClockOn: Boolean(nextKitchenSettings.requireAfterClockOn),
          completionRule: "once_per_day",
          managerCanReopen: nextKitchenSettings.managerCanReopen !== false,
        });
      } else {
        setRadiusM(3000);
        setKitchenSettings({
          enabled: true,
          requireAfterClockOn: false,
          completionRule: "once_per_day",
          managerCanReopen: true,
        });
      }

      const qrSnap = await getDoc(doc(db, "storeQr", storeId));
      let code = "";
      let payload = "";

      if (qrSnap.exists()) {
        const data = qrSnap.data();
        if (data?.currentPayload) {
          payload = String(data.currentPayload);
          try {
            code = JSON.parse(payload)?.code || "";
          } catch {
            code = "";
          }
        } else {
          code = String(data?.currentCode || "");
          payload = code ? makeQrPayload({ storeId, code }) : "";
        }
      }

      setQrCodeValue(code);
      setQrPayload(payload);

      if (payload) {
        const url = await QRCode.toDataURL(payload, {
          margin: 2,
          width: 520,
          color: { dark: "#1f2937", light: "#fffaf0" },
        });
        setQrDataUrl(url);
      } else {
        setQrDataUrl("");
      }

      if (isManual) showToast("Settings synced", "success");
    } catch (error) {
      console.error("Error loading store settings", error);
      showToast("Error loading settings", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, storeId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);
  async function handleAddStore() {
    if (!newStore.id || !newStore.label) return showToast("ID and Label required", "error");
    setSaving(true);
    try {
      const sid = newStore.id.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, "stores", sid), {
        label: newStore.label,
        lat: Number(newStore.lat) || 0,
        lng: Number(newStore.lng) || 0,
        radiusM: 20
      });
      await setDoc(doc(db, "storeSettings", sid), {
        radiusM: 20,
        kitchenQuickStockTake: {
          enabled: true,
          requireAfterClockOn: false,
          completionRule: "once_per_day",
          managerCanReopen: true,
        },
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, "storeQr", sid), { currentCode: "SETUP", updatedAt: serverTimestamp() });

      showToast("Store Added!", "success");
      setShowAddModal(false);
      setNewStore({ id: "", label: "", lat: "", lng: "" });
      await fetchStores(sid);
    } catch (error) {
      console.error("Error adding store", error);
      showToast("Failed to add store", "error");
    } finally {
      setSaving(false);
    }
  }

  async function getStoreDependencyCount(targetStoreId) {
    const [shiftSnap, timesheetSnap, stockSnap] = await Promise.all([
      getDocs(query(collectionGroup(db, "shifts"), where("storeId", "==", targetStoreId))),
      getDocs(query(collection(db, "timesheets"), where("storeId", "==", targetStoreId))),
      getDocs(query(collection(db, "dailyStockTake"), where("storeId", "==", targetStoreId))),
    ]);

    return shiftSnap.size + timesheetSnap.size + stockSnap.size;
  }

  const handleDeleteStore = async () => {
    if (!storeId) return;

    setSaving(true);
    try {
      const dependencyCount = await getStoreDependencyCount(storeId);
      if (dependencyCount > 0) {
        showToast(
          "This store already has linked roster, timesheet, or stock records. Keep it archived instead of deleting it.",
          "warning"
        );
        return;
      }

      const confirmDelete = window.confirm(
        `Delete "${storeId}"? This only removes the store when no linked records exist.`
      );

      if (!confirmDelete) return;

      await Promise.all([
        deleteDoc(doc(db, "stores", storeId)),
        deleteDoc(doc(db, "storeSettings", storeId)),
        deleteDoc(doc(db, "storeQr", storeId))
      ]);

      showToast("Store deleted successfully", "success");
      await fetchStores();
    } catch (error) {
      console.error("Delete error:", error);
      showToast("Failed to delete store", "error");
    } finally {
      setSaving(false);
    }
  };

  async function saveRadius() {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "storeSettings", storeId),
        {
          radiusM: Number(radiusM),
          kitchenQuickStockTake: kitchenSettings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Store settings updated", "success");
    } catch (error) {
      console.error("Error saving radius", error);
      showToast("Failed to save radius", "error");
    } finally {
      setSaving(false);
    }
  }

  async function generateNewQr() {
    const prefix = storeId.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10) || "STORE";
    const newCode = randomCode(prefix);
    const payload = makeQrPayload({ storeId, code: newCode });

    setQrCodeValue(newCode);
    setQrPayload(payload);
    const url = await QRCode.toDataURL(payload, {
      margin: 2,
      width: 520,
      color: { dark: "#1f2937", light: "#fffaf0" },
    });
    setQrDataUrl(url);
    showToast("New QR Generated locally", "info");
  }

  async function publishQr() {
    if (!qrCodeValue || !qrPayload) return showToast("Generate QR first", "error");
    setSaving(true);
    try {
      await setDoc(doc(db, "storeQr", storeId), { currentPayload: String(qrPayload).trim(), currentCode: String(qrCodeValue).trim(), updatedAt: serverTimestamp() }, { merge: true });
      showToast("QR Published to Store", "success");
    } catch (error) {
      console.error("Error publishing QR", error);
      showToast("Publish failed", "error");
    } finally {
      setSaving(false);
    }
  }

  function printQr() {
    if (!qrDataUrl) return;
    const currentStore = stores.find(s => s.id === storeId);
    const label = currentStore?.label || storeId;

    const w = window.open("", "_blank");
    if (!w) return showToast("Popup blocked!", "error");
    QRCode.toDataURL(
      qrPayload,
      { margin: 2, width: 1000, color: { dark: "#111827", light: "#ffffff" } },
      (err, url) => {
      w.document.write(`
        <html>
          <head><title>Print QR — ${label}</title></head>
          <body style="font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:90vh; text-align:center;">
            <h1 style="font-size:48px; margin-bottom:0;">${label}</h1>
            <p style="font-size:20px; color:#666;">Scan to Clock On/Off</p>
            <img src="${url}" style="width:500px; height:500px; border:20px solid #eee; border-radius:40px; margin:20px;" />
            <p style="font-family:monospace; font-size:18px;">ID: ${qrCodeValue}</p>
            <script>window.onload = () => { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      w.document.close();
    });
  }

  return (
    <div className="mobile-app-wrapper store-settings-page">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Store Configuration</h1>
          <p className="store-subtitle">Verify staff presence and manage kitchen rules.</p>
        </div>
        <div className="header-actions">
          <button className="add-store-btn" onClick={() => setShowAddModal(true)} title="Add store">+</button>
          <button className={`refresh-circle ${loading ? 'spinning' : ''}`} onClick={() => loadStoreData(true)}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          </button>
        </div>
      </header>

      <main className="scroll-content">
        <section className="settings-card">
          <label className="section-label">Select Store</label>
          <select className="app-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <div className="field-group">
          <label className="section-label">Geo-Fence Radius (meters)</label>
           <div className="input-with-btn">
               <input className="app-input" type="number" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} />
               <button className="btn-brand save" onClick={saveRadius} disabled={saving}>Save</button>  
              <button className="btn-delete" onClick={handleDeleteStore} disabled={saving}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                </svg>
              </button>           </div>
             <p className="field-hint">20m = Standard Security. 3000m = Debug Mode.</p>
          </div>
         </section>

         <section className="settings-card">
          <label className="section-label">Kitchen Quick Stock Take</label>
          <div className="field-group">
            <label className="section-label" style={{ marginBottom: "8px" }}>
              Feature status
            </label>
            <select
              className="app-input"
              value={kitchenSettings.enabled ? "enabled" : "disabled"}
              onChange={(e) =>
                setKitchenSettings((prev) => ({
                  ...prev,
                  enabled: e.target.value === "enabled",
                }))
              }
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="field-group">
            <label className="section-label" style={{ marginBottom: "8px" }}>
              Prompt timing
            </label>
            <select
              className="app-input"
              value={kitchenSettings.requireAfterClockOn ? "required" : "optional"}
              onChange={(e) =>
                setKitchenSettings((prev) => ({
                  ...prev,
                  requireAfterClockOn: e.target.value === "required",
                }))
              }
            >
              <option value="optional">Kitchen staff can start it manually</option>
              <option value="required">Prompt right after clock-on</option>
            </select>
          </div>

          <div className="field-group">
            <label className="section-label" style={{ marginBottom: "8px" }}>
              Completion rule
            </label>
            <select
              className="app-input"
              value={kitchenSettings.completionRule}
              onChange={() =>
                setKitchenSettings((prev) => ({
                  ...prev,
                  completionRule: "once_per_day",
                }))
              }
            >
              <option value="once_per_day">One stock take per day</option>
            </select>
          </div>

          <div className="field-group">
            <label className="section-label" style={{ marginBottom: "8px" }}>
              Manager reopen access
            </label>
            <select
              className="app-input"
              value={kitchenSettings.managerCanReopen ? "yes" : "no"}
              onChange={(e) =>
                setKitchenSettings((prev) => ({
                  ...prev,
                  managerCanReopen: e.target.value === "yes",
                }))
              }
            >
              <option value="yes">Managers can reopen completed sessions</option>
              <option value="no">Only admins control completed sessions</option>
            </select>
          </div>

          <p className="field-hint">
            These rules apply to kitchen staff for the selected store and use the current clock-on flow.
          </p>
         </section>

         <section className="qr-management-card">
           <div className="qr-header">
             <h2 className="card-title">Store Access QR</h2>
             <p className="card-desc">Staff scan this to verify presence.</p>
           </div>

           <div className="qr-preview-area">
             {qrDataUrl ? (
              <div className="qr-container">
                <img src={qrDataUrl} alt="Store QR" className="qr-display" />
                <div className="qr-code-text">{qrCodeValue}</div>
              </div>
            ) : (
              <div className="qr-placeholder">No QR Active</div>
            )}
          </div>

          <div className="qr-actions-grid">
            <button className="btn-sec" onClick={generateNewQr} disabled={saving}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Regen
            </button>
            <button className="btn-brand" onClick={publishQr} disabled={saving || !qrCodeValue}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Publish
            </button>
            <button className="btn-sec full-width" onClick={printQr} disabled={!qrDataUrl}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
              Print
            </button>
          </div>
        </section>
      </main>
      {showAddModal && (
        <div className="modal-overlay">
          <div className="settings-card modal-content">
            <h2 className="card-title">New Store Location</h2>
            <input className="app-input" placeholder="Store ID (mitho_parramatta)" onChange={e => setNewStore({...newStore, id: e.target.value})} />
            <input className="app-input" placeholder="Display Name (Mitho Parramatta)" onChange={e => setNewStore({...newStore, label: e.target.value})} />
            <div className="store-coord-row">
               <input className="app-input" placeholder="Lat" onChange={e => setNewStore({...newStore, lat: e.target.value})} />
               <input className="app-input" placeholder="Lng" onChange={e => setNewStore({...newStore, lng: e.target.value})} />
            </div>
            <div className="modal-actions store-modal-actions">
              <button className="btn-brand store-add-button" onClick={handleAddStore} disabled={saving}>Add Store</button>
              <button className="btn-sec" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
