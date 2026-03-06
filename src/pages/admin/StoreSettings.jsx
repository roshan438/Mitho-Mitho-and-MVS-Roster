// import { useEffect, useMemo, useState } from "react";
// import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
// import QRCode from "qrcode";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import "./StoreSettings.css";

// function randomCode(prefix) {
//   const d = new Date();
//   const y = d.getFullYear();
//   const m = String(d.getMonth() + 1).padStart(2, "0");
//   const day = String(d.getDate()).padStart(2, "0");
//   const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
//   return `${prefix}-${y}-${m}-${day}-${rand}`;
// }

// function makeQrPayload({ storeId, code }) {
//   // versioned payload so we can evolve later
//   return JSON.stringify({ v: 1, storeId, code });
// }

// export default function StoreSettings() {
//   const [storeId, setStoreId] = useState(STORES[0]?.id || "");
//   const store = useMemo(() => STORES.find((s) => s.id === storeId), [storeId]);

//   const [radiusM, setRadiusM] = useState(3000);
//   const [qrCodeValue, setQrCodeValue] = useState(""); // human code (code)
//   const [qrPayload, setQrPayload] = useState(""); // actual QR content
//   const [qrDataUrl, setQrDataUrl] = useState("");

//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     if (!storeId) return;
//     loadAll();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [storeId]);

//   async function loadAll() {
//     setLoading(true);

//     // radius
//     const settingsRef = doc(db, "storeSettings", storeId);
//     const settingsSnap = await getDoc(settingsRef);
//     if (settingsSnap.exists()) {
//       const r = settingsSnap.data()?.radiusM;
//       if (typeof r === "number" && r > 0) setRadiusM(r);
//     } else {
//       setRadiusM(3000);
//     }

//     // qr
//     const qrRef = doc(db, "storeQr", storeId);
//     const qrSnap = await getDoc(qrRef);

//     // support both old format (currentCode string) and new format (currentPayload)
//     let code = "";
//     let payload = "";

//     if (qrSnap.exists()) {
//       const data = qrSnap.data();
//       if (data?.currentPayload) {
//         payload = String(data.currentPayload || "");
//         try {
//           const obj = JSON.parse(payload);
//           code = String(obj?.code || "");
//         } catch {
//           // payload not JSON
//           code = "";
//         }
//       } else {
//         // legacy
//         code = String(data?.currentCode || "");
//         payload = code ? makeQrPayload({ storeId, code }) : "";
//       }
//     }

//     setQrCodeValue(code);
//     setQrPayload(payload);

//     if (payload) {
//       const url = await QRCode.toDataURL(payload, { margin: 2, width: 520 });
//       setQrDataUrl(url);
//     } else {
//       setQrDataUrl("");
//     }

//     setLoading(false);
//   }

//   async function saveRadius() {
//     setSaving(true);
//     try {
//       await setDoc(
//         doc(db, "storeSettings", storeId),
//         { radiusM: Number(radiusM), updatedAt: serverTimestamp() },
//         { merge: true }
//       );
//       alert("Radius saved.");
//     } finally {
//       setSaving(false);
//     }
//   }

//   async function generateNewQr() {
//     const prefix = storeId.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10) || "STORE";
//     const newCode = randomCode(prefix);

//     const payload = makeQrPayload({ storeId, code: newCode });

//     setQrCodeValue(newCode);
//     setQrPayload(payload);

//     const url = await QRCode.toDataURL(payload, { margin: 2, width: 520 });
//     setQrDataUrl(url);
//   }

//   async function publishQr() {
//     if (!qrCodeValue || !qrPayload) return alert("Generate a QR code first.");

//     setSaving(true);
//     try {
//       await setDoc(
//         doc(db, "storeQr", storeId),
//         {
//           // new format
//           currentPayload: String(qrPayload).trim(),
//           // keep legacy too (optional)
//           currentCode: String(qrCodeValue).trim(),
//           updatedAt: serverTimestamp(),
//         },
//         { merge: true }
//       );
//       alert("QR code published for this store.");
//     } finally {
//       setSaving(false);
//     }
//   }

//   function printQr() {
//     if (!qrDataUrl) return;
//     const w = window.open("", "_blank");
//     if (!w) return alert("Popup blocked. Allow popups to print.");

//     const label = store?.label || storeId;

//     w.document.write(`
//       <html>
//         <head>
//           <title>${label} — QR</title>
//           <style>
//             @page { size: A4; margin: 18mm; }
//             body { font-family: Arial, sans-serif; }
//             .wrap { display: grid; place-items: center; gap: 14px; }
//             .title { font-size: 24px; font-weight: 900; text-align:center; margin-top: 10px; }
//             .sub { opacity: .75; text-align:center; font-size: 14px; max-width: 520px; }
//             .card { border: 2px solid #111; border-radius: 14px; padding: 18px; width: 100%; max-width: 520px; display:grid; place-items:center; gap: 12px; }
//             img { width: 360px; height: 360px; }
//             .code { font-family: monospace; font-size: 14px; word-break: break-all; text-align:center; }
//             .hint { opacity: 0.75; font-size: 12px; text-align:center; }
//           </style>
//         </head>
//         <body>
//           <div class="wrap">
//             <div class="title">${label}</div>
//             <div class="sub">Scan this QR at the store to enable Clock On/Off.</div>
//             <div class="card">
//               <img src="${qrDataUrl}" />
//               <div class="code">Code: ${qrCodeValue}</div>
//               <div class="hint">Tip: Publish a new QR anytime to invalidate old ones.</div>
//             </div>
//           </div>
//           <script>window.onload = () => window.print();</script>
//         </body>
//       </html>
//     `);

//     w.document.close();
//   }

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="top">
//           <div>
//             <h1 className="h1">Admin — Store Settings</h1>
//             <p className="p">Set radius + generate printable store QR.</p>
//           </div>
//           <button className="btn" onClick={loadAll} disabled={saving}>
//             Refresh
//           </button>
//         </div>

//         {loading ? (
//           <div className="empty">Loading…</div>
//         ) : (
//           <>
//             <div className="spacer" />

//             <div className="grid2">
//               <div className="field">
//                 <div className="label">Store</div>
//                 <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
//                   {STORES.map((s) => (
//                     <option key={s.id} value={s.id}>
//                       {s.label}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               <div className="field">
//                 <div className="label">Allowed radius (meters)</div>
//                 <div className="row">
//                   <input
//                     className="input"
//                     type="number"
//                     min="5"
//                     value={radiusM}
//                     onChange={(e) => setRadiusM(e.target.value)}
//                   />
//                   <button className="btn primary" onClick={saveRadius} disabled={saving}>
//                     Save
//                   </button>
//                 </div>
//                 <div className="tiny subtle">Testing: 3000. Real use: 20.</div>
//               </div>
//             </div>

//             <div className="spacer" />

//             <div className="qrBox">
//               <div className="qrLeft">
//                 <div className="strong">QR Code</div>
//                 <div className="tiny subtle">
//                   Staff must be near store + scan this QR to enable Clock On/Off.
//                 </div>

//                 <div className="spacer" />

//                 <div className="field">
//                   <div className="label">Current code</div>
//                   <input className="input" value={qrCodeValue} readOnly />
//                 </div>

//                 <div className="row">
//                   <button className="btn" onClick={generateNewQr} disabled={saving}>
//                     Generate new
//                   </button>
//                   <button className="btn primary" onClick={publishQr} disabled={saving || !qrCodeValue}>
//                     Publish
//                   </button>
//                   <button className="btn" onClick={printQr} disabled={!qrDataUrl}>
//                     Print
//                   </button>
//                 </div>

//                 <div className="tiny subtle">
//                   Tip: publish new QR to prevent old QR from being used.
//                 </div>
//               </div>

//               <div className="qrRight">
//                 {qrDataUrl ? (
//                   <img className="qrImg" src={qrDataUrl} alt="QR" />
//                 ) : (
//                   <div className="empty">No QR yet. Generate one.</div>
//                 )}
//               </div>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }






// import { useEffect, useMemo, useState, useCallback } from "react";
// import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
// import QRCode from "qrcode";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { useToast } from "../../context/ToastContext";
// import "./StoreSettings.css";

// function randomCode(prefix) {
//   const d = new Date();
//   const y = d.getFullYear();
//   const m = String(d.getMonth() + 1).padStart(2, "0");
//   const day = String(d.getDate()).padStart(2, "0");
//   const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
//   return `${prefix}-${y}-${m}-${day}-${rand}`;
// }

// function makeQrPayload({ storeId, code }) {
//   return JSON.stringify({ v: 1, storeId, code });
// }

// export default function StoreSettings() {
//   const { showToast } = useToast();
//   const [storeId, setStoreId] = useState(STORES[0]?.id || "");
//   const store = useMemo(() => STORES.find((s) => s.id === storeId), [storeId]);

//   const [radiusM, setRadiusM] = useState(3000);
//   const [qrCodeValue, setQrCodeValue] = useState(""); 
//   const [qrPayload, setQrPayload] = useState(""); 
//   const [qrDataUrl, setQrDataUrl] = useState("");

//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);

//   const loadAll = useCallback(async (isManual = false) => {
//     if (!storeId) return;
//     setLoading(true);
//     try {
//       // Load Radius
//       const settingsRef = doc(db, "storeSettings", storeId);
//       const settingsSnap = await getDoc(settingsRef);
//       if (settingsSnap.exists()) {
//         const r = settingsSnap.data()?.radiusM;
//         if (typeof r === "number" && r > 0) setRadiusM(r);
//       } else {
//         setRadiusM(3000);
//       }

//       // Load QR
//       const qrRef = doc(db, "storeQr", storeId);
//       const qrSnap = await getDoc(qrRef);
//       let code = "";
//       let payload = "";

//       if (qrSnap.exists()) {
//         const data = qrSnap.data();
//         if (data?.currentPayload) {
//           payload = String(data.currentPayload);
//           try { code = JSON.parse(payload).code; } catch { code = ""; }
//         } else {
//           code = String(data?.currentCode || "");
//           payload = code ? makeQrPayload({ storeId, code }) : "";
//         }
//       }

//       setQrCodeValue(code);
//       setQrPayload(payload);

//       if (payload) {
//         const url = await QRCode.toDataURL(payload, { margin: 2, width: 520, color: { dark: '#ffffff', light: '#00000000' } });
//         setQrDataUrl(url);
//       } else {
//         setQrDataUrl("");
//       }
//       if (isManual) showToast("Settings synced", "success");
//     } catch (e) {
//       showToast("Error loading settings", "error");
//     } finally {
//       setLoading(false);
//     }
//   }, [storeId, showToast]);

//   useEffect(() => { loadAll(); }, [loadAll]);

//   async function saveRadius() {
//     setSaving(true);
//     try {
//       await setDoc(doc(db, "storeSettings", storeId), { radiusM: Number(radiusM), updatedAt: serverTimestamp() }, { merge: true });
//       showToast("Radius updated", "success");
//     } catch (e) {
//       showToast("Failed to save radius", "error");
//     } finally {
//       setSaving(false);
//     }
//   }

//   async function generateNewQr() {
//     const prefix = storeId.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10) || "STORE";
//     const newCode = randomCode(prefix);
//     const payload = makeQrPayload({ storeId, code: newCode });

//     setQrCodeValue(newCode);
//     setQrPayload(payload);
//     const url = await QRCode.toDataURL(payload, { margin: 2, width: 520, color: { dark: '#ffffff', light: '#00000000' } });
//     setQrDataUrl(url);
//     showToast("New QR Generated locally", "info");
//   }

//   async function publishQr() {
//     if (!qrCodeValue || !qrPayload) return showToast("Generate QR first", "error");
//     setSaving(true);
//     try {
//       await setDoc(doc(db, "storeQr", storeId), { currentPayload: String(qrPayload).trim(), currentCode: String(qrCodeValue).trim(), updatedAt: serverTimestamp() }, { merge: true });
//       showToast("QR Published to Store", "success");
//     } catch (e) {
//       showToast("Publish failed", "error");
//     } finally {
//       setSaving(false);
//     }
//   }

//   function printQr() {
//     if (!qrDataUrl) return;
//     const w = window.open("", "_blank");
//     if (!w) return showToast("Popup blocked!", "error");

//     const label = store?.label || storeId;
//     // Generate high-res black QR for printing
//     QRCode.toDataURL(qrPayload, { margin: 2, width: 1000 }, (err, url) => {
//       w.document.write(`
//         <html>
//           <head><title>Print QR — ${label}</title></head>
//           <body style="font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:90vh; text-align:center;">
//             <h1 style="font-size:48px; margin-bottom:0;">${label}</h1>
//             <p style="font-size:20px; color:#666;">Scan to Clock On/Off</p>
//             <img src="${url}" style="width:500px; height:500px; border:20px solid #eee; border-radius:40px; margin:20px;" />
//             <p style="font-family:monospace; font-size:18px;">ID: ${qrCodeValue}</p>
//             <script>window.onload = () => { window.print(); window.close(); }</script>
//           </body>
//         </html>
//       `);
//       w.document.close();
//     });
//   }

//   return (
//     <div className="mobile-app-wrapper">
//       <header className="app-header">
//         <div className="header-text">
//           <h1 className="main-title">Store Configuration</h1>
//           <span className="subtitle">Security & QR Management</span>
//         </div>
//         <button className={`refresh-circle ${loading ? 'spinning' : ''}`} onClick={() => loadAll(true)}>
//           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//         </button>
//       </header>

//       <main className="scroll-content">
//         <section className="settings-card">
//           <div className="field-group">
//             <label className="section-label">Select Store</label>
//             <select className="app-input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
//               {STORES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
//             </select>
//           </div>

//           <div className="field-group">
//             <label className="section-label">Geo-Fence Radius (meters)</label>
//             <div className="input-with-btn">
//               <input className="app-input" type="number" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} />
//               <button className="btn-brand save" onClick={saveRadius} disabled={saving}>Save</button>
//             </div>
//             <p className="field-hint">20m = Standard Security. 3000m = Debug Mode.</p>
//           </div>
//         </section>

//         <section className="qr-management-card">
//           <div className="qr-header">
//             <h2 className="card-title">Store Access QR</h2>
//             <p className="card-desc">Staff must scan this to verify physical presence.</p>
//           </div>

//           <div className="qr-preview-area">
//             {qrDataUrl ? (
//               <div className="qr-container">
//                 <img src={qrDataUrl} alt="Store QR" className="qr-display" />
//                 <div className="qr-code-text">{qrCodeValue}</div>
//               </div>
//             ) : (
//               <div className="qr-placeholder">No QR Active</div>
//             )}
//           </div>

//           <div className="qr-actions-grid">
//             <button className="btn-sec" onClick={generateNewQr} disabled={saving}>
//               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
//               Regenerate
//             </button>
//             <button className="btn-brand" onClick={publishQr} disabled={saving || !qrCodeValue}>
//               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
//               Publish
//             </button>
//             <button className="btn-sec full-width" onClick={printQr} disabled={!qrDataUrl}>
//               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
//               Print Official Poster
//             </button>
//           </div>
//         </section>
//       </main>
//     </div>
//   );
// }
















import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, getDocs, collection, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
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
  
  // States for Stores
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  
  // States for Modals/Loading
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStore, setNewStore] = useState({ id: "", label: "", lat: "", lng: "" });

  // States for QR/Radius
  const [radiusM, setRadiusM] = useState(3000);
  const [qrCodeValue, setQrCodeValue] = useState(""); 
  const [qrPayload, setQrPayload] = useState(""); 
  const [qrDataUrl, setQrDataUrl] = useState("");

  // 1. Fetch all stores from Firestore
  const fetchStores = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "stores"));
      const storeList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storeList);
      if (storeList.length > 0 && !storeId) setStoreId(storeList[0].id);
    } catch (e) {
      showToast("Error loading stores", "error");
    }
  }, [showToast, storeId]);

  // 2. Load specific store settings
  const loadSettings = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const settingsSnap = await getDoc(doc(db, "storeSettings", storeId));
      setRadiusM(settingsSnap.exists() ? settingsSnap.data().radiusM : 3000);

      const qrSnap = await getDoc(doc(db, "storeQr", storeId));
      if (qrSnap.exists()) {
        const data = qrSnap.data();
        setQrCodeValue(data.currentCode || "");
        setQrPayload(data.currentPayload || "");
        if (data.currentPayload) {
          const url = await QRCode.toDataURL(data.currentPayload, { margin: 2, width: 520, color: { dark: '#ffffff', light: '#00000000' } });
          setQrDataUrl(url);
        }
      } else {
        setQrDataUrl("");
      }
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchStores(); }, [fetchStores]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  // 3. Add New Store Logic
  async function handleAddStore() {
    if (!newStore.id || !newStore.label) return showToast("ID and Label required", "error");
    setSaving(true);
    try {
      const sid = newStore.id.toLowerCase().replace(/\s+/g, '_');
      
      // Create Main Store Entry
      await setDoc(doc(db, "stores", sid), {
        label: newStore.label,
        lat: Number(newStore.lat) || 0,
        lng: Number(newStore.lng) || 0,
        radiusM: 20
      });

      // Create Settings & QR placeholders
      await setDoc(doc(db, "storeSettings", sid), { radiusM: 20, updatedAt: serverTimestamp() });
      await setDoc(doc(db, "storeQr", sid), { currentCode: "SETUP", updatedAt: serverTimestamp() });

      showToast("Store Added!", "success");
      setShowAddModal(false);
      fetchStores(); // Refresh dropdown
    } catch (e) {
      showToast("Failed to add store", "error");
    } finally {
      setSaving(false);
    }
  }


  const handleDeleteStore = async () => {
    if (!storeId) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${storeId}"? This will remove all settings and QR codes for this location.`
    );

    if (!confirmDelete) return;

    setSaving(true);
    try {
      // Delete from all three related collections
      await Promise.all([
        deleteDoc(doc(db, "stores", storeId)),
        deleteDoc(doc(db, "storeSettings", storeId)),
        deleteDoc(doc(db, "storeQr", storeId))
      ]);

      showToast("Store deleted successfully", "success");
      
      // Refresh the list and reset selection
      await fetchStores();
      setStoreId(""); 
    } catch (e) {
      console.error("Delete error:", e);
      showToast("Failed to delete store", "error");
    } finally {
      setSaving(false);
    }
  };

    const loadAll = useCallback(async (isManual = false) => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Load Radius
      const settingsRef = doc(db, "storeSettings", storeId);
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const r = settingsSnap.data()?.radiusM;
        if (typeof r === "number" && r > 0) setRadiusM(r);
      } else {
        setRadiusM(3000);
      }

      // Load QR
      const qrRef = doc(db, "storeQr", storeId);
      const qrSnap = await getDoc(qrRef);
      let code = "";
      let payload = "";

      if (qrSnap.exists()) {
        const data = qrSnap.data();
        if (data?.currentPayload) {
          payload = String(data.currentPayload);
          try { code = JSON.parse(payload).code; } catch { code = ""; }
        } else {
          code = String(data?.currentCode || "");
          payload = code ? makeQrPayload({ storeId, code }) : "";
        }
      }

      setQrCodeValue(code);
      setQrPayload(payload);

      if (payload) {
        const url = await QRCode.toDataURL(payload, { margin: 2, width: 520, color: { dark: '#ffffff', light: '#00000000' } });
        setQrDataUrl(url);
      } else {
        setQrDataUrl("");
      }
      if (isManual) showToast("Settings synced", "success");
    } catch (e) {
      showToast("Error loading settings", "error");
    } finally {
      setLoading(false);
    }
  }, [storeId, showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);


  // ... (keep your existing saveRadius, generateNewQr, publishQr, and printQr functions)

  async function saveRadius() {
    setSaving(true);
    try {
      await setDoc(doc(db, "storeSettings", storeId), { radiusM: Number(radiusM), updatedAt: serverTimestamp() }, { merge: true });
      showToast("Radius updated", "success");
    } catch (e) {
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
    const url = await QRCode.toDataURL(payload, { margin: 2, width: 520, color: { dark: '#ffffff', light: '#00000000' } });
    setQrDataUrl(url);
    showToast("New QR Generated locally", "info");
  }

  async function publishQr() {
    if (!qrCodeValue || !qrPayload) return showToast("Generate QR first", "error");
    setSaving(true);
    try {
      await setDoc(doc(db, "storeQr", storeId), { currentPayload: String(qrPayload).trim(), currentCode: String(qrCodeValue).trim(), updatedAt: serverTimestamp() }, { merge: true });
      showToast("QR Published to Store", "success");
    } catch (e) {
      showToast("Publish failed", "error");
    } finally {
      setSaving(false);
    }
  }

  // function printQr() {
  //   if (!qrDataUrl) return;
  //   const w = window.open("", "_blank");
  //   if (!w) return showToast("Popup blocked!", "error");

  //   const label = store?.label || storeId;
  //   // Generate high-res black QR for printing
  //   QRCode.toDataURL(qrPayload, { margin: 2, width: 1000 }, (err, url) => {
  //     w.document.write(`
  //       <html>
  //         <head><title>Print QR — ${label}</title></head>
  //         <body style="font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:90vh; text-align:center;">
  //           <h1 style="font-size:48px; margin-bottom:0;">${label}</h1>
  //           <p style="font-size:20px; color:#666;">Scan to Clock On/Off</p>
  //           <img src="${url}" style="width:500px; height:500px; border:20px solid #eee; border-radius:40px; margin:20px;" />
  //           <p style="font-family:monospace; font-size:18px;">ID: ${qrCodeValue}</p>
  //           <script>window.onload = () => { window.print(); window.close(); }</script>
  //         </body>
  //       </html>
  //     `);
  //     w.document.close();
  //   });
  // }

  function printQr() {
    if (!qrDataUrl) return;
    
    // FIND THE CURRENT STORE OBJECT
    const currentStore = stores.find(s => s.id === storeId);
    const label = currentStore?.label || storeId;

    const w = window.open("", "_blank");
    if (!w) return showToast("Popup blocked!", "error");

    // Generate high-res black QR for printing
    QRCode.toDataURL(qrPayload, { margin: 2, width: 1000 }, (err, url) => {
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
    <div className="mobile-app-wrapper">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Store Configuration</h1>
        </div>
        <div className="header-actions">
          <button className="add-store-btn" onClick={() => setShowAddModal(true)}>+</button>
          <button className={`refresh-circle ${loading ? 'spinning' : ''}`} onClick={fetchStores}>
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
          {/* ... Rest of Radius/QR UI stays the same ... */}
                    <div className="field-group">
          <label className="section-label">Geo-Fence Radius (meters)</label>
           <div className="input-with-btn">
               <input className="app-input" type="number" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} />
               <button className="btn-brand save" onClick={saveRadius} disabled={saving}>Save</button>  
               {/* DELETE BUTTON */}
              <button className="btn-delete" onClick={handleDeleteStore} disabled={saving}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                </svg>
              </button>           </div>
             <p className="field-hint">20m = Standard Security. 3000m = Debug Mode.</p>
          </div>
         </section>

         <section className="qr-management-card">
           <div className="qr-header">
             <h2 className="card-title">Store Access QR</h2>
             <p className="card-desc">Staff must scan this to verify physical presence.</p>
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
              Regenerate
            </button>
            <button className="btn-brand" onClick={publishQr} disabled={saving || !qrCodeValue}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Publish
            </button>
            <button className="btn-sec full-width" onClick={printQr} disabled={!qrDataUrl}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
              Print Official Poster
            </button>
          </div>
        </section>
      </main>

      {/* ADD STORE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="settings-card modal-content">
            <h2 className="card-title">New Store Location</h2>
            <input className="app-input" placeholder="Store ID (mitho_parramatta)" onChange={e => setNewStore({...newStore, id: e.target.value})} />
            <input className="app-input" placeholder="Display Name (Mitho Parramatta)" onChange={e => setNewStore({...newStore, label: e.target.value})} />
            <div style={{display:'flex', gap:'10px'}}>
               <input className="app-input" placeholder="Lat" onChange={e => setNewStore({...newStore, lat: e.target.value})} />
               <input className="app-input" placeholder="Lng" onChange={e => setNewStore({...newStore, lng: e.target.value})} />
            </div>
            <div className="modal-actions" style={{display:'flex', gap:'10px', marginTop:'15px'}}>
              <button className="btn-brand" onClick={handleAddStore} disabled={saving}>Add Store</button>
              <button className="btn-sec" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}