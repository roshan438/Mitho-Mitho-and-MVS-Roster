
// import { useEffect, useMemo, useState } from "react";
// import {
//   collectionGroup,
//   doc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
//   getDoc,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { toYMD } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import { useToast } from "../../context/ToastContext";
// import QRScanner from "../../components/QRScanner";
// import "./StaffToday.css";

// const storeLabel = (sId) => STORES.find((s) => s.id === sId)?.label || sId || "-";

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const { showToast } = useToast();
//   const uid = fbUser?.uid;
//   const today = useMemo(() => toYMD(new Date()), []);

//   const [loading, setLoading] = useState(true);
//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   // --- STOCK STATES ---
//   const [dbItems, setDbItems] = useState([]);
//   const [stockDraft, setStockDraft] = useState([]);
//   const [stockTakeDone, setStockTakeDone] = useState(false);
//   const [showStockModal, setShowStockModal] = useState(false);
//   const [submittingStock, setSubmittingStock] = useState(false);

//   // --- FORM INPUTS ---
//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   const [scanOpen, setScanOpen] = useState(false);

//   useEffect(() => { if (uid) loadToday(); }, [uid, today]);

//   useEffect(() => {
//     if (todayShift?.storeId) checkStockStatus(todayShift.storeId);
//   }, [todayShift?.storeId]);

//   // --- STOCK LOGIC ---
//   async function checkStockStatus(storeId) {
//     try {
//       const snap = await getDoc(doc(db, "dailyStockTake", `${storeId}_${today}`));
//       if (snap.exists()) {
//         setDbItems(snap.data().items || []);
//         setStockTakeDone(true);
//       } else {
//         setDbItems([]);
//         setStockTakeDone(false);
//       }
//     } catch (e) { console.error(e); }
//   }

//   const handleOpenStockModal = () => {
//     const initial = dbItems.length > 0 
//       ? dbItems.map(item => ({ ...item, id: Math.random() })) 
//       : [{ id: Math.random(), name: "", qtyRequested: "" }];
//     setStockDraft(initial);
//     setShowStockModal(true);
//   };

//   const addStockRow = () => setStockDraft([...stockDraft, { id: Math.random(), name: "", qtyRequested: "" }]);
//   const updateStockRow = (id, field, value) => setStockDraft(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
//   const removeStockRow = (id) => setStockDraft(prev => prev.filter(it => it.id !== id));

//   async function handleStockSubmit() {
//     const finalItems = stockDraft.filter(it => it.name.trim() !== "" && it.qtyRequested !== "").map(({ id, ...rest }) => ({ ...rest, status: "pending", qtySent: 0 }));
//     if (finalItems.length === 0) return showToast("Add at least one item.", "warning");
//     setSubmittingStock(true);
//     try {
//       await setDoc(doc(db, "dailyStockTake", `${todayShift.storeId}_${today}`), {
//         storeId: todayShift.storeId, storeLabel: storeLabel(todayShift.storeId), date: today,
//         lastUpdatedBy: uid, lastUpdatedByName: `${profile?.firstName} ${profile?.lastName}`,
//         items: finalItems, updatedAt: serverTimestamp()
//       }, { merge: true });
//       setDbItems(finalItems);
//       setStockTakeDone(true);
//       setShowStockModal(false);
//       showToast("Stock Synced", "success");
//     } catch (e) { showToast("Error", "error"); } finally { setSubmittingStock(false); }
//   }

//   // --- SHIFT ACTIONS ---
//   async function loadToday() {
//     setLoading(true);
//     const rosterQ = query(collectionGroup(db, "shifts"), where("uid", "==", uid), where("date", "==", today));
//     const rosterSnap = await getDocs(rosterQ);
//     if (!rosterSnap.empty) {
//       const s = { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() };
//       setTodayShift(s);
//       const tsSnap = await getDoc(doc(db, "timesheets", `${uid}_${today}`));
//       if (tsSnap.exists()) {
//         const ts = tsSnap.data();
//         setTimesheet(ts);
//         setStartInput(ts.startInput || "");
//         setBreakStartInput(ts.breakStartInput || "");
//         setBreakEndInput(ts.breakEndInput || "");
//         setEndInput(ts.endInput || "");
//       }
//     }
//     setLoading(false);
//   }

//   async function doClockOn() {
//     await setDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       uid, staffName: profile?.firstName, storeId: todayShift.storeId,
//       date: today, startInput, startActual: serverTimestamp(), status: "working"
//     }, { merge: true });
//     loadToday();
//   }

//   async function doStartBreak() {
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       breakStartInput, breakStartActual: serverTimestamp(), status: "on_break"
//     });
//     showToast("Break started", "info");
//     loadToday();
//   }

//   async function doEndBreak() {
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       breakEndInput, breakEndActual: serverTimestamp(), status: "working"
//     });
//     showToast("Break ended", "success");
//     loadToday();
//   }

//   async function doClockOff() {
//     if (!stockTakeDone) return showToast("Complete Stock Take first!", "error");
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       endInput, endActual: serverTimestamp(), status: "clocked_out"
//     });
//     loadToday();
//   }

//   const isOnBreak = timesheet?.status === "on_break";

//   if (loading) return <div className="container"><div className="card">Loading...</div></div>;

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="dashboard-header">
//           <div className="header-content">
//             <h1 className="dashboard-title">Shift Dashboard</h1>
//             <p className="dashboard-date">{today}</p>
//           </div>
//           <div className="header-actions add-item-dash">
//             {timesheet?.startActual && (
//               <button className={`stock-btn ${stockTakeDone ? "is-done" : ""}`} onClick={handleOpenStockModal}>
//                 {stockTakeDone ? "📝 Edit Stock" : "📦 Stock Take"}
//               </button>
//             )}
//           </div>



//         <button className="icon-button-refresh" onClick={loadToday} aria-label="Refresh data">
//           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//         </button>
//         </div>

//         {!todayShift ? <div className="notice">No Shift Scheduled</div> : (
//           <div className="flow">
//             <div className="shift-info-card">
//               <b>{storeLabel(todayShift.storeId)}</b> | {todayShift.startPlanned} - {todayShift.endPlanned}
//             </div>

//             {!timesheet?.startActual ? (
//               <div className="time-entry-card">
//                 <input className="time-picker" type="time" value={startInput} onChange={e => setStartInput(e.target.value)} />
//                 <button className="action-button brand-filled" onClick={doClockOn}>Clock On</button>
//               </div>
//             ) : !timesheet?.endActual ? (
//               <>
//                 {/* BREAK SECTION */}
//                 {!timesheet.breakStartActual && (
//                   <div className="break-card">
//                     <h3 className="break-title">Break</h3>
//                     <div className="input-stack">
//                       <input className="time-picker" type="time" value={breakStartInput} onChange={e => setBreakStartInput(e.target.value)} />
//                       <button className="action-button outline" onClick={doStartBreak} disabled={!breakStartInput}>Start Break</button>
//                     </div>
//                   </div>
//                 )}

//                 {isOnBreak && (
//                   <div className="break-active-card">
//                     <h3 className="break-title pulse-text">Currently on Break</h3>
//                     <div className="input-stack">
//                       <input className="time-picker" type="time" value={breakEndInput} onChange={e => setBreakEndInput(e.target.value)} />
//                       <button className="action-button brand-filled" onClick={doEndBreak} disabled={!breakEndInput}>End Break</button>
//                     </div>
//                   </div>
//                 )}

//                 {/* CLOCK OFF SECTION */}
//                 <div className={`clock-off-card ${isOnBreak || !stockTakeDone ? "is-locked" : ""}`}>
//                   {isOnBreak && <p className="small-note">End your break before clocking off.</p>}
//                   {!stockTakeDone && <p className="error-text">Complete Stock Take to unlock</p>}
//                   <div className="input-group">
//                     <input className="time-picker" type="time" value={endInput} disabled={isOnBreak || !stockTakeDone} onChange={e => setEndInput(e.target.value)} />
//                     <button className="action-button brand-filled" onClick={doClockOff} disabled={isOnBreak || !endInput || !stockTakeDone}>Clock Off</button>
//                   </div>
//                 </div>
//               </>
//             ) : (
//               <div className="summary-card">
//                 <h3>Shift Completed ✅</h3>
//                 <button className="action-button secondary" onClick={handleOpenStockModal}>Edit Stock Items</button>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* STOCK MODAL */}
//       {showStockModal && (
//         <div className="modal-overlay">
//           <div className="stock-modal">
//             <div className="modal-header">
//               <h3>Store Stock Request</h3>
//             </div>
//             <div className="stock-list-container">
//               {stockDraft.map((item) => (
//                 <div key={item.id} className="stock-row-input">
//                   <div className="input-main">
//                     <input className="item-name-input" placeholder="Item Name" value={item.name} onChange={e => updateStockRow(item.id, 'name', e.target.value)} />
//                     <input className="qty-input" type="number" placeholder="Qty" value={item.qtyRequested} onChange={e => updateStockRow(item.id, 'qtyRequested', e.target.value)} />
//                   </div>
//                   <button className="remove-row-btn" onClick={() => removeStockRow(item.id)}>✕</button>
//                 </div>
//               ))}
//               <button className="add-row-btn" onClick={addStockRow}>+ Add Item</button>
//             </div>
//             <div className="modal-actions">
//               <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button primary">Save & Sync</button>
//               <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


























// import { useEffect, useMemo, useState } from "react";
// import {
//   collectionGroup,
//   doc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
//   getDoc,
//   collection
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";

// import { useStores } from "../../hooks/useStore";
// import { toYMD } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import { useToast } from "../../context/ToastContext";
// import "./StaffToday.css";

// // const storeLabel = (sId) => STORES.find((s) => s.id === sId)?.label || sId || "-";

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const { showToast } = useToast();

//   const { stores, getStoreLabel } = useStores();

//   const uid = fbUser?.uid;
  
//   // Date Logic
//   const today = useMemo(() => toYMD(new Date()), []);
//   const tomorrow = useMemo(() => {
//     const d = new Date();
//     d.setDate(d.getDate() + 1);
//     return toYMD(d);
//   }, []);

//   const [loading, setLoading] = useState(true);
//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   // --- STOCK STATES ---
//   const [dbItems, setDbItems] = useState([]);
//   const [stockDraft, setStockDraft] = useState([]);
//   const [stockTakeDone, setStockTakeDone] = useState(false);
//   const [isAdminProcessed, setIsAdminProcessed] = useState(false);
//   const [showStockModal, setShowStockModal] = useState(false);
//   const [showDispatchModal, setShowDispatchModal] = useState(false);
//   const [submittingStock, setSubmittingStock] = useState(false);
//   const [collapsedGroups, setCollapsedGroups] = useState({});
  
//   // Kitchen-specific state
//   const [allStoreRequests, setAllStoreRequests] = useState([]);

//   // --- FORM INPUTS ---
//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   // ✅ KITCHEN DETECTION
//   const isKitchen = profile?.department === "kitchen" || todayShift?.storeId === "kitchen";

//   useEffect(() => { if (uid) loadToday(); }, [uid, today]);

//   useEffect(() => {
//     if (todayShift?.storeId) {
//       checkStockStatus(todayShift.storeId);
//       if (isKitchen) loadAllStoreRequests();
//     }
//   }, [todayShift?.storeId, isKitchen]);

//   async function checkStockStatus(storeId) {
//     try {
//       // Pull data for TODAY (which was submitted yesterday)
//       const snap = await getDoc(doc(db, "dailyStockTake", `${storeId}_${today}`));
//       if (snap.exists()) {
//         const data = snap.data();
//         setDbItems(data.items || []);
//         setIsAdminProcessed(data.adminProcessed || false);
//       }
      
//       // Check if they have already submitted for TOMORROW
//       const tomorrowSnap = await getDoc(doc(db, "dailyStockTake", `${storeId}_${tomorrow}`));
//       if (tomorrowSnap.exists()) {
//         setStockTakeDone(true);
//       }
//     } catch (e) { console.error(e); }
//   }

//   async function loadAllStoreRequests() {
//     try {
//       const q = query(collection(db, "dailyStockTake"), where("date", "==", today));
//       const snap = await getDocs(q);
//       setAllStoreRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
//     } catch (e) { console.error(e); }
//   }

//   const handleKitchenQtyChange = (docId, itemIndex, newVal) => {
//     setAllStoreRequests(prev => prev.map(req => {
//       if (req.id !== docId) return req;
//       const updatedItems = [...req.items];
//       updatedItems[itemIndex].qtySent = Number(newVal);
//       return { ...req, items: updatedItems };
//     }));
//   };

//   const toggleGroup = (id) => {
//     setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
//   };

//   const handleKitchenSubmit = async (record) => {
//     try {
//       const docRef = doc(db, "dailyStockTake", record.id);
//       await updateDoc(docRef, {
//         items: record.items,
//         adminProcessed: true,
//         processedAt: serverTimestamp(),
//         processedBy: profile?.firstName
//       });
//       showToast(`Dispatched to ${getStoreLabel(record.storeId)}`, "success");
//       loadAllStoreRequests();
//     } catch (e) { showToast("Update failed", "error"); }
//   };

//   // const handleOpenStockModal = () => {
//   //   const initial = [{ id: Math.random(), name: "", qtyRequested: "" }];
//   //   setStockDraft(initial);
//   //   setShowStockModal(true);
//   // };

//       const handleOpenStockModal = async () => {
//         setLoading(true); // Show a brief loader while fetching
//         try {
//           // Attempt to fetch tomorrow's existing request
//           const tomorrowSnap = await getDoc(doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`));
          
//           if (tomorrowSnap.exists()) {
//             const existingData = tomorrowSnap.data();
//             // Pre-fill the draft with existing items, adding a temporary ID for the React keys
//             const mappedItems = existingData.items.map(item => ({
//               ...item,
//               id: Math.random() // Unique ID for the UI list logic
//             }));
//             setStockDraft(mappedItems);
//           } else {
//             // If nothing exists, start with one empty row
//             setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]);
//           }
//           setShowStockModal(true);
//         } catch (e) {
//           showToast("Error loading existing request", "error");
//         } finally {
//           setLoading(false);
//         }
//       };

//   const addStockRow = () => setStockDraft([...stockDraft, { id: Math.random(), name: "", qtyRequested: "" }]);
//   const updateStockRow = (id, field, value) => setStockDraft(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
//   const removeStockRow = (id) => setStockDraft(prev => prev.filter(it => it.id !== id));

//   async function handleStockSubmit() {
//     const finalItems = stockDraft
//       .filter(it => it.name.trim() !== "" && it.qtyRequested !== "")
//       .map(({ id, ...rest }) => ({ ...rest, status: "pending", qtySent: 0 }));

//     if (finalItems.length === 0) return showToast("Add items.", "warning");
//     setSubmittingStock(true);
//     try {
//       // Save for TOMORROW
//       await setDoc(doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`), {
//         storeId: todayShift.storeId, 
//         storeLabel: getStoreLabel(todayShift.storeId), 
//         date: tomorrow,
//         lastUpdatedByName: profile?.firstName, 
//         items: finalItems, 
//         adminProcessed: false
//       }, { merge: true });
      
//       setStockTakeDone(true);
//       setShowStockModal(false);
//       showToast(`Request sent for ${tomorrow}`, "success");
//     } catch (e) { showToast("Error", "error"); } finally { setSubmittingStock(false); }
//   }

//   async function loadToday() {
//     setLoading(true);
//     const rosterQ = query(collectionGroup(db, "shifts"), where("uid", "==", uid), where("date", "==", today));
//     const rosterSnap = await getDocs(rosterQ);
//     if (!rosterSnap.empty) {
//       const s = { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() };
//       setTodayShift(s);
//       const tsSnap = await getDoc(doc(db, "timesheets", `${uid}_${today}`));
//       if (tsSnap.exists()) {
//         const ts = tsSnap.data();
//         setTimesheet(ts);
//         setStartInput(ts.startInput || "");
//         setBreakStartInput(ts.breakStartInput || "");
//         setBreakEndInput(ts.breakEndInput || "");
//         setEndInput(ts.endInput || "");
//       }
//     }
//     setLoading(false);
//   }

//   async function doClockOn() {
//     await setDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       uid, staffName: profile?.firstName, storeId: todayShift.storeId,
//       date: today, startInput, startActual: serverTimestamp(), status: "working"
//     }, { merge: true });
//     loadToday();
//   }

//   async function doStartBreak() {
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       breakStartInput, breakStartActual: serverTimestamp(), status: "on_break"
//     });
//     showToast("Break started", "info");
//     loadToday();
//   }

//   async function doEndBreak() {
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       breakEndInput, breakEndActual: serverTimestamp(), status: "working"
//     });
//     showToast("Break ended", "success");
//     loadToday();
//   }

//   async function doClockOff() {
//     if (!isKitchen && !stockTakeDone) return showToast("Submit tomorrow's stock first!", "error");
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       endInput, endActual: serverTimestamp(), status: "clocked_out"
//     });
//     loadToday();
//   }

//   const isOnBreak = timesheet?.status === "on_break";

//   if (loading) return <div className="container"><div className="card">Loading...</div></div>;

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="dashboard-header">
//           <div className="header-content">
//             <h1 className="dashboard-title">Shift Dashboard</h1>
//             <p className="dashboard-date">{today} {isKitchen && <span className="kitchen-pill">KITCHEN</span>}</p>
//           </div>
//           <div className="header-actions add-item-dash">
//             {!isKitchen && timesheet?.startActual && !timesheet?.endActual && (
//                <div style={{display: 'flex', gap: '8px'}}>
//                   <button className="view-log-btn" onClick={() => setShowDispatchModal(true)}>🚚 Log</button>
//                   <button className={`stock-btn ${stockTakeDone ? "is-done" : ""}`} onClick={handleOpenStockModal}>
//                     {stockTakeDone ? "📝 Edit Tomorrow" : "📦 Stock"}
//                   </button>
//                </div>
//             )}
//             <button className="icon-button-refresh" onClick={loadToday}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg></button>
//           </div>
//         </div>

//         {!todayShift ? <div className="notice">No Shift Scheduled</div> : (
//           <div className="flow">
//             <div className="shift-info-card">
//               <b>{getStoreLabel(todayShift.storeId)}</b> | {todayShift.startPlanned} - {todayShift.endPlanned}
//             </div>

//             {!timesheet?.startActual ? (
//               <div className="time-entry-card">
//                 <input className="time-picker" type="time" value={startInput} onChange={e => setStartInput(e.target.value)} />
//                 <button className="action-button brand-filled" onClick={doClockOn}>Clock On</button>
//               </div>
//             ) : !timesheet?.endActual ? (
//               <>
//                 {isKitchen && (
//                   <div className="kitchen-dispatch-area">
//                     <h3 className="section-label">Pending Orders for Today</h3>
//                     {allStoreRequests.length === 0 ? <p className="small-note">No orders today.</p> : (
//                       allStoreRequests.map(req => {
//                         const isExpanded = !!collapsedGroups[req.id];
//                         return (
//                           <div key={req.id} className="dispatch-card">
//                             <div className="dispatch-header clickable" onClick={() => toggleGroup(req.id)}>
//                               <div className="header-left">
//                                 <span className={`arrow ${isExpanded ? 'down' : 'right'}`}>▶</span>
//                                 <b>{getStoreLabel(req.storeId)}</b>
//                               </div>
//                               <span className={req.adminProcessed ? "tag-green" : "tag-orange"}>
//                                 {req.adminProcessed ? "Dispatched" : "Pending"}
//                               </span>
//                             </div>
//                             {isExpanded && (
//                               <div className="dispatch-content-wrapper">
//                                 {req.items.map((it, idx) => (
//                                   <div key={idx} className="dispatch-row">
//                                     <span>{it.name} <small>(Req: {it.qtyRequested})</small></span>
//                                     <input type="number" className="qty-send-input" value={it.qtySent || ""} placeholder="0" onChange={(e) => handleKitchenQtyChange(req.id, idx, e.target.value)} />
//                                   </div>
//                                 ))}
//                                 <button className="dispatch-submit-btn" onClick={() => handleKitchenSubmit(req)}>Save Dispatch</button>
//                               </div>
//                             )}
//                           </div>
//                         );
//                       })
//                     )}
//                   </div>
//                 )}

//                 {/* BREAK SECTION */}
//                 {!timesheet.breakStartActual ? (
//                   <div className="break-card">
//                     <h3 className="break-title">Take a Break</h3>
//                     <div className="input-stack">
//                       <input className="time-picker" type="time" value={breakStartInput} onChange={e => setBreakStartInput(e.target.value)} />
//                       <button className="action-button outline" onClick={doStartBreak} disabled={!breakStartInput}>Start Break</button>
//                     </div>
//                   </div>
//                 ) : !timesheet.breakEndActual || isOnBreak ? (
//                   <div className="break-active-card">
//                     <h3 className="break-title pulse-text">Currently on Break</h3>
//                     <div className="input-stack">
//                       <input className="time-picker" type="time" value={breakEndInput} onChange={e => setBreakEndInput(e.target.value)} />
//                       <button className="action-button brand-filled" onClick={doEndBreak} disabled={!breakEndInput}>End Break</button>
//                     </div>
//                   </div>
//                 ) : (
//                   <div className="notice success-sub">Break Completed ✅</div>
//                 )}

//                 <div className={`clock-off-card ${isOnBreak || (!isKitchen && !stockTakeDone) ? "is-locked" : ""}`}>
//                    {!isKitchen && !stockTakeDone && <p className="stock-warning-text">Submit Tomorrow's Stock Take to unlock Clock Off</p>}
//                   <div className="input-group">
//                     <input className="time-picker" type="time" value={endInput} disabled={isOnBreak} onChange={e => setEndInput(e.target.value)} />
//                     <button className="action-button brand-filled" onClick={doClockOff} disabled={isOnBreak || !endInput}>Clock Off</button>
//                   </div>
//                 </div>
//               </>
//             ) : (
//               <div className="summary-card"><h3>Shift Completed ✅</h3></div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* DISPATCH LOG POPUP */}
//       {showDispatchModal && (
//         <div className="modal-overlay">
//           <div className="stock-modal">
//             <div className="modal-header"><h3>Today's Dispatch</h3></div>
//             <div className="log-table">
//               <div className="log-row header"><span>Item</span><span>Req</span><span>Sent</span></div>
//               {dbItems.length > 0 ? dbItems.map((it, idx) => (
//                 <div key={idx} className="log-row">
//                   <span>{it.name}</span><span>{it.qtyRequested}</span>
//                   <span className={isAdminProcessed ? "text-green" : ""}>{isAdminProcessed ? it.qtySent : "..."}</span>
//                 </div>
//               )) : <p className="notice">No request found for today.</p>}
//             </div>
//             <button onClick={() => setShowDispatchModal(false)} className="action-button secondary" style={{marginTop: '20px'}}>Close</button>
//           </div>
//         </div>
//       )}

//       {/* STOCK MODAL */}
//       {/* {showStockModal && (
//         <div className="modal-overlay">
//           <div className="stock-modal">
//             <div className="modal-header">
//               <h3>Stock for {tomorrow}</h3>
//             </div>
//             <div className="stock-list-container">
//               {stockDraft.map((item) => (
//                 <div key={item.id} className="stock-row-input">
//                   <div className="input-main">
//                     <input className="item-name-input" placeholder="Item" value={item.name} onChange={e => updateStockRow(item.id, 'name', e.target.value)} />
//                     <input className="qty-input" type="number" placeholder="Qty" value={item.qtyRequested} onChange={e => updateStockRow(item.id, 'qtyRequested', e.target.value)} />
//                   </div>
//                   <button className="remove-row-btn" onClick={() => removeStockRow(item.id)}>✕</button>
//                 </div>
//               ))}
//               <button className="add-row-btn" onClick={addStockRow}>+ Add Item</button>
//             </div>
//             <div className="modal-actions">
//               <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button brand-filled">Send Request</button>
//               <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
//             </div>
//           </div>
//         </div>
//       )} */}

//       {/* STOCK MODAL */}
// {showStockModal && (
//   <div className="modal-overlay">
//     <div className="stock-modal">
//       <div className="modal-header add-item-dash">
//         <h3>Stock for {tomorrow}</h3>
//         {stockTakeDone && <p className="small-note-sub">Editing existing request</p>}
//       </div>
//       <div className="stock-list-container">
//         {stockDraft.map((item) => (
//           <div key={item.id} className="stock-row-input">
//             <div className="input-main">
//               <input 
//                 className="item-name-input" 
//                 placeholder="Item Name" 
//                 value={item.name} 
//                 onChange={e => updateStockRow(item.id, 'name', e.target.value)} 
//               />
//               <input 
//                 className="qty-input" 
//                 type="number" 
//                 placeholder="Qty" 
//                 value={item.qtyRequested} 
//                 onChange={e => updateStockRow(item.id, 'qtyRequested', e.target.value)} 
//               />
//             </div>
//             <button className="remove-row-btn" onClick={() => removeStockRow(item.id)}>✕</button>
//           </div>
//         ))}
//         <button className="add-row-btn" onClick={addStockRow}>+ Add Item</button>
//       </div>
//       <div className="modal-actions">
//         <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button brand-filled">
//           {stockTakeDone ? "Update Request" : "Send Request"}
//         </button>
//         <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
//       </div>
//     </div>
//   </div>
// )}
//     </div>
//   );
// }






















// import { useEffect, useMemo, useState, useCallback } from "react";
// import {
//   collectionGroup,
//   doc,
//   getDocs,
//   query,
//   setDoc,
//   updateDoc,
//   where,
//   serverTimestamp,
//   getDoc,
//   collection
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { prettyTime, toYMD } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import { useToast } from "../../context/ToastContext";
// import QRScanner from "../../components/QRScanner";
// import "./StaffToday.css";

// // --- HELPERS ---
// const storeLabel = (sId) => STORES.find((s) => s.id === sId)?.label || sId || "-";
// const getStoreMeta = (sId) => STORES.find((s) => s.id === sId) || null;

// function haversineMeters(aLat, aLng, bLat, bLng) {
//   const R = 6371000;
//   const toRad = (d) => (d * Math.PI) / 180;
//   const dLat = toRad(bLat - aLat);
//   const dLng = toRad(bLng - aLng);
//   const lat1 = toRad(aLat);
//   const lat2 = toRad(bLat);
//   const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
//   return 2 * R * Math.asin(Math.sqrt(x));
// }

// function getCurrentPositionPromise(options) {
//   return new Promise((resolve, reject) => {
//     if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
//     navigator.geolocation.getCurrentPosition(resolve, reject, options);
//   });
// }

// function parseQrPayload(text) {
//   try {
//     const obj = JSON.parse(String(text || ""));
//     if (obj && obj.v === 1 && obj.storeId && obj.code) return obj;
//   } catch { return null; }
//   return null;
// }

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const { showToast } = useToast();
//   const uid = fbUser?.uid;
//   const today = useMemo(() => toYMD(new Date()), []);
//   const tomorrow = useMemo(() => {
//     const d = new Date();
//     d.setDate(d.getDate() + 1);
//     return toYMD(d);
//   }, []);

//   const [loading, setLoading] = useState(true);
//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   // --- KITCHEN / STOCK STATES ---
//   const [dbItems, setDbItems] = useState([]); // Today's incoming items
//   const [stockDraft, setStockDraft] = useState([]); // Tomorrow's request draft
//   const [allStoreRequests, setAllStoreRequests] = useState([]); // For kitchen view
//   const [collapsedGroups, setCollapsedGroups] = useState({});
//   const [stockTakeDone, setStockTakeDone] = useState(false);
//   const [isAdminProcessed, setIsAdminProcessed] = useState(false);
  
//   const [showStockModal, setShowStockModal] = useState(false);
//   const [showDispatchModal, setShowDispatchModal] = useState(false);
//   const [submittingStock, setSubmittingStock] = useState(false);

//   // --- VERIFICATION / FORM ---
//   const [geo, setGeo] = useState(null);
//   const [geoErr, setGeoErr] = useState("");
//   const [geoBusy, setGeoBusy] = useState(false);
//   const [scanOpen, setScanOpen] = useState(false);
//   const [radiusM, setRadiusM] = useState(3000);
//   const [qrExpectedObj, setQrExpectedObj] = useState(null);
//   const [qrInput, setQrInput] = useState("");

//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   const isKitchen = profile?.department === "kitchen" || todayShift?.storeId === "kitchen";

//   // --- LOCATION LOGIC ---
//   const storeMeta = useMemo(() => getStoreMeta(todayShift?.storeId), [todayShift?.storeId]);
//   const distanceM = useMemo(() => {
//     if (!geo || !storeMeta?.lat || !storeMeta?.lng) return null;
//     return Math.round(haversineMeters(geo.lat, geo.lng, storeMeta.lat, storeMeta.lng));
//   }, [geo, storeMeta]);

//   const geoOk = useMemo(() => {
//     if (!geo) return false;
//     return distanceM <= radiusM && (geo.accuracy ?? 999) <= 150;
//   }, [geo, distanceM, radiusM]);

//   const qrOk = useMemo(() => {
//     if (isKitchen) return true; // Kitchen doesn't need QR
//     if (!qrExpectedObj) return false;
//     const raw = String(qrInput || "").trim();
//     const scannedObj = parseQrPayload(raw);
//     if (scannedObj) {
//       return String(scannedObj.storeId) === String(todayShift?.storeId) && String(scannedObj.code) === String(qrExpectedObj.code);
//     }
//     return raw === String(qrExpectedObj.code);
//   }, [qrInput, qrExpectedObj, todayShift, isKitchen]);

//   const canClockOn = useMemo(() => geoOk && qrOk, [geoOk, qrOk]);

//   // --- DATA LOADING ---
//   const refreshLocation = useCallback(async () => {
//     setGeoErr(""); setGeoBusy(true);
//     try {
//       const res = await getCurrentPositionPromise({ enableHighAccuracy: true, timeout: 10000 });
//       setGeo({ lat: res.coords.latitude, lng: res.coords.longitude, accuracy: res.coords.accuracy });
//     } catch (e) { setGeoErr("Location denied"); } 
//     finally { setGeoBusy(false); }
//   }, []);

//   useEffect(() => { if (uid) loadToday(); }, [uid, today]);

//   useEffect(() => {
//     if (todayShift?.storeId) {
//       loadStoreSettings(todayShift.storeId);
//       loadStoreQr(todayShift.storeId);
//       checkStockStatus(todayShift.storeId);
//       if (isKitchen) loadAllStoreRequests();
//       refreshLocation();
//     }
//   }, [todayShift, isKitchen, refreshLocation]);

//   async function loadToday() {
//     setLoading(true);
//     const rosterQ = query(collectionGroup(db, "shifts"), where("uid", "==", uid), where("date", "==", today));
//     const rosterSnap = await getDocs(rosterQ);
//     if (!rosterSnap.empty) {
//       const s = { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() };
//       setTodayShift(s);
//       const tsSnap = await getDoc(doc(db, "timesheets", `${uid}_${today}`));
//       if (tsSnap.exists()) {
//         const ts = tsSnap.data();
//         setTimesheet(ts);
//         setStartInput(ts.startInput || "");
//         setBreakStartInput(ts.breakStartInput || "");
//         setBreakEndInput(ts.breakEndInput || "");
//         setEndInput(ts.endInput || "");
//       }
//     }
//     setLoading(false);
//   }

//   // async function checkStockStatus(storeId) {
//   //   // 1. Check today's incoming (sent yesterday)
//   //   const todayDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${today}`));
//   //   if (todayDoc.exists()) {
//   //     setDbItems(todayDoc.data().items || []);
//   //     setIsAdminProcessed(todayDoc.data().adminProcessed || false);
//   //   }
//   //   // 2. Check if tomorrow's request is done
//   //   // const tomorrowDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${tomorrow}`));
//   //   // setStockTakeDone(tomorrowDoc.exists());
//   //   // if (tomorrowDoc.exists()) setStockDraft(tomorrowDoc.data().items || []);

//   //   // 2. Check if tomorrow's request is done
//   //     const tomorrowDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${tomorrow}`));

//   //     if (tomorrowDoc.exists()) {
//   //       setStockTakeDone(true);
//   //       setStockDraft(tomorrowDoc.data().items || []);
//   //     } else {
//   //       // Explicitly reset if it doesn't exist
//   //       setStockTakeDone(false);
//   //       setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]); 
//   //     }
//   // }

//   async function checkStockStatus(storeId) {
//     if (!storeId) return;
  
//     try {
//       // 1. Check today's incoming (sent yesterday)
//       const todayDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${today}`));
//       if (todayDoc.exists()) {
//         setDbItems(todayDoc.data().items || []);
//         setIsAdminProcessed(todayDoc.data().adminProcessed || false);
//       } else {
//         // Clear today's items if no delivery is expected
//         setDbItems([]);
//         setIsAdminProcessed(false);
//       }
  
//       // 2. Check if tomorrow's request is done
//       const tomorrowDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${tomorrow}`));
  
//       if (tomorrowDoc.exists()) {
//         setStockTakeDone(true);
//         // Pre-fill the draft with saved items and give them fresh IDs for the UI
//         setStockDraft(tomorrowDoc.data().items.map(item => ({
//           ...item,
//           id: Math.random() 
//         })));
//       } else {
//         // Explicitly reset if it doesn't exist
//         setStockTakeDone(false);
//         setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]); 
//       }
//     } catch (error) {
//       console.error("Error checking stock status:", error);
//       showToast("Failed to sync stock status", "error");
//     }
//   }

//   async function loadAllStoreRequests() {
//     const q = query(collection(db, "dailyStockTake"), where("date", "==", today));
//     const snap = await getDocs(q);
//     setAllStoreRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
//   }

//   async function loadStoreQr(storeId) {
//     const snap = await getDoc(doc(db, "storeQr", storeId));
//     if (snap.exists()) {
//       const data = snap.data();
//       setQrExpectedObj(data.currentPayload ? parseQrPayload(data.currentPayload) : { code: data.currentCode });
//     }
//   }

//   async function loadStoreSettings(storeId) {
//     const snap = await getDoc(doc(db, "storeSettings", storeId));
//     if (snap.exists() && snap.data().radiusM) setRadiusM(snap.data().radiusM);
//   }

//   // --- ACTIONS ---
//   async function doClockOn() {
//     if (!canClockOn) return showToast("Verification required", "error");
//     await setDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       uid, staffName: profile?.firstName, storeId: todayShift.storeId,
//       date: today, startInput, startActual: serverTimestamp(), status: "working"
//     }, { merge: true });
//     loadToday();
//   }

//   async function doStartBreak() {
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       breakStartInput, breakStartActual: serverTimestamp(), status: "on_break"
//     });
//     showToast("Break started", "info");
//     loadToday();
//   }

//   async function doEndBreak() {
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       breakEndInput, breakEndActual: serverTimestamp(), status: "working"
//     });
//     showToast("Break ended", "success");
//     loadToday();
//   }

//   async function doClockOff() {
//     if (isKitchen) {
//        const pending = allStoreRequests.some(r => !r.adminProcessed);
//        if (pending) return showToast("Please process all store requests first!", "warning");
//     } else {
//        if (!stockTakeDone) return showToast("Complete tomorrow's stock first!", "error");
//     }
//     await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//       endInput, endActual: serverTimestamp(), status: "clocked_out"
//     });
//     loadToday();
//   }


//   const handleOpenStockModal = async () => {
//         setLoading(true); // Show a brief loader while fetching
//         try {
//           // Attempt to fetch tomorrow's existing request
//           const tomorrowSnap = await getDoc(doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`));
//           console.log(tomorrow);
//           if (tomorrowSnap.exists()) {
//             const existingData = tomorrowSnap.data();
//             // Pre-fill the draft with existing items, adding a temporary ID for the React keys
//             const mappedItems = existingData.items.map(item => ({
//               ...item,
//               id: Math.random() // Unique ID for the UI list logic
//             }));
//             setStockDraft(mappedItems);
//           } else {
//             // If nothing exists, start with one empty row
//             setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]);
//           }
//           setShowStockModal(true);
//         } catch (e) {
//           showToast("Error loading existing request", "error");
//         } finally {
//           setLoading(false);
//         }
//       };

//   // Stock Modal Helpers
//   const addStockRow = () => setStockDraft([...stockDraft, { id: Math.random(), name: "", qtyRequested: "" }]);
//   const updateStockRow = (id, field, value) => setStockDraft(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
//   const removeStockRow = (id) => setStockDraft(prev => prev.filter(it => it.id !== id));

//   async function handleStockSubmit() {
//     const finalItems = stockDraft.filter(it => it.name.trim() && it.qtyRequested).map(({id, ...rest}) => ({...rest, status: "pending", qtySent: 0}));
//     setSubmittingStock(true);
//     await setDoc(doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`), {
//       storeId: todayShift.storeId, storeLabel: storeLabel(todayShift.storeId),
//       date: tomorrow, lastUpdatedByName: profile?.firstName, items: finalItems, adminProcessed: false
//     }, { merge: true });
//     setStockTakeDone(true); setShowStockModal(false); setSubmittingStock(false);
//     showToast("Request Sent", "success");
//   }

//   // Kitchen Dispatch Helpers
//   const handleKitchenQtyChange = (docId, idx, val) => {
//     setAllStoreRequests(prev => prev.map(req => {
//       if (req.id !== docId) return req;
//       const newItems = [...req.items];
//       newItems[idx].qtySent = Number(val);
//       return { ...req, items: newItems };
//     }));
//   };

//   const handleKitchenSubmit = async (record) => {
//     await updateDoc(doc(db, "dailyStockTake", record.id), { items: record.items, adminProcessed: true, processedAt: serverTimestamp() });
//     showToast("Dispatched", "success");
//     loadAllStoreRequests();
//   };

//   if (loading) return <div className="container"><div className="card">Loading...</div></div>;

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="dashboard-header">
//           <div className="header-content">
//             <h1 className="dashboard-title">Shift Dashboard</h1>
//             <p className="dashboard-date">{today} {isKitchen && <span className="kitchen-pill">KITCHEN</span>}</p>
//           </div>
//           <div className="header-actions add-item-dash">
//             {!isKitchen && timesheet?.startActual && !timesheet?.endActual && (
//               <div style={{display: 'flex', gap: '8px'}}>
//                  <button className="view-log-btn" onClick={() => setShowDispatchModal(true)}>🚚 Log</button>
//                  {/* <button className={`stock-btn ${stockTakeDone ? "is-done" : ""}`} onClick={() => setShowStockModal(true)}>
//                     {stockTakeDone ? "📝 Edit Tomorrow" : "📦 Stock"}
//                  </button> */}

//                  <button className={`stock-btn ${stockTakeDone ? "is-done" : ""}`} onClick={handleOpenStockModal}>
//                      {stockTakeDone ? "📝 Edit Tomorrow" : "📦 Stock"}
//                    </button>
                   
//               </div>
//             )}
//             <button className="refresh-circle" onClick={loadToday}>
//             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                   
//             </button>
//           </div>
//         </div>

//         {!todayShift ? <div className="notice">No shift today</div> : (
//           <>
//             <div className="shift-info-card">
//               <div className="info-segment"><span className="info-label">Store</span><b>{storeLabel(todayShift.storeId)}</b></div>
//               <div className="info-segment"><span className="info-label">Roster</span><b>{prettyTime(todayShift.startPlanned)} - {prettyTime(todayShift.endPlanned)} </b></div> 
//             </div>
//             {!timesheet?.startActual ? (
//               <div className="clock-card">
//                 <h2 className="clock-header">Verification</h2>
//                 {!canClockOn && (
//                 <div className="status-container">
//                   <div className="status-row"><div className="status-label">1. Location</div><span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>{geoOk ? "In Range" : "⚠️ You must be near the store to Clock On."}</span></div>
//                     <button className="action-button secondary" onClick={loadToday} disabled={geoBusy}>{geoBusy ? "Locating..." : "Refresh GPS)"}</button>
                    



                   
//                   {/* <div className="status-row">1. Location: <span className={geoOk ? "is-ok" : "is-warn"}>{geoOk ? "In Range" : "Check Range"}</span></div> */}
//                   {/* <button className="action-button secondary" onClick={refreshLocation} disabled={geoBusy}>{geoBusy ? "..." : "Refresh GPS"}</button> */}
//                   {!isKitchen && (
//                     <>
//                       <div className="divider" />
//                       {/* <div className="status-row">2. QR Code: <span className={qrOk ? "is-ok" : "is-warn"}>{qrOk ? "Verified" : "Pending"}</span></div>
//                       <button className="action-button primary" onClick={() => setScanOpen(true)} disabled={!geoOk}>Scan QR Code</button> */}
//                     <div className="status-row"><div className="status-label">2. QR Code</div><span className={`status-badge ${qrOk ? "is-ok" : "is-warn"}`}>{qrOk ? "Verified" : "Pending"}</span></div>
//                    <button className="action-button primary" onClick={() => setScanOpen(true)} disabled={!geoOk}>Scan QR Code</button>
                 
//                     </>

//                   )}
//                 </div>)}
//                 {canClockOn && (
//                   <div className="time-entry-card animation-fade-in" style={{marginTop:'20px'}}>
//                     <input className="time-picker" type="time" value={startInput} onChange={e => setStartInput(e.target.value)} />
//                     <button className="action-button brand-filled" onClick={doClockOn} disabled={!startInput}>Clock On</button>
//                   </div>
//                 )}
//               </div>
//             ) : !timesheet?.endActual ? (
//               <div className="flow">
//                 {/* Kitchen Specific UI */}
//                 {isKitchen && (
//                   <div className="kitchen-dispatch-area">
//                     <h3 className="section-label">Pending Store Orders</h3>
//                     {allStoreRequests.length === 0 ? <p className="small-note">No orders today.</p> : (
//                       allStoreRequests.map(req => (
//                         <div key={req.id} className="dispatch-card">
//                           <div className="dispatch-header clickable" onClick={() => setCollapsedGroups(p => ({...p, [req.id]: !p[req.id]}))}>
//                             <b>{storeLabel(req.storeId)}</b>
//                             <span className={req.adminProcessed ? "tag-green" : "tag-orange"}>{req.adminProcessed ? "Sent" : "Pending"}</span>
//                           </div>
//                           {collapsedGroups[req.id] && (
//                             <div className="dispatch-content">
//                               {req.items.map((it, idx) => (
//                                 <div key={idx} className="dispatch-row">
//                                   <span>{it.name}  - ({it.qtyRequested.replace(/[()\[\]]/g, '')}) </span>

//                                   <input type="number" className="qty-send-input" value={it.qtySent || ""} onChange={e => handleKitchenQtyChange(req.id, idx, e.target.value)} />
//                                 </div>
//                               ))}
//                               <button className="dispatch-submit-btn" onClick={() => {handleKitchenSubmit(req);setCollapsedGroups(p => ({...p, [req.id]: !p[req.id]}))}}>Save Dispatch</button>
//                             </div>
//                           )}
//                         </div>
//                       ))
//                     )}
//                   </div>
//                 )}

//                 {/* Break Management (For Everyone) */}
//                 {!timesheet.breakStartActual ? (
//                   <div className="break-card">
//                     <input className="time-picker" type="time" value={breakStartInput} onChange={e => setBreakStartInput(e.target.value)} />
//                     <button className="action-button outline" onClick={doStartBreak}>Start Break</button>
//                   </div>
//                 ) : !timesheet.breakEndActual ? (
//                   <div className="break-active-card">
//                     <input className="time-picker" type="time" value={breakEndInput} onChange={e => setBreakEndInput(e.target.value)} />
//                     <button className="action-button brand-filled" onClick={doEndBreak}>End Break</button>
//                   </div>
//                 ) : null}

//                 {/* Clock Off */}
//                 {/* <div className={`clock-off-card ${(!isKitchen && !stockTakeDone) ? "is-locked" : ""}`}>

                    
//                   <h2 className="clock-off-header">Finish Shift</h2>
//                   {!isKitchen && !stockTakeDone && <p className="stock-warning-text">Submit Tomorrow's Stock Take to unlock Clock Off</p>}
//                   <div className="input-group">
//                     <input className="time-picker" type="time" value={endInput} onChange={e => setEndInput(e.target.value)} />
//                     <button className="action-button brand-filled" onClick={doClockOff}>Clock Off</button>
//                   </div>
//                 </div> */}


//                 {/* Clock Off Section */}
//                 <div className={`clock-off-card ${
//                   ((!isKitchen && !stockTakeDone) || (isKitchen && allStoreRequests.some(r => !r.adminProcessed))) 
//                   ? "is-locked" 
//                   : ""
//                 }`}>
//                   <h2 className="clock-off-header">Finish Shift</h2>
                  
//                   {/* Warning for Store Staff */}
//                   {!isKitchen && !stockTakeDone && (
//                     <p className="stock-warning-text">Submit Tomorrow's Stock Take to unlock Clock Off</p>
//                   )}

//                   {/* Warning for Kitchen Staff */}
//                   {isKitchen && allStoreRequests.some(r => !r.adminProcessed) && (
//                     <p className="stock-warning-text" style={{ color: '#f87171' }}>
//                       ⚠️ Dispatch all pending orders to unlock Clock Off
//                     </p>
//                   )}

//                   <div className="input-group">
//                     <input 
//                       className="time-picker" 
//                       type="time" 
//                       value={endInput} 
//                       onChange={e => setEndInput(e.target.value)} 
//                     />
//                     <button 
//                       className="action-button brand-filled" 
//                       onClick={doClockOff}
//                       disabled={
//                         (!isKitchen && !stockTakeDone) || 
//                         (isKitchen && allStoreRequests.some(r => !r.adminProcessed)) ||
//                         !endInput
//                       }
//                     >
//                       Clock Off
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ) : (
//               <div className="summary-card">
//                 <h3>Shift Completed ✅</h3>
//                 {/* {timesheet.startInput + '-' + timesheet.endInput} */}
//                 {prettyTime(timesheet.startInput)}  -  {prettyTime(timesheet.endInput)}
//                 {console.log({
//                     startType: typeof timesheet.startActual,
//                     startValue: timesheet.startActual,
//                     endType: typeof timesheet.endActual
//                   })}
//                 </div>)
//                }
//           </>
//         )}
//       </div>

//       {/* MODALS */}
//       {showDispatchModal && (
//         <div className="modal-overlay" onClick={() => setShowDispatchModal(false)}>
//           <div className="stock-modal " onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>Today's Dispatch Log</h3></div>
//             <div className="stock-list-container">
//               <div className="log-row header"><span>Item</span><span>Req</span><span>Sent</span></div>
//               {dbItems.length > 0 ? dbItems.map((it, idx) => (
//                 <div key={idx} className="log-row">
//                   <span>{it.name}</span><span>{it.qtyRequested}</span>
//                   <span className={isAdminProcessed ? "text-green" : ""}>{isAdminProcessed ? it.qtySent : "..."}</span>
//                 </div>
//               )) : <p className="notice">No request found for today.</p>}
//             </div>
//             <button className="action-button secondary" onClick={() => setShowDispatchModal(false)}>Close</button>
//           </div>
//         </div>
//       )}



// {/* 
//       {showStockModal && (
//         <div className="modal-overlay">
//           <div className="stock-modal">
//             <div className="modal-header"><h3>Stock for {tomorrow}</h3></div>
//             <div className="stock-list-container">
//               {stockDraft.map((item) => (
//                 <div key={item.id} className="stock-row-input">
//                   <div className="input-main">
//                     <input className="item-name-input" placeholder="Item" value={item.name} onChange={e => updateStockRow(item.id, 'name', e.target.value)} />
//                     <input className="qty-input" type="number" placeholder="Qty" value={item.qtyRequested} onChange={e => updateStockRow(item.id, 'qtyRequested', e.target.value)} />
//                   </div>
//                   <button className="remove-row-btn" onClick={() => removeStockRow(item.id)}>✕</button>
//                 </div>
//               ))}
//               <button className="add-row-btn" onClick={addStockRow}>+ Add Item</button>
//             </div>
//             <div className="modal-actions">
//               <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button brand-filled">{stockTakeDone ? "Update" : "Send"}</button>
//               <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
//             </div>
//           </div>
//         </div>
//       )} */}


//        {/* STOCK MODAL */}
//  {showStockModal && (
//   <div className="modal-overlay">
//     <div className="stock-modal">
//       <div className="modal-header add-item-dash">
//         <h3>Stock for {tomorrow}</h3>
//         {stockTakeDone && <p className="small-note-sub">Editing existing request</p>}
//       </div>
//       <div className="stock-list-container">
//         {stockDraft.map((item) => (
//           <div key={item.id} className="stock-row-input">
//             <div className="input-main">
//               <input 
//                 className="item-name-input" 
//                 placeholder="Item Name" 
//                 value={item.name} 
//                 onChange={e => updateStockRow(item.id, 'name', e.target.value)} 
//               />
//               <input 
//                 className="qty-input" 
//                 type="number" 
//                 placeholder="Qty" 
//                 value={item.qtyRequested} 
//                 onChange={e => updateStockRow(item.id, 'qtyRequested', e.target.value)} 
//               />
//             </div>
//             <button className="remove-row-btn" onClick={() => removeStockRow(item.id)}>✕</button>
//           </div>
//         ))}
//         <button className="add-row-btn" onClick={addStockRow}>+ Add Item</button>
//       </div>
//       <div className="modal-actions">
//         <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button brand-filled">
//           {stockTakeDone ? "Update Request" : "Send Request"}
//         </button>
//         <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
//       </div>
//     </div>
//   </div>
// )}

//       <QRScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={res => setQrInput(res)} />
//     </div>
//   );
// }
























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
import { STORES } from "../../utils/constants";
import { prettyTime, toYMD } from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import QRScanner from "../../components/QRScanner";
import "./StaffToday.css";

// --- HELPERS ---
const storeLabel = (sId) => STORES.find((s) => s.id === sId)?.label || sId || "-";
const getStoreMeta = (sId) => STORES.find((s) => s.id === sId) || null;

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

// function parseStockBulkText(text) {
//   if (!text?.trim()) return [];

//   return text
//     .split("\n")
//     .map((line) => line.trim())
//     .filter(Boolean)
//     .map((line) => {
//       const match = line.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?))?$/);
//       const name = match?.[1]?.trim() || "";
//       const qty = match?.[2] ? Number(match[2]) : 1;

//       return {
//         name,
//         qtyRequested: qty,
//         status: "pending",
//         qtySent: 0,
//       };
//     })
//     .filter((item) => item.name);
// }


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

    // If last part is number → treat as qty
    if (!isNaN(lastPart)) {
      qty = Number(lastPart);
      nameParts.pop();
    }

    const name = nameParts.join(" ");

    if (!name) {
      throw new Error(`Missing item name on line ${i + 1}`);
    }

    // 🚨 Reject if name contains any number
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

  // --- KITCHEN / STOCK STATES ---
  const [dbItems, setDbItems] = useState([]);
  const [stockDraft, setStockDraft] = useState([]);
  const [allStoreRequests, setAllStoreRequests] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [stockTakeDone, setStockTakeDone] = useState(false);
  const [isAdminProcessed, setIsAdminProcessed] = useState(false);

  const [showStockModal, setShowStockModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [submittingStock, setSubmittingStock] = useState(false);

  // --- STORE SETTING STATE ---
  const [storeClosingTime, setStoreClosingTime] = useState("");
  const [radiusM, setRadiusM] = useState(3000);

  // --- VERIFICATION / FORM ---
  const [geo, setGeo] = useState(null);
  const [geoErr, setGeoErr] = useState("");
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

  // --- LOCATION LOGIC ---
  const storeMeta = useMemo(() => getStoreMeta(todayShift?.storeId), [todayShift?.storeId]);

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

  // --- CLOSING SHIFT LOGIC ---
  const isClosingShift = useMemo(() => {
    if (isKitchen) return false;

    const shiftEnd = hmToMinutes(todayShift?.endPlanned);
    const closingEnd = hmToMinutes(storeClosingTime);

    if (shiftEnd == null || closingEnd == null) return false;

    return shiftEnd >= closingEnd;
  }, [todayShift?.endPlanned, storeClosingTime, isKitchen]);

  const stockRequiredForClockOff = !isKitchen && isClosingShift;

  // --- DATA LOADING ---
  const refreshLocation = useCallback(async () => {
    setGeoErr("");
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
    } catch (e) {
      setGeoErr("Location denied");
    } finally {
      setGeoBusy(false);
    }
  }, []);

  useEffect(() => {
    if (uid) loadToday();
  }, [uid, today]);

  useEffect(() => {
    if (todayShift?.storeId) {
      loadStoreSettings(todayShift.storeId);
      loadStoreQr(todayShift.storeId);
      checkStockStatus(todayShift.storeId);
      if (isKitchen) loadAllStoreRequests();
      refreshLocation();
    }
  }, [todayShift, isKitchen, refreshLocation]);

  async function loadToday() {
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
      }
    } catch (error) {
      console.error("Error loading today shift:", error);
      showToast("Failed to load shift", "error");
    } finally {
      setLoading(false);
    }
  }

  async function checkStockStatus(storeId) {
    if (!storeId) return;

    try {
      // Today's incoming
      const todayDoc = await getDoc(doc(db, "dailyStockTake", `${storeId}_${today}`));
      if (todayDoc.exists()) {
        setDbItems(todayDoc.data().items || []);
        setIsAdminProcessed(todayDoc.data().adminProcessed || false);
      } else {
        setDbItems([]);
        setIsAdminProcessed(false);
      }

      // Tomorrow request exists?
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
  }

  async function loadAllStoreRequests() {
    const q = query(collection(db, "dailyStockTake"), where("date", "==", today));
    const snap = await getDocs(q);
    setAllStoreRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function loadStoreQr(storeId) {
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
  }

  async function loadStoreSettings(storeId) {
    try {
      // storeSettings for radius
      const settingsSnap = await getDoc(doc(db, "storeSettings", storeId));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (data?.radiusM) setRadiusM(data.radiusM);
      }

      // stores collection for closingTime
      const storeSnap = await getDoc(doc(db, "stores", storeId));
      if (storeSnap.exists()) {
        const data = storeSnap.data();
        if (data?.closingTime) {
          setStoreClosingTime(data.closingTime);
        } else {
          setStoreClosingTime("");
        }
      } else {
        setStoreClosingTime("");
      }
    } catch (error) {
      console.error("Error loading store settings:", error);
    }
  }

  // --- ACTIONS ---
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

  // const handleOpenStockModal = async () => {
  //   setLoading(true);
  //   try {
  //     const tomorrowSnap = await getDoc(
  //       doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`)
  //     );

  //     if (tomorrowSnap.exists()) {
  //       const existingData = tomorrowSnap.data();
  //       const mappedItems = (existingData.items || []).map((item) => ({
  //         ...item,
  //         id: Math.random(),
  //       }));
  //       setStockDraft(mappedItems);
  //     } else {
  //       setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]);
  //     }
  //     setShowStockModal(true);
  //   } catch (e) {
  //     showToast("Error loading existing request", "error");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // Stock Modal Helpers
  
  
  
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
    } catch (e) {
      showToast("Error loading existing request", "error");
    } finally {
      setLoading(false);
    }
  };
  
  
  const addStockRow = () =>
    setStockDraft([...stockDraft, { id: Math.random(), name: "", qtyRequested: "" }]);

  const updateStockRow = (id, field, value) =>
    setStockDraft((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

  const removeStockRow = (id) =>
    setStockDraft((prev) => prev.filter((it) => it.id !== id));

  // async function handleStockSubmit() {
  //   const finalItems = stockDraft
  //     .filter((it) => it.name.trim() && it.qtyRequested)
  //     .map(({ id, ...rest }) => ({
  //       ...rest,
  //       status: "pending",
  //       qtySent: 0,
  //     }));

  //   setSubmittingStock(true);

  //   await setDoc(
  //     doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`),
  //     {
  //       storeId: todayShift.storeId,
  //       storeLabel: storeLabel(todayShift.storeId),
  //       date: tomorrow,
  //       lastUpdatedByName: profile?.firstName,
  //       items: finalItems,
  //       adminProcessed: false,
  //     },
  //     { merge: true }
  //   );

  //   setStockTakeDone(true);
  //   setShowStockModal(false);
  //   setSubmittingStock(false);
  //   showToast("Request Sent", "success");
  // }

  // Kitchen Dispatch Helpers
  
  
  
  
  // async function handleStockSubmit() {
  //   const finalItems = parseStockBulkText(stockBulkText);
  
  //   if (finalItems.length === 0) {
  //     showToast("Please enter at least one item", "error");
  //     return;
  //   }
  
  //   setSubmittingStock(true);
  
  //   try {
  //     await setDoc(
  //       doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`),
  //       {
  //         storeId: todayShift.storeId,
  //         storeLabel: storeLabel(todayShift.storeId),
  //         date: tomorrow,
  //         lastUpdatedByName: profile?.firstName,
  //         items: finalItems,
  //         adminProcessed: false,
  //       },
  //       { merge: true }
  //     );
  
  //     setStockDraft(
  //       finalItems.map((item) => ({
  //         ...item,
  //         id: Math.random(),
  //       }))
  //     );
  //     setStockTakeDone(true);
  //     setShowStockModal(false);
  //     showToast("Request Sent", "success");
  //   } catch (e) {
  //     showToast("Failed to save stock request", "error");
  //   } finally {
  //     setSubmittingStock(false);
  //   }
  // }

  

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
    } catch (err) {
      showToast(err.message || "Failed to save stock", "error");
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

  if (loading) return <div className="container"><div className="card">Loading...</div></div>;

  return (
    <div className="container">
      <div className="card">
        <div className="dashboard-header">
          <div className="header-content">
            <h1 className="dashboard-title">Shift Dashboard</h1>
            <p className="dashboard-date">
              {today} {isKitchen && <span className="kitchen-pill">KITCHEN</span>}
            </p>
          </div>

          <div className="header-actions add-item-dash">
            {!isKitchen && timesheet?.startActual 
            // && !timesheet?.endActual 
            && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="view-log-btn" onClick={() => setShowDispatchModal(true)}>
                  🚚 Log
                </button>

                {/* {isClosingShift && (
                  <button
                    className={`stock-btn ${stockTakeDone ? "is-done" : ""}`}
                    onClick={handleOpenStockModal}
                  >
                    {stockTakeDone ? "📝 Edit Stock" : "📦 Stock"}
                  </button>
                )} */}

                  <button
                    className={`stock-btn ${stockTakeDone ? "is-done" : ""}`}
                    onClick={handleOpenStockModal}
                  >
                    {stockTakeDone ? "📝 Edit Stock" : "📦 Stock"}
                  </button>
              </div>
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
          <div className="notice">No shift today</div>
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

                
                  <div className="status-container">
                    <div className="status-row">
                      <div className="status-label">1. Location</div>
                      <span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>
                        {geoOk ? "In Range" : "⚠️ You must be near the store to Clock On."}
                      </span>
                    </div>

                    <button
                      className="action-button secondary"
                      onClick={loadToday}
                      disabled={geoBusy}
                    >
                      {geoBusy ? "Locating..." : "Refresh GPS)"}
                    </button>

                    {!isKitchen && (
                      <>
                        <div className="divider" />
                        <div className="status-row">
                          <div className="status-label">2. QR Code</div>
                          <span className={`status-badge ${qrOk ? "is-ok" : "is-warn"}`}>
                            {qrOk ? "Verified" : "Pending"}
                          </span>
                        </div>
                        <button
                          className="action-button primary"
                          onClick={() => setScanOpen(true)}
                          disabled={!geoOk}
                        >
                          Scan QR Code
                        </button>
                      </>
                    )}
                  </div>
                </>)}

                {canClockOn && (
                  <div className="time-entry-card animation-fade-in" style={{ marginTop: "20px" }}>
                    <input
                      className="time-picker"
                      type="time"
                      value={startInput}
                      onChange={(e) => setStartInput(e.target.value)}
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
                {/* Kitchen Specific UI */}
                {/* {isKitchen && (
                  <div className="kitchen-dispatch-area">
                    <h3 className="section-label">Pending Store Orders</h3>
                    {allStoreRequests.length === 0 ? (
                      <p className="small-note">No orders today.</p>
                    ) : (
                      allStoreRequests.map((req) => (
                        <div key={req.id} className="dispatch-card">
                          <div
                            className="dispatch-header clickable"
                            onClick={() =>
                              setCollapsedGroups((p) => ({ ...p, [req.id]: !p[req.id] }))
                            }
                          >
                            <b>{storeLabel(req.storeId)}</b>
                            <span className={req.adminProcessed ? "tag-green" : "tag-orange"}>
                              {req.adminProcessed ? "Sent" : "Pending"}
                            </span>
                          </div>

                          {collapsedGroups[req.id] && (
                            <div className="dispatch-content">
                              {req.items.map((it, idx) => (
                                <div key={idx} className="dispatch-row">
                                  <span>
                                    {it.name} - ({String(it.qtyRequested).replace(/[()\[\]]/g, "")})
                                  </span>

                                  <input
                                    type="number"
                                    className="qty-send-input"
                                    value={it.qtySent || ""}
                                    onChange={(e) =>
                                      handleKitchenQtyChange(req.id, idx, e.target.value)
                                    }
                                  />
                                </div>
                              ))}
                              <button
                                className="dispatch-submit-btn"
                                onClick={() => {
                                  handleKitchenSubmit(req);
                                  setCollapsedGroups((p) => ({ ...p, [req.id]: !p[req.id] }));
                                }}
                              >
                                Save Dispatch
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )} */}

{isKitchen && (
  <div className="kitchen-dispatch-area">
    <h3 className="section-label">Today's Orders</h3>

    {allStoreRequests.length === 0 ? (
      <p className="small-note">No orders today.</p>
    ) : (
      allStoreRequests.map((req) => {
        const isOpen = collapsedGroups[req.id];

        const totalItems = req.items.length;
        const fulfilled = req.items.filter(
          it => Number(it.qtySent) >= Number(it.qtyRequested)
        ).length;

        const percent = Math.round((fulfilled / totalItems) * 100);

        return (
          <div key={req.id} className="dispatch-card enhanced">
            
            <div
              className="dispatch-header clickable enhanced-header"
              onClick={() =>
                setCollapsedGroups(prev => ({
                  [req.id]: !prev[req.id]
                }))
              }
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

            {isOpen && (
              <div className="dispatch-content enhanced-content">
                {req.items.map((it, idx) => (
                  <div key={idx} className="dispatch-row enhanced-row">
                    <div className="item-left">
                      <div className="item-name">{it.name}</div>
                      <div className="req-text">Req: {it.qtyRequested}</div>
                    </div>

                    <input
                      type="number"
                      className="qty-send-input large"
                      value={it.qtySent || ""}
                      onChange={(e) =>
                        handleKitchenQtyChange(req.id, idx, e.target.value)
                      }
                    />
                  </div>
                ))}

                <button
                  className="dispatch-submit-btn sticky"
                  onClick={() => {
                    handleKitchenSubmit(req);
                    setCollapsedGroups({});
                  }}
                >
                  Save Dispatch
                </button>
              </div>
            )}
          </div>
        );
      })
    )}
  </div>
)}

                {/* Break Management */}
                {!timesheet.breakStartActual ? (
                  <div className="break-card">
                    <input
                      className="time-picker"
                      type="time"
                      value={breakStartInput}
                      onChange={(e) => setBreakStartInput(e.target.value)}
                    />
                    <button className="action-button outline" onClick={doStartBreak}>
                      Start Break
                    </button>
                  </div>
                ) : !timesheet.breakEndActual ? (
                  <div className="break-active-card">
                    <input
                      className="time-picker"
                      type="time"
                      value={breakEndInput}
                      onChange={(e) => setBreakEndInput(e.target.value)}
                    />
                    <button className="action-button brand-filled" onClick={doEndBreak}>
                      End Break
                    </button>
                  </div>
                ) : null}

                {/* Clock Off Section */}
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
                    <input
                      className="time-picker"
                      type="time"
                      value={endInput}
                      onChange={(e) => setEndInput(e.target.value)}
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

      {/* MODALS */}
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

      {/* STOCK MODAL */}
      {/* {showStockModal && (
        <div className="modal-overlay">
          <div className="stock-modal">
            <div className="modal-header add-item-dash">
              <h3>Stock for {tomorrow}</h3>
              {stockTakeDone && <p className="small-note-sub">Editing existing request</p>}
            </div>
            <div className="stock-list-container">
              {stockDraft.map((item) => (
                <div key={item.id} className="stock-row-input">
                  <div className="input-main">
                    <input
                      className="item-name-input"
                      placeholder="Item Name"
                      value={item.name}
                      onChange={(e) => updateStockRow(item.id, "name", e.target.value)}
                    />
                    <input
                      className="qty-input"
                      type="number"
                      placeholder="Qty"
                      value={item.qtyRequested}
                      onChange={(e) =>
                        updateStockRow(item.id, "qtyRequested", e.target.value)
                      }
                    />
                  </div>
                  <button
                    className="remove-row-btn"
                    onClick={() => removeStockRow(item.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="add-row-btn" onClick={addStockRow}>
                + Add Item
              </button>
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
      )} */}




      {/* STOCK MODAL */}
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