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
//   Timestamp,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { toYMD } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import "./StaffToday.css";
// import QRScanner from "../../components/QRScanner";

// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }
// function getStoreMeta(storeId) {
//   return STORES.find((s) => s.id === storeId) || null;
// }

// // Distance calc (meters)
// function haversineMeters(aLat, aLng, bLat, bLng) {
//   const R = 6371000;
//   const toRad = (d) => (d * Math.PI) / 180;
//   const dLat = toRad(bLat - aLat);
//   const dLng = toRad(bLng - aLng);
//   const lat1 = toRad(aLat);
//   const lat2 = toRad(bLat);

//   const x =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

//   return 2 * R * Math.asin(Math.sqrt(x));
// }

// function getCurrentPositionPromise(options) {
//   return new Promise((resolve, reject) => {
//     if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
//     navigator.geolocation.getCurrentPosition(resolve, reject, options);
//   });
// }

// // New: parse QR payload JSON
// function parseQrPayload(text) {
//   try {
//     const obj = JSON.parse(String(text || ""));
//     if (obj && obj.v === 1 && obj.storeId && obj.code) return obj;
//   } catch {}
//   return null;
// }

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const uid = fbUser?.uid;

//   const today = useMemo(() => toYMD(new Date()), []);
//   const [loading, setLoading] = useState(true);

//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   // input fields (only show after verified)
//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   // Geo + QR gate
//   const [geo, setGeo] = useState(null);
//   const [geoErr, setGeoErr] = useState("");
//   const [geoBusy, setGeoBusy] = useState(false);

//   const [scanOpen, setScanOpen] = useState(false);

//   // radius from storeSettings (default 3000 for testing)
//   const [radiusM, setRadiusM] = useState(3000);

//   // QR expected + scanned
//   const [qrExpectedPayload, setQrExpectedPayload] = useState(""); // JSON string from Firestore
//   const [qrExpectedObj, setQrExpectedObj] = useState(null); // parsed {storeId, code, v}
//   const [qrInput, setQrInput] = useState(""); // scanned raw text or typed (still allowed)
//   const [qrBusy, setQrBusy] = useState(false);

//   // UX: once verified, hide scan/input
//   const [verifiedOnce, setVerifiedOnce] = useState(false);

//   const storeMeta = useMemo(() => getStoreMeta(todayShift?.storeId), [todayShift?.storeId]);

//   const distanceM = useMemo(() => {
//     if (!geo || !storeMeta?.lat || !storeMeta?.lng) return null;
//     return Math.round(haversineMeters(geo.lat, geo.lng, storeMeta.lat, storeMeta.lng));
//   }, [geo, storeMeta]);

//   const withinRadius = useMemo(() => {
//     if (distanceM == null) return false;
//     return distanceM <= radiusM;
//   }, [distanceM, radiusM]);

//   const geoOk = useMemo(() => {
//     if (!geo) return false;
//     // keep accuracy check reasonable; you can adjust
//     return withinRadius && (geo.accuracy ?? 999) <= 80;
//   }, [geo, withinRadius]);

//   // QR match logic:
//   // - accept scanned JSON payload {storeId, code}
//   // - also accept plain code only if it matches expected code (fallback)
//   const qrOk = useMemo(() => {
//     if (!qrExpectedObj) return false;

//     const raw = String(qrInput || "").trim();
//     if (!raw) return false;

//     const scannedObj = parseQrPayload(raw);

//     // If scanned payload JSON:
//     if (scannedObj) {
//       return (
//         String(scannedObj.storeId) === String(todayShift?.storeId) &&
//         String(scannedObj.code) === String(qrExpectedObj.code)
//       );
//     }

//     // Fallback: raw code typed
//     return String(raw) === String(qrExpectedObj.code);
//   }, [qrInput, qrExpectedObj, todayShift?.storeId]);

//   const verifiedForActions = geoOk && qrOk;

//   useEffect(() => {
//     if (!uid) return;
//     loadToday();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [uid]);

//   // When shift loads / store changes, pull expected QR & refresh location + settings
//   useEffect(() => {
//     if (!todayShift?.storeId) return;
//     setVerifiedOnce(false);
//     setQrInput("");
//     setQrExpectedObj(null);
//     setQrExpectedPayload("");
//     refreshLocation();
//     loadStoreSettings(todayShift.storeId);
//     loadStoreQr(todayShift.storeId);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [todayShift?.storeId]);

//   // When verified becomes true, lock it in (for UI), vibrate, close scanner
//   useEffect(() => {
//     if (!verifiedForActions) return;
//     if (!verifiedOnce) {
//       setVerifiedOnce(true);
//       setScanOpen(false);
//       // Vibrate phone (supported on most Android; iOS limited)
//       if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [verifiedForActions]);

//   async function refreshLocation() {
//     setGeoErr("");
//     setGeoBusy(true);
//     try {
//       const res = await getCurrentPositionPromise({
//         enableHighAccuracy: true,
//         timeout: 8000,
//         maximumAge: 10000,
//       });
//       setGeo({
//         lat: res.coords.latitude,
//         lng: res.coords.longitude,
//         accuracy: res.coords.accuracy,
//         checkedAt: new Date(),
//       });
//     } catch (e) {
//       setGeoErr(e?.message || "Location permission denied");
//       setGeo(null);
//     } finally {
//       setGeoBusy(false);
//     }
//   }

//   async function loadStoreQr(storeId) {
//     setQrBusy(true);
//     try {
//       const ref = doc(db, "storeQr", storeId);
//       const snap = await getDoc(ref);

//       // new: currentPayload (JSON string)
//       const payload = snap.exists() ? String(snap.data()?.currentPayload || "") : "";
//       setQrExpectedPayload(payload);

//       let obj = null;
//       if (payload) obj = parseQrPayload(payload);
//       // fallback to legacy currentCode if needed:
//       if (!obj && snap.exists()) {
//         const legacyCode = String(snap.data()?.currentCode || "");
//         if (legacyCode) obj = { v: 1, storeId, code: legacyCode };
//       }

//       setQrExpectedObj(obj);
//     } finally {
//       setQrBusy(false);
//     }
//   }

//   async function loadStoreSettings(storeId) {
//     const ref = doc(db, "storeSettings", storeId);
//     const snap = await getDoc(ref);
//     if (snap.exists()) {
//       const r = snap.data()?.radiusM;
//       if (typeof r === "number" && r > 0) setRadiusM(r);
//       else setRadiusM(3000);
//     } else {
//       setRadiusM(3000);
//     }
//   }

//   async function loadToday() {
//     setLoading(true);

//     // 1) roster shift for today
//     const rosterQ = query(
//       collectionGroup(db, "shifts"),
//       where("uid", "==", uid),
//       where("date", "==", today)
//     );
//     const rosterSnap = await getDocs(rosterQ);

//     const shift = rosterSnap.docs.length
//       ? { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() }
//       : null;
//     setTodayShift(shift);

//     // 2) today timesheet if exists
//     const timesheetId = `${uid}_${today}`;
//     const tsRef = doc(db, "timesheets", timesheetId);
//     const tsSnap = await getDoc(tsRef);

//     if (tsSnap.exists()) {
//       const ts = tsSnap.data();
//       setTimesheet({ id: timesheetId, ...ts });

//       setStartInput(ts.startInput || "");
//       setBreakStartInput(ts.breakStartInput || "");
//       setBreakEndInput(ts.breakEndInput || "");
//       setEndInput(ts.endInput || "");
//     } else {
//       setTimesheet(null);
//     }

//     setLoading(false);
//   }

//   function mustHaveShift() {
//     if (!todayShift) {
//       alert("No rostered shift today.");
//       return false;
//     }
//     return true;
//   }

//   function mustBeVerified(actionLabel) {
//     if (!geo) {
//       alert(`Location not available. Please allow location to ${actionLabel}.`);
//       return false;
//     }
//     if (!geoOk) {
//       alert(`You must be within ${radiusM}m of the store to ${actionLabel}.`);
//       return false;
//     }
//     if (!qrExpectedObj) {
//       alert("QR code is not set for this store. Ask admin.");
//       return false;
//     }
//     if (!qrOk) {
//       alert("QR code is incorrect. Please scan the store QR.");
//       return false;
//     }
//     return true;
//   }

//   async function doClockOn() {
//     if (!mustHaveShift()) return;
//     if (!startInput) return alert("Enter start time (input).");
//     if (!mustBeVerified("Clock On")) return;

//     const timesheetId = `${uid}_${today}`;
//     const tsRef = doc(db, "timesheets", timesheetId);

//     await setDoc(
//       tsRef,
//       {
//         uid,
//         staffName:
//           `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || profile?.email || "",
//         storeId: todayShift.storeId,
//         date: today,

//         startInput,
//         startActual: serverTimestamp(),

//         verification: {
//           clockOn: {
//             geo: {
//               lat: geo.lat,
//               lng: geo.lng,
//               accuracy: geo.accuracy ?? null,
//               distanceM: distanceM ?? null,
//               checkedAt: Timestamp.fromDate(geo.checkedAt || new Date()),
//               radiusMUsed: radiusM,
//             },
//             qrMatched: true,
//             qrValue: String(qrInput || "").trim(),
//             verifiedAt: serverTimestamp(),
//           },
//         },

//         status: "working",
//         createdAt: serverTimestamp(),
//         updatedAt: serverTimestamp(),
//       },
//       { merge: true }
//     );

//     await loadToday();
//   }

//   async function doStartBreak() {
//     if (!mustHaveShift()) return;
//     if (!breakStartInput) return alert("Enter break start time (input).");

//     const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//     await updateDoc(tsRef, {
//       breakStartInput,
//       breakStartActual: serverTimestamp(),
//       status: "on_break",
//       updatedAt: serverTimestamp(),
//     });

//     await loadToday();
//   }

//   async function doEndBreak() {
//     if (!mustHaveShift()) return;
//     if (!breakEndInput) return alert("Enter break end time (input).");

//     const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//     await updateDoc(tsRef, {
//       breakEndInput,
//       breakEndActual: serverTimestamp(),
//       status: "working",
//       updatedAt: serverTimestamp(),
//     });

//     await loadToday();
//   }

//   async function doClockOff() {
//     if (!mustHaveShift()) return;
//     if (!endInput) return alert("Enter end time (input).");

//     const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//     await updateDoc(tsRef, {
//       endInput,
//       endActual: serverTimestamp(),
//       status: "clocked_out",
//       updatedAt: serverTimestamp(),

//       "verification.clockOff": {
//         geo: {
//           lat: geo.lat,
//           lng: geo.lng,
//           accuracy: geo.accuracy ?? null,
//           distanceM: distanceM ?? null,
//           checkedAt: Timestamp.fromDate(geo.checkedAt || new Date()),
//           radiusMUsed: radiusM,
//         },
//         qrMatched: true,
//         qrValue: String(qrInput || "").trim(),
//         verifiedAt: serverTimestamp(),
//       },
//     });

//     await loadToday();
//   }

//   // --- UI states for step-flow ---
//   const showVerifyStep = !!todayShift && !timesheet?.endActual && !verifiedOnce;
//   const showClockOnStep = !!todayShift && !timesheet?.startActual && verifiedOnce;
//   const showAfterClockOn = !!timesheet?.startActual && !timesheet?.endActual;
//   const showDone = !!timesheet?.endActual;

//   if (loading) {
//     return (
//       <div className="container">
//         <div className="card">
//           <p className="p">Loading…</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="container">
//       <div className="card">
//         {/* <div className="top">
//           <div>
//             <h1 className="h1">Today</h1>
//             <p className="p">
//               Date: <b>{today}</b>
//             </p>
//           </div>
//           <button className="btn" onClick={loadToday}>
//             Refresh
//           </button>
//         </div> */}

//         <div className="dashboard-header">
//           <div className="header-content">
//             <h1 className="dashboard-title">Today</h1>
//             <p className="dashboard-date">
//               Current Date: <span className="date-highlight">{today}</span>
//             </p>
//           </div>
//           <button className="icon-button-refresh" onClick={loadToday} aria-label="Refresh data">
//             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//           </button>
//         </div>

//         {/* <div className="spacer" /> */}

//         {!todayShift ? (
//           <div className="notice">
//             <div className="noticeTitle">No shift today</div>
//             <div className="noticeSub">If you believe this is wrong, contact your admin.</div>
//           </div>
//         ) : (
//           <>
//             {/* <div className="shiftInfo">
//               <div className="infoRow">
//                 <div className="k">Store</div>
//                 <div className="v">{storeLabel(todayShift.storeId)}</div>
//               </div>
//               <div className="infoRow">
//                 <div className="k">Planned</div>
//                 <div className="v">
//                   {todayShift.startPlanned} – {todayShift.endPlanned}
//                 </div>
//               </div>
//             </div> */}

//             <div className="shift-info-card">
//               <div className="info-segment">
//                 <span className="info-label">Store Location</span>
//                 <span className="info-value primary-link">{storeLabel(todayShift.storeId)}</span>
//               </div>
              
//               <div className="info-divider-vertical" />

//               <div className="info-segment">
//                 <span className="info-label">Planned Shift</span>
//                 <span className="info-value">
//                   {todayShift.startPlanned} <span className="arrow">→</span> {todayShift.endPlanned}
//                 </span>
//               </div>
//             </div>

//             {/* <div className="spacer" /> */}

//             {/* STEP 1: Verify (location + QR) */}
//             {todayShift && !timesheet?.startActual && (
//               <div className="stVerifyWrap">
//                 {showVerifyStep && (
//                           // <div className="panel">
//                           //   <div className="panelTitle center">Clock</div>
//                           //   <div className="panelSub center">
//                           //     Clock on/off is only available near the store and with correct QR.
//                           //   </div>

//                           //   <div className="verifyMini">
//                           //     <div className="verifyLine">
//                           //       <div className="small subtle">Location</div>
//                           //       <div className="mono">
//                           //         {geo
//                           //           ? `${distanceM ?? "-"}m away (±${Math.round(geo.accuracy ?? 0)}m)`
//                           //           : geoErr
//                           //           ? "Not available"
//                           //           : "Not checked"}
//                           //       </div>
//                           //       <span className={`pill ${geoOk ? "ok" : "warn"}`}>
//                           //         {geoOk ? "Near store" : "Not near"}
//                           //       </span>
//                           //     </div>

//                           //     <div className="row centerRow">
//                           //       <button className="btn" onClick={refreshLocation} disabled={geoBusy}>
//                           //         {geoBusy ? "Checking…" : "Refresh location"}
//                           //       </button>
//                           //     </div>
//                           //     {geoErr && <div className="small warn center">{geoErr}</div>}

//                           //     <div className="spacer" />

//                           //     <div className="row centerRow">
//                           //       <button
//                           //         className="btn"
//                           //         onClick={() => setScanOpen(true)}
//                           //         disabled={!geoOk || !qrExpectedObj}
//                           //       >
//                           //         Scan QR
//                           //       </button>
//                           //     </div>

//                           //     {!qrExpectedObj && (
//                           //       <div className="small warn center">
//                           //         QR not set for this store. Ask admin.
//                           //       </div>
//                           //     )}

//                           //     {/* Hidden input for testing / fallback */}
//                           //     <div className="tiny subtle center" style={{ marginTop: 10 }}>
//                           //       {qrOk ? "✅ QR matched" : " "}
//                           //     </div>
//                           //   </div>

//                           //   <QRScanner
//                           //     open={scanOpen}
//                           //     onClose={() => setScanOpen(false)}
//                           //     onResult={(code) => {
//                           //       setQrInput(code);
//                           //       // vibrate immediately when QR read (even before validation)
//                           //       if (navigator.vibrate) navigator.vibrate(80);
//                           //     }}
//                           //     title="Scan store QR"
//                           //   />
//                           // </div>

//                           <div className="clock-card">
//                             <h2 className="clock-header">Clock In/Out</h2>
//                             <p className="clock-description">
//                               Attendance is only available when near the store with a verified QR code.
//                             </p>

//                             <div className="status-container">
//                               <div className="status-row">
//                                 <div className="status-label">Location Status</div>
//                                 <div className="status-value mono">
//                                   {geo
//                                     ? `${distanceM ?? "-"}m away (±${Math.round(geo.accuracy ?? 0)}m)`
//                                     : geoErr
//                                     ? "Not available"
//                                     : "Not checked"}
//                                 </div>
//                                 <span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>
//                                   {geoOk ? "Near Store" : "Out of Range"}
//                                 </span>
//                               </div>

//                               <button 
//                                 className="action-button secondary" 
//                                 onClick={refreshLocation} 
//                                 disabled={geoBusy}
//                               >
//                                 {geoBusy ? "Verifying..." : "Update Location"}
//                               </button>
                              
//                               {geoErr && <div className="error-text">{geoErr}</div>}

//                               <div className="divider" />

//                               <button
//                                 className="action-button primary"
//                                 onClick={() => setScanOpen(true)}
//                                 disabled={!geoOk || !qrExpectedObj}
//                               >
//                                 Scan Store QR
//                               </button>

//                               {!qrExpectedObj && (
//                                 <div className="error-text">
//                                   QR not configured. Please contact admin.
//                                 </div>
//                               )}

//                               {qrOk && (
//                                 <div className="success-text">
//                                   ✅ QR Code Verified
//                                 </div>
//                               )}
//                             </div>

//                             <QRScanner
//                               open={scanOpen}
//                               onClose={() => setScanOpen(false)}
//                               onResult={(code) => {
//                                 setQrInput(code);
//                                 if (navigator.vibrate) navigator.vibrate(80);
//                               }}
//                               title="Scan store QR"
//                             />
//                           </div>

//                         )}
//               </div>
//             )}
            

//             {/* STEP 2: Clock On appears ONLY after verified */}
//             {showClockOnStep && (
//               // <div className="panel">
//               //   <div className="panelTitle">Clock On</div>
//               //   <div className="panelSub">
//               //     Enter your start time. (Actual timestamp is saved automatically)
//               //   </div>

//               //   <div className="row">
//               //     <input
//               //       className="input"
//               //       type="time"
//               //       value={startInput}
//               //       onChange={(e) => setStartInput(e.target.value)}
//               //     />
//               //     <button className="btn primary" onClick={doClockOn} disabled={!startInput}>
//               //       Clock On
//               //     </button>
//               //   </div>
//               // </div>

//               <div className="time-entry-card">
//                 <h2 className="time-header">Clock In</h2>
//                 <p className="time-description">
//                   Enter your scheduled start time.
//                 </p>

//                 <div className="input-group">
//                   <div className="input-wrapper">
//                     <label className="input-label">Start Time</label>
//                     <input
//                       className="time-picker"
//                       type="time"
//                       value={startInput}
//                       onChange={(e) => setStartInput(e.target.value)}
//                     />
//                   </div>
                  
//                   <button 
//                     className="action-button brand-filled" 
//                     onClick={doClockOn} 
//                     disabled={!startInput}
//                   >
//                     Confirm Clock In
//                   </button>
//                 </div>
//               </div>
//             )}

//             {/* STEP 3: After clock on (break + clock off) */}
//             {showAfterClockOn && (
//               <div className="flow">
//                 {!timesheet?.breakStartActual && (
//                   // <div className="panel">
//                   //   <div className="panelTitle">Break (optional)</div>
//                   //   <div className="row">
//                   //     <input
//                   //       className="input"
//                   //       type="time"
//                   //       value={breakStartInput}
//                   //       onChange={(e) => setBreakStartInput(e.target.value)}
//                   //     />
//                   //     <button className="btn" onClick={doStartBreak} disabled={!breakStartInput}>
//                   //       Start Break
//                   //     </button>
//                   //   </div>
//                   // </div>

//                   <div className="break-card">
//                   <div className="break-header-group">
//                     <h3 className="break-title">Break</h3>
//                     <span className="optional-badge">Optional</span>
//                   </div>
                  
//                   <p className="break-description">
//                     Record your break start time to maintain accurate shift logs.
//                   </p>

//                   <div className="input-stack">
//                     <div className="input-wrapper">
//                       <label className="input-label">Break Start</label>
//                       <input
//                         className="time-picker"
//                         type="time"
//                         value={breakStartInput}
//                         onChange={(e) => setBreakStartInput(e.target.value)}
//                       />
//                     </div>

//                     <button 
//                       className="action-button outline" 
//                       onClick={doStartBreak} 
//                       disabled={!breakStartInput}
//                     >
//                       Start Break
//                     </button>
//                   </div>
//                 </div>
//                 )}

//                 {!!timesheet?.breakStartActual && !timesheet?.breakEndActual && (
//                   // <div className="panel">
//                   //   <div className="panelTitle">Break</div>
//                   //   <div className="panelSub">End your break to continue.</div>

//                   //   <div className="row">
//                   //     <input
//                   //       className="input"
//                   //       type="time"
//                   //       value={breakEndInput}
//                   //       onChange={(e) => setBreakEndInput(e.target.value)}
//                   //     />
//                   //     <button className="btn" onClick={doEndBreak} disabled={!breakEndInput}>
//                   //       End Break
//                   //     </button>
//                   //   </div>

//                   //   <div className="small warn">Clock off is disabled while you’re on break.</div>
//                   // </div>
//                   <div className="break-active-card">
//                     <div className="break-header-group">
//                       <h3 className="break-title pulse-text">On Break</h3>
//                       <div className="active-indicator" />
//                     </div>
                    
//                     <p className="break-description">
//                       Ready to get back? Enter your end time to resume your shift.
//                     </p>

//                     <div className="input-stack">
//                       <div className="input-wrapper">
//                         <label className="input-label">Break End Time</label>
//                         <input
//                           className="time-picker highlight-border"
//                           type="time"
//                           value={breakEndInput}
//                           onChange={(e) => setBreakEndInput(e.target.value)}
//                         />
//                       </div>

//                       <button 
//                         className="action-button brand-filled" 
//                         onClick={doEndBreak} 
//                         disabled={!breakEndInput}
//                       >
//                         End Break & Resume
//                       </button>
//                     </div>

//                     <div className="status-notice">
//                       <span className="notice-icon">⚠️</span>
//                       <p>Clock off is disabled until your break ends.</p>
//                     </div>
//                   </div>
//                 )}

//                 {/* <div className="panel">
//                   <div className="panelTitle">Clock Off</div>
//                   <div className="row">
//                     <input
//                       className="input"
//                       type="time"
//                       value={endInput}
//                       onChange={(e) => setEndInput(e.target.value)}
//                       disabled={!!timesheet?.breakStartActual && !timesheet?.breakEndActual}
//                     />
//                     <button
//                       className="btn primary"
//                       onClick={doClockOff}
//                       disabled={!endInput || (!!timesheet?.breakStartActual && !timesheet?.breakEndActual)}
//                     >
//                       Clock Off
//                     </button>
//                   </div>

//                   {!!timesheet?.breakStartActual && !timesheet?.breakEndActual && (
//                     <div className="small warn">Finish your break before clocking off.</div>
//                   )}
//                 </div> */}
//                 <div className={`clock-off-card ${ (!!timesheet?.breakStartActual && !timesheet?.breakEndActual) ? 'is-locked' : ''}`}>
//                   <h2 className="clock-off-header">End Shift</h2>
//                   <p className="clock-off-description">
//                     Confirm your final departure time.
//                   </p>

//                   <div className="input-group">
//                     <div className="input-wrapper">
//                       <label className="input-label">Finish Time</label>
//                       <input
//                         className="time-picker"
//                         type="time"
//                         value={endInput}
//                         onChange={(e) => setEndInput(e.target.value)}
//                         disabled={!!timesheet?.breakStartActual && !timesheet?.breakEndActual}
//                       />
//                     </div>

//                     <button
//                       className="action-button brand-filled clock-off-btn"
//                       onClick={doClockOff}
//                       disabled={!endInput || (!!timesheet?.breakStartActual && !timesheet?.breakEndActual)}
//                     >
//                       Clock Off
//                     </button>
//                   </div>

//                   {!!timesheet?.breakStartActual && !timesheet?.breakEndActual && (
//                     <div className="lock-notice">
//                       <span className="lock-icon">🔒</span>
//                       <p>Break in progress. End your break to enable Clock Off.</p>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}

//             {/* DONE */}
//             {showDone && (
//               // <div className="panel done">
//               //   <div className="panelTitle">✅ Shift Completed</div>
//               //   <div className="panelSub">Your shift record has been saved.</div>

//               //   <div className="summary">
//               //     <div className="sumRow">
//               //       <div className="k">Start</div>
//               //       <div className="v">{timesheet.startInput || "-"}</div>
//               //     </div>
//               //     <div className="sumRow">
//               //       <div className="k">Break</div>
//               //       <div className="v">
//               //         {timesheet.breakStartInput
//               //           ? `${timesheet.breakStartInput} – ${timesheet.breakEndInput || "..."}`
//               //           : "No break"}
//               //       </div>
//               //     </div>
//               //     <div className="sumRow">
//               //       <div className="k">End</div>
//               //       <div className="v">{timesheet.endInput || "-"}</div>
//               //     </div>
//               //   </div>

//               //   <div className="row">
//               //     <button className="btn" onClick={loadToday}>
//               //       Refresh
//               //     </button>
//               //   </div>
//               // </div>

//               <div className="summary-card shift-done">
//                 <div className="summary-header">
//                   <div className="success-icon">✓</div>
//                   <h2 className="summary-title">Shift Completed</h2>
//                   <p className="summary-subtitle">Your record has been securely saved.</p>
//                 </div>

//                 <div className="receipt-container">
//                   <div className="receipt-row">
//                     <span className="receipt-label">Start Time</span>
//                     <span className="receipt-value">{timesheet.startInput || "-"}</span>
//                   </div>
                  
//                   <div className="receipt-row">
//                     <span className="receipt-label">Break Duration</span>
//                     <span className="receipt-value">
//                       {timesheet.breakStartInput
//                         ? `${timesheet.breakStartInput} – ${timesheet.breakEndInput || "..."}`
//                         : "No break"}
//                     </span>
//                   </div>
                  
//                   <div className="receipt-row">
//                     <span className="receipt-label">End Time</span>
//                     <span className="receipt-value">{timesheet.endInput || "-"}</span>
//                   </div>

//                   <div className="receipt-divider" />
                  
//                   {/* Optional: Add a calculated total if your logic supports it */}
//                   <div className="receipt-row total">
//                     <span className="receipt-label">Status</span>
//                     <span className="receipt-value status-text">Verified</span>
//                   </div>
//                 </div>

//                 <button className="action-button secondary" onClick={loadToday}>
//                   Refresh Dashboard
//                 </button>
//               </div>
//             )}
//           </>
//         )}
//       </div>
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
//   Timestamp,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { STORES } from "../../utils/constants";
// import { toYMD } from "../../utils/dates";
// import { useAuth } from "../../auth/AuthProvider";
// import { useToast } from "../../context/ToastContext"; // Import Toast Hook
// import "./StaffToday.css";
// import QRScanner from "../../components/QRScanner";

// // ... [Keep existing helper functions: storeLabel, getStoreMeta, haversineMeters, getCurrentPositionPromise, parseQrPayload] ...

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const { showToast } = useToast(); // Initialize Toast
//   const uid = fbUser?.uid;

//   const today = useMemo(() => toYMD(new Date()), []);
//   const [loading, setLoading] = useState(true);

//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   const [geo, setGeo] = useState(null);
//   const [geoErr, setGeoErr] = useState("");
//   const [geoBusy, setGeoBusy] = useState(false);
//   const [scanOpen, setScanOpen] = useState(false);
//   const [radiusM, setRadiusM] = useState(3000);
//   const [qrExpectedPayload, setQrExpectedPayload] = useState("");
//   const [qrExpectedObj, setQrExpectedObj] = useState(null);
//   const [qrInput, setQrInput] = useState("");
//   const [qrBusy, setQrBusy] = useState(false);
//   const [verifiedOnce, setVerifiedOnce] = useState(false);

//   // ... [Keep existing useMemos: storeMeta, distanceM, withinRadius, geoOk, qrOk] ...

//   const verifiedForActions = geoOk && qrOk;

//   useEffect(() => {
//     if (!uid) return;
//     loadToday();
//   }, [uid]);

//   useEffect(() => {
//     if (!todayShift?.storeId) return;
//     setVerifiedOnce(false);
//     setQrInput("");
//     setQrExpectedObj(null);
//     setQrExpectedPayload("");
//     refreshLocation();
//     loadStoreSettings(todayShift.storeId);
//     loadStoreQr(todayShift.storeId);
//   }, [todayShift?.storeId]);

//   useEffect(() => {
//     if (!verifiedForActions) return;
//     if (!verifiedOnce) {
//       setVerifiedOnce(true);
//       setScanOpen(false);
//       showToast("Verification successful", "success");
//       if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
//     }
//   }, [verifiedForActions, verifiedOnce, showToast]);

//   async function refreshLocation() {
//     setGeoErr("");
//     setGeoBusy(true);
//     try {
//       const res = await getCurrentPositionPromise({
//         enableHighAccuracy: true,
//         timeout: 8000,
//         maximumAge: 10000,
//       });
//       setGeo({
//         lat: res.coords.latitude,
//         lng: res.coords.longitude,
//         accuracy: res.coords.accuracy,
//         checkedAt: new Date(),
//       });
//       // Silent success for background refresh
//     } catch (e) {
//       const msg = e?.message || "Location permission denied";
//       setGeoErr(msg);
//       setGeo(null);
//       showToast(msg, "error");
//     } finally {
//       setGeoBusy(false);
//     }
//   }

//   // ... [Keep loadStoreQr and loadStoreSettings] ...

//   async function loadToday(isManual = false) {
//     if(!isManual) setLoading(true);
//     try {
//         const rosterQ = query(collectionGroup(db, "shifts"), where("uid", "==", uid), where("date", "==", today));
//         const rosterSnap = await getDocs(rosterQ);
//         const shift = rosterSnap.docs.length ? { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() } : null;
//         setTodayShift(shift);

//         const timesheetId = `${uid}_${today}`;
//         const tsRef = doc(db, "timesheets", timesheetId);
//         const tsSnap = await getDoc(tsRef);

//         if (tsSnap.exists()) {
//             const ts = tsSnap.data();
//             setTimesheet({ id: timesheetId, ...ts });
//             setStartInput(ts.startInput || "");
//             setBreakStartInput(ts.breakStartInput || "");
//             setBreakEndInput(ts.breakEndInput || "");
//             setEndInput(ts.endInput || "");
//         } else {
//             setTimesheet(null);
//         }
//         if(isManual) showToast("Shift data updated", "success");
//     } catch (e) {
//         showToast("Error syncing today's shift", "error");
//     } finally {
//         setLoading(false);
//     }
//   }

//   function mustHaveShift() {
//     if (!todayShift) {
//       showToast("No rostered shift today", "error");
//       return false;
//     }
//     return true;
//   }

//   function mustBeVerified(actionLabel) {
//     if (!geoOk) {
//       showToast(`Must be within ${radiusM}m of store to ${actionLabel}`, "error");
//       return false;
//     }
//     if (!qrOk) {
//       showToast("Please scan the correct store QR", "error");
//       return false;
//     }
//     return true;
//   }

//   async function doClockOn() {
//     if (!mustHaveShift()) return;
//     if (!startInput) return showToast("Enter start time", "error");
//     if (!mustBeVerified("Clock On")) return;

//     try {
//         const timesheetId = `${uid}_${today}`;
//         const tsRef = doc(db, "timesheets", timesheetId);

//         await setDoc(tsRef, {
//             uid,
//             staffName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || profile?.email || "",
//             storeId: todayShift.storeId,
//             date: today,
//             startInput,
//             startActual: serverTimestamp(),
//             verification: {
//                 clockOn: {
//                     geo: {
//                         lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy ?? null, distanceM: distanceM ?? null,
//                         checkedAt: Timestamp.fromDate(geo.checkedAt || new Date()), radiusMUsed: radiusM,
//                     },
//                     qrMatched: true, qrValue: String(qrInput || "").trim(), verifiedAt: serverTimestamp(),
//                 },
//             },
//             status: "working", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
//         }, { merge: true });

//         showToast("Clocked on successfully!", "success");
//         await loadToday();
//     } catch (e) {
//         showToast("Failed to clock on", "error");
//     }
//   }

//   async function doStartBreak() {
//     if (!mustHaveShift()) return;
//     if (!breakStartInput) return showToast("Enter break start time", "error");

//     try {
//         const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//         await updateDoc(tsRef, {
//             breakStartInput,
//             breakStartActual: serverTimestamp(),
//             status: "on_break",
//             updatedAt: serverTimestamp(),
//         });
//         showToast("Break started", "success");
//         await loadToday();
//     } catch (e) {
//         showToast("Error recording break", "error");
//     }
//   }

//   async function doEndBreak() {
//     if (!mustHaveShift()) return;
//     if (!breakEndInput) return showToast("Enter break end time", "error");

//     try {
//         const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//         await updateDoc(tsRef, {
//             breakEndInput,
//             breakEndActual: serverTimestamp(),
//             status: "working",
//             updatedAt: serverTimestamp(),
//         });
//         showToast("Break ended", "success");
//         await loadToday();
//     } catch (e) {
//         showToast("Error ending break", "error");
//     }
//   }

//   async function doClockOff() {
//     if (!mustHaveShift()) return;
//     if (!endInput) return showToast("Enter end time", "error");

//     try {
//         const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//         await updateDoc(tsRef, {
//             endInput,
//             endActual: serverTimestamp(),
//             status: "clocked_out",
//             updatedAt: serverTimestamp(),
//             "verification.clockOff": {
//                 geo: {
//                     lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy ?? null, distanceM: distanceM ?? null,
//                     checkedAt: Timestamp.fromDate(geo.checkedAt || new Date()), radiusMUsed: radiusM,
//                 },
//                 qrMatched: true, qrValue: String(qrInput || "").trim(), verifiedAt: serverTimestamp(),
//             },
//         });
//         showToast("Shift completed! Great job.", "success");
//         await loadToday();
//     } catch (e) {
//         showToast("Error clocking off", "error");
//     }
//   }

//   // ... [Keep existing UI logic and JSX return] ...

//   return (
//         <div className="container">
//           <div className="card">
//             {/* <div className="top">
//               <div>
//                 <h1 className="h1">Today</h1>
//                 <p className="p">
//                   Date: <b>{today}</b>
//                 </p>
//               </div>
//               <button className="btn" onClick={loadToday}>
//                 Refresh
//               </button>
//             </div> */}
    
//             <div className="dashboard-header">
//               <div className="header-content">
//                 <h1 className="dashboard-title">Today</h1>
//                 <p className="dashboard-date">
//                   Current Date: <span className="date-highlight">{today}</span>
//                 </p>
//               </div>
//               <button className="icon-button-refresh" onClick={loadToday} aria-label="Refresh data">
//                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
//               </button>
//             </div>
    
//             {/* <div className="spacer" /> */}
    
//             {!todayShift ? (
//               <div className="notice">
//                 <div className="noticeTitle">No shift today</div>
//                 <div className="noticeSub">If you believe this is wrong, contact your admin.</div>
//               </div>
//             ) : (
//               <>
//                 {/* <div className="shiftInfo">
//                   <div className="infoRow">
//                     <div className="k">Store</div>
//                     <div className="v">{storeLabel(todayShift.storeId)}</div>
//                   </div>
//                   <div className="infoRow">
//                     <div className="k">Planned</div>
//                     <div className="v">
//                       {todayShift.startPlanned} – {todayShift.endPlanned}
//                     </div>
//                   </div>
//                 </div> */}
    
//                 <div className="shift-info-card">
//                   <div className="info-segment">
//                     <span className="info-label">Store Location</span>
//                     <span className="info-value primary-link">{storeLabel(todayShift.storeId)}</span>
//                   </div>
                  
//                   <div className="info-divider-vertical" />
    
//                   <div className="info-segment">
//                     <span className="info-label">Planned Shift</span>
//                     <span className="info-value">
//                       {todayShift.startPlanned} <span className="arrow">→</span> {todayShift.endPlanned}
//                     </span>
//                   </div>
//                 </div>
    
//                 {/* <div className="spacer" /> */}
    
//                 {/* STEP 1: Verify (location + QR) */}
//                 {todayShift && !timesheet?.startActual && (
//                   <div className="stVerifyWrap">
//                     {showVerifyStep && (
//                               // <div className="panel">
//                               //   <div className="panelTitle center">Clock</div>
//                               //   <div className="panelSub center">
//                               //     Clock on/off is only available near the store and with correct QR.
//                               //   </div>
    
//                               //   <div className="verifyMini">
//                               //     <div className="verifyLine">
//                               //       <div className="small subtle">Location</div>
//                               //       <div className="mono">
//                               //         {geo
//                               //           ? `${distanceM ?? "-"}m away (±${Math.round(geo.accuracy ?? 0)}m)`
//                               //           : geoErr
//                               //           ? "Not available"
//                               //           : "Not checked"}
//                               //       </div>
//                               //       <span className={`pill ${geoOk ? "ok" : "warn"}`}>
//                               //         {geoOk ? "Near store" : "Not near"}
//                               //       </span>
//                               //     </div>
    
//                               //     <div className="row centerRow">
//                               //       <button className="btn" onClick={refreshLocation} disabled={geoBusy}>
//                               //         {geoBusy ? "Checking…" : "Refresh location"}
//                               //       </button>
//                               //     </div>
//                               //     {geoErr && <div className="small warn center">{geoErr}</div>}
    
//                               //     <div className="spacer" />
    
//                               //     <div className="row centerRow">
//                               //       <button
//                               //         className="btn"
//                               //         onClick={() => setScanOpen(true)}
//                               //         disabled={!geoOk || !qrExpectedObj}
//                               //       >
//                               //         Scan QR
//                               //       </button>
//                               //     </div>
    
//                               //     {!qrExpectedObj && (
//                               //       <div className="small warn center">
//                               //         QR not set for this store. Ask admin.
//                               //       </div>
//                               //     )}
    
//                               //     {/* Hidden input for testing / fallback */}
//                               //     <div className="tiny subtle center" style={{ marginTop: 10 }}>
//                               //       {qrOk ? "✅ QR matched" : " "}
//                               //     </div>
//                               //   </div>
    
//                               //   <QRScanner
//                               //     open={scanOpen}
//                               //     onClose={() => setScanOpen(false)}
//                               //     onResult={(code) => {
//                               //       setQrInput(code);
//                               //       // vibrate immediately when QR read (even before validation)
//                               //       if (navigator.vibrate) navigator.vibrate(80);
//                               //     }}
//                               //     title="Scan store QR"
//                               //   />
//                               // </div>
    
//                               <div className="clock-card">
//                                 <h2 className="clock-header">Clock In/Out</h2>
//                                 <p className="clock-description">
//                                   Attendance is only available when near the store with a verified QR code.
//                                 </p>
    
//                                 <div className="status-container">
//                                   <div className="status-row">
//                                     <div className="status-label">Location Status</div>
//                                     <div className="status-value mono">
//                                       {geo
//                                         ? `${distanceM ?? "-"}m away (±${Math.round(geo.accuracy ?? 0)}m)`
//                                         : geoErr
//                                         ? "Not available"
//                                         : "Not checked"}
//                                     </div>
//                                     <span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>
//                                       {geoOk ? "Near Store" : "Out of Range"}
//                                     </span>
//                                   </div>
    
//                                   <button 
//                                     className="action-button secondary" 
//                                     onClick={refreshLocation} 
//                                     disabled={geoBusy}
//                                   >
//                                     {geoBusy ? "Verifying..." : "Update Location"}
//                                   </button>
                                  
//                                   {geoErr && <div className="error-text">{geoErr}</div>}
    
//                                   <div className="divider" />
    
//                                   <button
//                                     className="action-button primary"
//                                     onClick={() => setScanOpen(true)}
//                                     disabled={!geoOk || !qrExpectedObj}
//                                   >
//                                     Scan Store QR
//                                   </button>
    
//                                   {!qrExpectedObj && (
//                                     <div className="error-text">
//                                       QR not configured. Please contact admin.
//                                     </div>
//                                   )}
    
//                                   {qrOk && (
//                                     <div className="success-text">
//                                       ✅ QR Code Verified
//                                     </div>
//                                   )}
//                                 </div>
    
//                                 <QRScanner
//                                   open={scanOpen}
//                                   onClose={() => setScanOpen(false)}
//                                   onResult={(code) => {
//                                     setQrInput(code);
//                                     if (navigator.vibrate) navigator.vibrate(80);
//                                   }}
//                                   title="Scan store QR"
//                                 />
//                               </div>
    
//                             )}
//                   </div>
//                 )}
                
    
//                 {/* STEP 2: Clock On appears ONLY after verified */}
//                 {showClockOnStep && (
//                   // <div className="panel">
//                   //   <div className="panelTitle">Clock On</div>
//                   //   <div className="panelSub">
//                   //     Enter your start time. (Actual timestamp is saved automatically)
//                   //   </div>
    
//                   //   <div className="row">
//                   //     <input
//                   //       className="input"
//                   //       type="time"
//                   //       value={startInput}
//                   //       onChange={(e) => setStartInput(e.target.value)}
//                   //     />
//                   //     <button className="btn primary" onClick={doClockOn} disabled={!startInput}>
//                   //       Clock On
//                   //     </button>
//                   //   </div>
//                   // </div>
    
//                   <div className="time-entry-card">
//                     <h2 className="time-header">Clock In</h2>
//                     <p className="time-description">
//                       Enter your scheduled start time.
//                     </p>
    
//                     <div className="input-group">
//                       <div className="input-wrapper">
//                         <label className="input-label">Start Time</label>
//                         <input
//                           className="time-picker"
//                           type="time"
//                           value={startInput}
//                           onChange={(e) => setStartInput(e.target.value)}
//                         />
//                       </div>
                      
//                       <button 
//                         className="action-button brand-filled" 
//                         onClick={doClockOn} 
//                         disabled={!startInput}
//                       >
//                         Confirm Clock In
//                       </button>
//                     </div>
//                   </div>
//                 )}
    
//                 {/* STEP 3: After clock on (break + clock off) */}
//                 {showAfterClockOn && (
//                   <div className="flow">
//                     {!timesheet?.breakStartActual && (
//                       // <div className="panel">
//                       //   <div className="panelTitle">Break (optional)</div>
//                       //   <div className="row">
//                       //     <input
//                       //       className="input"
//                       //       type="time"
//                       //       value={breakStartInput}
//                       //       onChange={(e) => setBreakStartInput(e.target.value)}
//                       //     />
//                       //     <button className="btn" onClick={doStartBreak} disabled={!breakStartInput}>
//                       //       Start Break
//                       //     </button>
//                       //   </div>
//                       // </div>
    
//                       <div className="break-card">
//                       <div className="break-header-group">
//                         <h3 className="break-title">Break</h3>
//                         <span className="optional-badge">Optional</span>
//                       </div>
                      
//                       <p className="break-description">
//                         Record your break start time to maintain accurate shift logs.
//                       </p>
    
//                       <div className="input-stack">
//                         <div className="input-wrapper">
//                           <label className="input-label">Break Start</label>
//                           <input
//                             className="time-picker"
//                             type="time"
//                             value={breakStartInput}
//                             onChange={(e) => setBreakStartInput(e.target.value)}
//                           />
//                         </div>
    
//                         <button 
//                           className="action-button outline" 
//                           onClick={doStartBreak} 
//                           disabled={!breakStartInput}
//                         >
//                           Start Break
//                         </button>
//                       </div>
//                     </div>
//                     )}
    
//                     {!!timesheet?.breakStartActual && !timesheet?.breakEndActual && (
//                       // <div className="panel">
//                       //   <div className="panelTitle">Break</div>
//                       //   <div className="panelSub">End your break to continue.</div>
    
//                       //   <div className="row">
//                       //     <input
//                       //       className="input"
//                       //       type="time"
//                       //       value={breakEndInput}
//                       //       onChange={(e) => setBreakEndInput(e.target.value)}
//                       //     />
//                       //     <button className="btn" onClick={doEndBreak} disabled={!breakEndInput}>
//                       //       End Break
//                       //     </button>
//                       //   </div>
    
//                       //   <div className="small warn">Clock off is disabled while you’re on break.</div>
//                       // </div>
//                       <div className="break-active-card">
//                         <div className="break-header-group">
//                           <h3 className="break-title pulse-text">On Break</h3>
//                           <div className="active-indicator" />
//                         </div>
                        
//                         <p className="break-description">
//                           Ready to get back? Enter your end time to resume your shift.
//                         </p>
    
//                         <div className="input-stack">
//                           <div className="input-wrapper">
//                             <label className="input-label">Break End Time</label>
//                             <input
//                               className="time-picker highlight-border"
//                               type="time"
//                               value={breakEndInput}
//                               onChange={(e) => setBreakEndInput(e.target.value)}
//                             />
//                           </div>
    
//                           <button 
//                             className="action-button brand-filled" 
//                             onClick={doEndBreak} 
//                             disabled={!breakEndInput}
//                           >
//                             End Break & Resume
//                           </button>
//                         </div>
    
//                         <div className="status-notice">
//                           <span className="notice-icon">⚠️</span>
//                           <p>Clock off is disabled until your break ends.</p>
//                         </div>
//                       </div>
//                     )}
    
//                     {/* <div className="panel">
//                       <div className="panelTitle">Clock Off</div>
//                       <div className="row">
//                         <input
//                           className="input"
//                           type="time"
//                           value={endInput}
//                           onChange={(e) => setEndInput(e.target.value)}
//                           disabled={!!timesheet?.breakStartActual && !timesheet?.breakEndActual}
//                         />
//                         <button
//                           className="btn primary"
//                           onClick={doClockOff}
//                           disabled={!endInput || (!!timesheet?.breakStartActual && !timesheet?.breakEndActual)}
//                         >
//                           Clock Off
//                         </button>
//                       </div>
    
//                       {!!timesheet?.breakStartActual && !timesheet?.breakEndActual && (
//                         <div className="small warn">Finish your break before clocking off.</div>
//                       )}
//                     </div> */}
//                     <div className={`clock-off-card ${ (!!timesheet?.breakStartActual && !timesheet?.breakEndActual) ? 'is-locked' : ''}`}>
//                       <h2 className="clock-off-header">End Shift</h2>
//                       <p className="clock-off-description">
//                         Confirm your final departure time.
//                       </p>
    
//                       <div className="input-group">
//                         <div className="input-wrapper">
//                           <label className="input-label">Finish Time</label>
//                           <input
//                             className="time-picker"
//                             type="time"
//                             value={endInput}
//                             onChange={(e) => setEndInput(e.target.value)}
//                             disabled={!!timesheet?.breakStartActual && !timesheet?.breakEndActual}
//                           />
//                         </div>
    
//                         <button
//                           className="action-button brand-filled clock-off-btn"
//                           onClick={doClockOff}
//                           disabled={!endInput || (!!timesheet?.breakStartActual && !timesheet?.breakEndActual)}
//                         >
//                           Clock Off
//                         </button>
//                       </div>
    
//                       {!!timesheet?.breakStartActual && !timesheet?.breakEndActual && (
//                         <div className="lock-notice">
//                           <span className="lock-icon">🔒</span>
//                           <p>Break in progress. End your break to enable Clock Off.</p>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 )}
    
//                 {/* DONE */}
//                 {showDone && (
//                   // <div className="panel done">
//                   //   <div className="panelTitle">✅ Shift Completed</div>
//                   //   <div className="panelSub">Your shift record has been saved.</div>
    
//                   //   <div className="summary">
//                   //     <div className="sumRow">
//                   //       <div className="k">Start</div>
//                   //       <div className="v">{timesheet.startInput || "-"}</div>
//                   //     </div>
//                   //     <div className="sumRow">
//                   //       <div className="k">Break</div>
//                   //       <div className="v">
//                   //         {timesheet.breakStartInput
//                   //           ? `${timesheet.breakStartInput} – ${timesheet.breakEndInput || "..."}`
//                   //           : "No break"}
//                   //       </div>
//                   //     </div>
//                   //     <div className="sumRow">
//                   //       <div className="k">End</div>
//                   //       <div className="v">{timesheet.endInput || "-"}</div>
//                   //     </div>
//                   //   </div>
    
//                   //   <div className="row">
//                   //     <button className="btn" onClick={loadToday}>
//                   //       Refresh
//                   //     </button>
//                   //   </div>
//                   // </div>
    
//                   <div className="summary-card shift-done">
//                     <div className="summary-header">
//                       <div className="success-icon">✓</div>
//                       <h2 className="summary-title">Shift Completed</h2>
//                       <p className="summary-subtitle">Your record has been securely saved.</p>
//                     </div>
    
//                     <div className="receipt-container">
//                       <div className="receipt-row">
//                         <span className="receipt-label">Start Time</span>
//                         <span className="receipt-value">{timesheet.startInput || "-"}</span>
//                       </div>
                      
//                       <div className="receipt-row">
//                         <span className="receipt-label">Break Duration</span>
//                         <span className="receipt-value">
//                           {timesheet.breakStartInput
//                             ? `${timesheet.breakStartInput} – ${timesheet.breakEndInput || "..."}`
//                             : "No break"}
//                         </span>
//                       </div>
                      
//                       <div className="receipt-row">
//                         <span className="receipt-label">End Time</span>
//                         <span className="receipt-value">{timesheet.endInput || "-"}</span>
//                       </div>
    
//                       <div className="receipt-divider" />
                      
//                       {/* Optional: Add a calculated total if your logic supports it */}
//                       <div className="receipt-row total">
//                         <span className="receipt-label">Status</span>
//                         <span className="receipt-value status-text">Verified</span>
//                       </div>
//                     </div>
    
//                     <button className="action-button secondary" onClick={loadToday}>
//                       Refresh Dashboard
//                     </button>
//                   </div>
//                 )}
//               </>
//             )}
//           </div>
//         </div>
//       );
//     }


















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
// import "./StaffToday.css";
// import QRScanner from "../../components/QRScanner";

// // Helpers
// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function getStoreMeta(storeId) {
//   return STORES.find((s) => s.id === storeId) || null;
// }

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
//   } catch {
//     return null;
//   }
// }

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const uid = fbUser?.uid;
//   const today = useMemo(() => toYMD(new Date()), []);

//   const [loading, setLoading] = useState(true);
//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   // Form Inputs
//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   // Verification States
//   const [geo, setGeo] = useState(null);
//   const [geoErr, setGeoErr] = useState("");
//   const [geoBusy, setGeoBusy] = useState(false);
//   const [scanOpen, setScanOpen] = useState(false);
//   const [radiusM, setRadiusM] = useState(3000);
//   const [qrExpectedObj, setQrExpectedObj] = useState(null);
//   const [qrInput, setQrInput] = useState("");
//   const [verifiedOnce, setVerifiedOnce] = useState(false);

//   const storeMeta = useMemo(() => getStoreMeta(todayShift?.storeId), [todayShift?.storeId]);

//   const distanceM = useMemo(() => {
//     if (!geo || !storeMeta?.lat || !storeMeta?.lng) return null;
//     return Math.round(haversineMeters(geo.lat, geo.lng, storeMeta.lat, storeMeta.lng));
//   }, [geo, storeMeta]);

//   const geoOk = useMemo(() => {
//     if (!geo) return false;
//     // Increased accuracy threshold to 100m for better reliability indoors
//     return (distanceM <= radiusM) && (geo.accuracy ?? 999) <= 100;
//   }, [geo, distanceM, radiusM]);

//   const qrOk = useMemo(() => {
//     if (!qrExpectedObj) return false;
//     const raw = String(qrInput || "").trim();
//     if (!raw) return false;
//     const scannedObj = parseQrPayload(raw);

//     if (scannedObj) {
//       return (
//         String(scannedObj.storeId) === String(todayShift?.storeId) &&
//         String(scannedObj.code) === String(qrExpectedObj.code)
//       );
//     }
//     return String(raw) === String(qrExpectedObj.code);
//   }, [qrInput, qrExpectedObj, todayShift?.storeId]);

//   // Logic: User is verified if they pass geo+qr OR if they already have an active session
//   const canPerformActions = useMemo(() => {
//     if (timesheet?.startActual) return true; // Already clocked in
//     return geoOk && qrOk;
//   }, [timesheet?.startActual, geoOk, qrOk]);

//   useEffect(() => {
//     if (uid) loadToday();
//   }, [uid, today]);

//   useEffect(() => {
//     if (!todayShift?.storeId) return;
//     refreshLocation();
//     loadStoreSettings(todayShift.storeId);
//     loadStoreQr(todayShift.storeId);
//   }, [todayShift?.storeId]);

//   useEffect(() => {
//     // Auto-close scanner and vibrate on successful verification
//     if (geoOk && qrOk && !verifiedOnce) {
//       setVerifiedOnce(true);
//       setScanOpen(false);
//       if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
//     }
//   }, [geoOk, qrOk, verifiedOnce]);

//   async function refreshLocation() {
//     setGeoErr("");
//     setGeoBusy(true);
//     try {
//       const res = await getCurrentPositionPromise({
//         enableHighAccuracy: true,
//         timeout: 10000,
//         maximumAge: 0,
//       });
//       setGeo({
//         lat: res.coords.latitude,
//         lng: res.coords.longitude,
//         accuracy: res.coords.accuracy,
//         checkedAt: new Date(),
//       });
//     } catch (e) {
//       setGeoErr(e?.message || "Location access denied");
//       setGeo(null);
//     } finally {
//       setGeoBusy(false);
//     }
//   }

//   async function loadStoreQr(storeId) {
//     try {
//       const snap = await getDoc(doc(db, "storeQr", storeId));
//       if (snap.exists()) {
//         const data = snap.data();
//         const payload = data?.currentPayload;
//         let obj = payload ? parseQrPayload(payload) : null;
//         if (!obj && data?.currentCode) {
//           obj = { v: 1, storeId, code: data.currentCode };
//         }
//         setQrExpectedObj(obj);
//       }
//     } catch (e) { console.error("QR Load Err:", e); }
//   }

//   async function loadStoreSettings(storeId) {
//     try {
//       const snap = await getDoc(doc(db, "storeSettings", storeId));
//       if (snap.exists() && snap.data()?.radiusM) {
//         setRadiusM(snap.data().radiusM);
//       }
//     } catch (e) { console.error("Settings Load Err:", e); }
//   }

//   async function loadToday() {
//     if (!uid) return;
//     setLoading(true);
//     try {
//       const rosterQ = query(collectionGroup(db, "shifts"), where("uid", "==", uid), where("date", "==", today));
//       const rosterSnap = await getDocs(rosterQ);
//       const shift = rosterSnap.docs.length ? { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() } : null;
//       setTodayShift(shift);

//       const timesheetId = `${uid}_${today}`;
//       const tsSnap = await getDoc(doc(db, "timesheets", timesheetId));
//       if (tsSnap.exists()) {
//         const ts = tsSnap.data();
//         setTimesheet({ id: timesheetId, ...ts });
//         setStartInput(ts.startInput || "");
//         setBreakStartInput(ts.breakStartInput || "");
//         setBreakEndInput(ts.breakEndInput || "");
//         setEndInput(ts.endInput || "");
//       } else {
//         setTimesheet(null);
//       }
//     } catch (err) {
//       console.error("Load Today Err:", err);
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function doClockOn() {
//     if (!startInput) return alert("Please select a start time.");
//     if (!geoOk || !qrOk) return alert("Verification (Location + QR) required to clock in.");

//     try {
//       const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//       await setDoc(tsRef, {
//         uid,
//         staffName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || profile?.email,
//         storeId: todayShift.storeId,
//         date: today,
//         startInput,
//         startActual: serverTimestamp(),
//         verification: {
//           clockOn: {
//             geo: { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy, distanceM, radiusMUsed: radiusM },
//             qrMatched: true,
//             verifiedAt: serverTimestamp(),
//           }
//         },
//         status: "working",
//         updatedAt: serverTimestamp(),
//       }, { merge: true });
//       await loadToday();
//     } catch (e) { alert("Clock on failed: " + e.message); }
//   }

//   async function doStartBreak() {
//     if (!breakStartInput) return alert("Enter break start time.");
//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         breakStartInput,
//         breakStartActual: serverTimestamp(),
//         status: "on_break",
//         updatedAt: serverTimestamp(),
//       });
//       await loadToday();
//     } catch (e) { alert(e.message); }
//   }

//   async function doEndBreak() {
//     if (!breakEndInput) return alert("Enter break end time.");
//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         breakEndInput,
//         breakEndActual: serverTimestamp(),
//         status: "working",
//         updatedAt: serverTimestamp(),
//       });
//       await loadToday();
//     } catch (e) { alert(e.message); }
//   }

//   async function doClockOff() {
//     if (!endInput) return alert("Enter finish time.");
//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         endInput,
//         endActual: serverTimestamp(),
//         status: "clocked_out",
//         "verification.clockOff": {
//           geo: geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy, distanceM, radiusMUsed: radiusM } : "no_geo_at_off",
//           verifiedAt: serverTimestamp(),
//         },
//         updatedAt: serverTimestamp(),
//       });
//       await loadToday();
//     } catch (e) { alert(e.message); }
//   }

//   if (loading) return <div className="container"><div className="card"><p>Loading dashboard...</p></div></div>;

//   const isOnBreak = timesheet?.status === "on_break" || (!!timesheet?.breakStartActual && !timesheet?.breakEndActual);

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="dashboard-header">
//           <div className="header-content">
//             <h1 className="dashboard-title">Shift Dashboard</h1>
//             <p className="dashboard-date">Today: <span className="date-highlight">{today}</span></p>
//           </div>
//           <button className="icon-button-refresh" onClick={loadToday}><RefreshIcon /></button>
//         </div>

//         {!todayShift ? (
//           <div className="notice">
//             <div className="noticeTitle">No scheduled shift</div>
//             <div className="noticeSub">You aren't rostered for today.</div>
//           </div>
//         ) : (
//           <>
//             <div className="shift-info-card">
//               <div className="info-segment">
//                 <span className="info-label">Store</span>
//                 <span className="info-value primary-link">{storeLabel(todayShift.storeId)}</span>
//               </div>
//               <div className="info-divider-vertical" />
//               <div className="info-segment">
//                 <span className="info-label">Roster</span>
//                 <span className="info-value">{todayShift.startPlanned} - {todayShift.endPlanned}</span>
//               </div>
//             </div>

//             {/* STEP 1: Verification (Only show if not clocked in) */}
//             {!timesheet?.startActual && !canPerformActions && (
//               <div className="clock-card">
//                 <h2 className="clock-header">Verification</h2>
//                 <div className="status-container">
//                   <div className="status-row">
//                     <div className="status-label">1. Location</div>
//                     <span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>
//                       {geoOk ? "In Range" : geoBusy ? "Checking..." : "Out of Range"}
//                     </span>
//                   </div>
//                   <button className="action-button secondary" onClick={refreshLocation} disabled={geoBusy}>
//                     {geoBusy ? "Locating..." : "Refresh GPS"}
//                   </button>
                  
//                   <div className="divider" />
                  
//                   <div className="status-row">
//                     <div className="status-label">2. QR Code</div>
//                     <span className={`status-badge ${qrOk ? "is-ok" : "is-warn"}`}>
//                       {qrOk ? "Verified" : "Pending"}
//                     </span>
//                   </div>
//                   <button className="action-button primary" onClick={() => setScanOpen(true)} disabled={!geoOk}>
//                     Scan QR Code
//                   </button>
//                 </div>
//               </div>
//             )}

//             {/* STEP 2: Clock In (Only show if verified but not started) */}
//             {/* STEP 2: Clock In (Show once verified) */}
//             {!timesheet?.startActual && canPerformActions && (
//               <div className="time-entry-card animation-fade-in">
//                 <h2 className="time-header">Ready to Start</h2>
//                 <div className="input-group">
//                   <input
//                     className="time-picker"
//                     type="time"
//                     value={startInput}
//                     onChange={(e) => setStartInput(e.target.value)}
//                   />
//                   <button
//                     className="action-button brand-filled"
//                     onClick={doClockOn}
//                     disabled={!startInput}
//                   >
//                     Clock On Now
//                   </button>
//                 </div>
//               </div>
//             )}

//             {/* STEP 3: Active Shift Controls */}
//             {timesheet?.startActual && !timesheet?.endActual && (
//               <div className="flow">
//                 {!timesheet.breakStartActual && (
//                   <div className="break-card">
//                     <h3 className="break-title">Break Management</h3>
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
//                       <input className="time-picker highlight-border" type="time" value={breakEndInput} onChange={e => setBreakEndInput(e.target.value)} />
//                       <button className="action-button brand-filled" onClick={doEndBreak} disabled={!breakEndInput}>End Break</button>
//                     </div>
//                   </div>
//                 )}

//                 <div className={`clock-off-card ${isOnBreak ? 'is-locked' : ''}`}>
//                   <h2 className="clock-off-header">Finish Shift</h2>
//                   {isOnBreak && <p className="small-note">End your break before clocking off.</p>}
//                   <div className="input-group">
//                     <input className="time-picker" type="time" value={endInput} onChange={e => setEndInput(e.target.value)} disabled={isOnBreak} />
//                     <button className="action-button brand-filled clock-off-btn" onClick={doClockOff} disabled={isOnBreak || !endInput}>
//                       Clock Off
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             )}
            
//             {/* STEP 4: Summary */}
//             {timesheet?.endActual && 
//               <div className="summary-card shift-done">
//                 <div className="summary-header">
//                   <div className="success-icon">✓</div>
//                   <h2 className="summary-title">Shift Completed</h2>
//                 </div>
//                 <div className="receipt-container">
//                   <div className="receipt-row">
//                     <span className="receipt-label">Started</span>
//                     <span className="receipt-value">{timesheet.startInput}</span>
//                   </div>
//                   {timesheet.breakStartInput && (
//                     <div className="receipt-row">
//                       <span className="receipt-label">Break</span>
//                       <span className="receipt-value">{timesheet.breakStartInput} - {timesheet.breakEndInput}</span>
//                     </div>
//                   )}
//                   <div className="receipt-row">
//                     <span className="receipt-label">Finished</span>
//                     <span className="receipt-value">{timesheet.endInput}</span>
//                   </div>
//                 </div>
//               </div>
//             }
//           </>
//         )}
//       </div>
//       <QRScanner 
//         open={scanOpen} 
//         onClose={() => setScanOpen(false)} 
//         onResult={(res) => setQrInput(res)} 
//         title="Scan store QR" 
//       />
//     </div>
//   );
// }

// const RefreshIcon = () => (
//   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
// );













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

// // Helpers
// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function getStoreMeta(storeId) {
//   return STORES.find((s) => s.id === storeId) || null;
// }

// function haversineMeters(aLat, aLng, bLat, bLng) {
//   const R = 6371000;
//   const toRad = (d) => (d * Math.PI) / 180;
//   const dLat = toRad(bLat - aLat);
//   const dLng = toRad(bLng - aLng);
//   const lat1 = toRad(aLat);
//   const lat2 = toRad(bLat);
//   const x =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
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
//   } catch {
//     return null;
//   }
//   return null;
// }

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const { showToast } = useToast();

//   const uid = fbUser?.uid;
//   const today = useMemo(() => toYMD(new Date()), []);

//   const [loading, setLoading] = useState(true);
//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   // Form Inputs
//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   // Verification States
//   const [geo, setGeo] = useState(null);
//   const [geoErr, setGeoErr] = useState("");
//   const [geoBusy, setGeoBusy] = useState(false);
//   const [scanOpen, setScanOpen] = useState(false);
//   const [radiusM, setRadiusM] = useState(3000);
//   const [qrExpectedObj, setQrExpectedObj] = useState(null);
//   const [qrInput, setQrInput] = useState("");
//   const [verifiedOnce, setVerifiedOnce] = useState(false);

//   const storeMeta = useMemo(() => getStoreMeta(todayShift?.storeId), [todayShift?.storeId]);

//   const distanceM = useMemo(() => {
//     if (!geo || !storeMeta?.lat || !storeMeta?.lng) return null;
//     return Math.round(haversineMeters(geo.lat, geo.lng, storeMeta.lat, storeMeta.lng));
//   }, [geo, storeMeta]);

//   const geoOk = useMemo(() => {
//     if (!geo) return false;
//     return distanceM <= radiusM && (geo.accuracy ?? 999) <= 100;
//   }, [geo, distanceM, radiusM]);

//   const qrOk = useMemo(() => {
//     if (!qrExpectedObj) return false;
//     const raw = String(qrInput || "").trim();
//     if (!raw) return false;

//     const scannedObj = parseQrPayload(raw);

//     if (scannedObj) {
//       return (
//         String(scannedObj.storeId) === String(todayShift?.storeId) &&
//         String(scannedObj.code) === String(qrExpectedObj.code)
//       );
//     }

//     return String(raw) === String(qrExpectedObj.code);
//   }, [qrInput, qrExpectedObj, todayShift?.storeId]);

//   const canPerformActions = useMemo(() => {
//     if (timesheet?.startActual) return true;
//     return geoOk && qrOk;
//   }, [timesheet?.startActual, geoOk, qrOk]);

//   useEffect(() => {
//     if (uid) loadToday();
//   }, [uid, today]);

//   useEffect(() => {
//     if (!todayShift?.storeId) return;
//     refreshLocation();
//     loadStoreSettings(todayShift.storeId);
//     loadStoreQr(todayShift.storeId);
//   }, [todayShift?.storeId]);

//   useEffect(() => {
//     if (geoOk && qrOk && !verifiedOnce) {
//       setVerifiedOnce(true);
//       setScanOpen(false);
//       if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
//     }
//   }, [geoOk, qrOk, verifiedOnce]);

//   async function refreshLocation() {
//     setGeoErr("");
//     setGeoBusy(true);
//     try {
//       const res = await getCurrentPositionPromise({
//         enableHighAccuracy: true,
//         timeout: 10000,
//         maximumAge: 0,
//       });
//       setGeo({
//         lat: res.coords.latitude,
//         lng: res.coords.longitude,
//         accuracy: res.coords.accuracy,
//         checkedAt: new Date(),
//       });
//     } catch (e) {
//       setGeoErr(e?.message || "Location access denied");
//       setGeo(null);
//     } finally {
//       setGeoBusy(false);
//     }
//   }

//   async function loadStoreQr(storeId) {
//     try {
//       const snap = await getDoc(doc(db, "storeQr", storeId));
//       if (snap.exists()) {
//         const data = snap.data();
//         const payload = data?.currentPayload;
//         let obj = payload ? parseQrPayload(payload) : null;
//         if (!obj && data?.currentCode) {
//           obj = { v: 1, storeId, code: data.currentCode };
//         }
//         setQrExpectedObj(obj);
//       }
//     } catch (e) {
//       console.error("QR Load Err:", e);
//     }
//   }

//   async function loadStoreSettings(storeId) {
//     try {
//       const snap = await getDoc(doc(db, "storeSettings", storeId));
//       if (snap.exists() && snap.data()?.radiusM) {
//         setRadiusM(snap.data().radiusM);
//       }
//     } catch (e) {
//       console.error("Settings Load Err:", e);
//     }
//   }

//   async function loadToday() {
//     if (!uid) return;
//     setLoading(true);
//     try {
//       const rosterQ = query(
//         collectionGroup(db, "shifts"),
//         where("uid", "==", uid),
//         where("date", "==", today)
//       );
//       const rosterSnap = await getDocs(rosterQ);
//       const shift = rosterSnap.docs.length
//         ? { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() }
//         : null;
//       setTodayShift(shift);

//       const timesheetId = `${uid}_${today}`;
//       const tsSnap = await getDoc(doc(db, "timesheets", timesheetId));

//       if (tsSnap.exists()) {
//         const ts = tsSnap.data();
//         setTimesheet({ id: timesheetId, ...ts });
//         setStartInput(ts.startInput || "");
//         setBreakStartInput(ts.breakStartInput || "");
//         setBreakEndInput(ts.breakEndInput || "");
//         setEndInput(ts.endInput || "");
//       } else {
//         setTimesheet(null);
//       }
//     } catch (err) {
//       console.error("Load Today Err:", err);
//       showToast("Failed to load today's shift.", "error", { title: "Load failed" });
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function doClockOn() {
//     if (!startInput) {
//       return showToast("Please select a start time.", "warning", { title: "Missing time" });
//     }
//     if (!geoOk || !qrOk) {
//       return showToast("Location and QR verification are required before clock on.", "warning", {
//         title: "Verification required",
//       });
//     }

//     try {
//       const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//       await setDoc(
//         tsRef,
//         {
//           uid,
//           staffName:
//             `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || profile?.email,
//           storeId: todayShift.storeId,
//           date: today,
//           startInput,
//           startActual: serverTimestamp(),
//           verification: {
//             clockOn: {
//               geo: {
//                 lat: geo.lat,
//                 lng: geo.lng,
//                 accuracy: geo.accuracy,
//                 distanceM,
//                 radiusMUsed: radiusM,
//               },
//               qrMatched: true,
//               verifiedAt: serverTimestamp(),
//             },
//           },
//           status: "working",
//           updatedAt: serverTimestamp(),
//         },
//         { merge: true }
//       );

//       showToast("You are now clocked on.", "success", { title: "Shift started" });
//       await loadToday();
//     } catch (e) {
//       showToast("Clock on failed. Please try again.", "error", { title: "Clock on failed" });
//     }
//   }

//   async function doStartBreak() {
//     if (!breakStartInput) {
//       return showToast("Enter break start time.", "warning", { title: "Missing time" });
//     }

//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         breakStartInput,
//         breakStartActual: serverTimestamp(),
//         status: "on_break",
//         updatedAt: serverTimestamp(),
//       });

//       showToast("Break started.", "info", { title: "On break" });
//       await loadToday();
//     } catch (e) {
//       showToast("Failed to start break.", "error", { title: "Break failed" });
//     }
//   }

//   async function doEndBreak() {
//     if (!breakEndInput) {
//       return showToast("Enter break end time.", "warning", { title: "Missing time" });
//     }

//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         breakEndInput,
//         breakEndActual: serverTimestamp(),
//         status: "working",
//         updatedAt: serverTimestamp(),
//       });

//       showToast("Break ended. Back to work.", "success", { title: "Break finished" });
//       await loadToday();
//     } catch (e) {
//       showToast("Failed to end break.", "error", { title: "Break failed" });
//     }
//   }

//   async function doClockOff() {
//     if (!endInput) {
//       return showToast("Enter finish time.", "warning", { title: "Missing time" });
//     }

//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         endInput,
//         endActual: serverTimestamp(),
//         status: "clocked_out",
//         "verification.clockOff": {
//           geo: geo
//             ? {
//                 lat: geo.lat,
//                 lng: geo.lng,
//                 accuracy: geo.accuracy,
//                 distanceM,
//                 radiusMUsed: radiusM,
//               }
//             : "no_geo_at_off",
//           verifiedAt: serverTimestamp(),
//         },
//         updatedAt: serverTimestamp(),
//       });

//       showToast("You have clocked off.", "success", { title: "Shift completed" });
//       await loadToday();
//     } catch (e) {
//       showToast("Clock off failed. Please try again.", "error", { title: "Clock off failed" });
//     }
//   }

//   const isOnBreak =
//     timesheet?.status === "on_break" ||
//     (!!timesheet?.breakStartActual && !timesheet?.breakEndActual);

//   const liveStatus = useMemo(() => {
//     if (!timesheet?.startActual) {
//       return {
//         key: "not_started",
//         label: "Not started",
//         dotClass: "dot-gray",
//       };
//     }

//     if (timesheet?.endActual || timesheet?.status === "clocked_out") {
//       return {
//         key: "clocked_out",
//         label: "Clocked off",
//         dotClass: "dot-gray",
//       };
//     }

//     if (
//       timesheet?.status === "on_break" ||
//       (timesheet?.breakStartActual && !timesheet?.breakEndActual)
//     ) {
//       return {
//         key: "on_break",
//         label: "On break",
//         dotClass: "dot-orange",
//       };
//     }

//     return {
//       key: "working",
//       label: "Working",
//       dotClass: "dot-green",
//     };
//   }, [timesheet]);

//   if (loading) {
//     return (
//       <div className="container">
//         <div className="card">
//           <p>Loading dashboard...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="dashboard-header">
//           <div className="header-content">
//             <h1 className="dashboard-title">Shift Dashboard</h1>
//             <p className="dashboard-date">
//               Today: <span className="date-highlight">{today}</span>
//             </p>
//           </div>
//           <button className="icon-button-refresh" onClick={loadToday}>
//             <RefreshIcon />
//           </button>
//         </div>

//         {!todayShift ? (
//           <div className="notice">
//             <div className="noticeTitle">No scheduled shift</div>
//             <div className="noticeSub">You aren't rostered for today.</div>
//           </div>
//         ) : (
//           <>
//             <div className="shift-info-card">
//               <div className="info-segment">
//                 <span className="info-label">Store</span>
//                 <span className="info-value primary-link">{storeLabel(todayShift.storeId)}</span>
//               </div>

//               <div className="info-divider-vertical" />

//               <div className="info-segment">
//                 <span className="info-label">Roster</span>
//                 <span className="info-value">
//                   {todayShift.startPlanned} - {todayShift.endPlanned}
//                 </span>
//               </div>

//               <div className="info-divider-vertical" />

//               <div className="info-segment">
//                 <span className="info-label">Live Status</span>
//                 <span className="live-status-inline">
//                   <span className={`live-dot ${liveStatus.dotClass}`}></span>
//                   <span className="info-value">{liveStatus.label}</span>
//                 </span>
//               </div>
//             </div>

//             {!timesheet?.startActual && !canPerformActions && (
//               <div className="clock-card">
//                 <h2 className="clock-header">Verification</h2>
//                 <div className="status-container">
//                   <div className="status-row">
//                     <div className="status-label">1. Location</div>
//                     <span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>
//                       {geoOk ? "In Range" : geoBusy ? "Checking..." : "Out of Range"}
//                     </span>
//                   </div>

//                   <button
//                     className="action-button secondary"
//                     onClick={refreshLocation}
//                     disabled={geoBusy}
//                   >
//                     {geoBusy ? "Locating..." : "Refresh GPS"}
//                   </button>

//                   <div className="divider" />

//                   <div className="status-row">
//                     <div className="status-label">2. QR Code</div>
//                     <span className={`status-badge ${qrOk ? "is-ok" : "is-warn"}`}>
//                       {qrOk ? "Verified" : "Pending"}
//                     </span>
//                   </div>

//                   <button
//                     className="action-button primary"
//                     onClick={() => setScanOpen(true)}
//                     disabled={!geoOk}
//                   >
//                     Scan QR Code
//                   </button>

//                   {geoErr && <p className="small-note">{geoErr}</p>}
//                 </div>
//               </div>
//             )}

//             {!timesheet?.startActual && canPerformActions && (
//               <div className="time-entry-card animation-fade-in">
//                 <h2 className="time-header">Ready to Start</h2>
//                 <div className="input-group">
//                   <input
//                     className="time-picker"
//                     type="time"
//                     value={startInput}
//                     onChange={(e) => setStartInput(e.target.value)}
//                   />
//                   <button
//                     className="action-button brand-filled"
//                     onClick={doClockOn}
//                     disabled={!startInput}
//                   >
//                     Clock On Now
//                   </button>
//                 </div>
//               </div>
//             )}

//             {timesheet?.startActual && !timesheet?.endActual && (
//               <div className="flow">
//                 {!timesheet.breakStartActual && (
//                   <div className="break-card">
//                     <h3 className="break-title">Break Management</h3>
//                     <div className="input-stack">
//                       <input
//                         className="time-picker"
//                         type="time"
//                         value={breakStartInput}
//                         onChange={(e) => setBreakStartInput(e.target.value)}
//                       />
//                       <button
//                         className="action-button outline"
//                         onClick={doStartBreak}
//                         disabled={!breakStartInput}
//                       >
//                         Start Break
//                       </button>
//                     </div>
//                   </div>
//                 )}

//                 {isOnBreak && (
//                   <div className="break-active-card">
//                     <h3 className="break-title pulse-text">Currently on Break</h3>
//                     <div className="input-stack">
//                       <input
//                         className="time-picker highlight-border"
//                         type="time"
//                         value={breakEndInput}
//                         onChange={(e) => setBreakEndInput(e.target.value)}
//                       />
//                       <button
//                         className="action-button brand-filled"
//                         onClick={doEndBreak}
//                         disabled={!breakEndInput}
//                       >
//                         End Break
//                       </button>
//                     </div>
//                   </div>
//                 )}

//                 <div className={`clock-off-card ${isOnBreak ? "is-locked" : ""}`}>
//                   <h2 className="clock-off-header">Finish Shift</h2>
//                   {isOnBreak && (
//                     <p className="small-note">End your break before clocking off.</p>
//                   )}
//                   <div className="input-group">
//                     <input
//                       className="time-picker"
//                       type="time"
//                       value={endInput}
//                       onChange={(e) => setEndInput(e.target.value)}
//                       disabled={isOnBreak}
//                     />
//                     <button
//                       className="action-button brand-filled clock-off-btn"
//                       onClick={doClockOff}
//                       disabled={isOnBreak || !endInput}
//                     >
//                       Clock Off
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {timesheet?.endActual && (
//               <div className="summary-card shift-done">
//                 <div className="summary-header">
//                   <div className="success-icon">✓</div>
//                   <h2 className="summary-title">Shift Completed</h2>
//                 </div>
//                 <div className="receipt-container">
//                   <div className="receipt-row">
//                     <span className="receipt-label">Started</span>
//                     <span className="receipt-value">{timesheet.startInput}</span>
//                   </div>

//                   {timesheet.breakStartInput && (
//                     <div className="receipt-row">
//                       <span className="receipt-label">Break</span>
//                       <span className="receipt-value">
//                         {timesheet.breakStartInput} - {timesheet.breakEndInput}
//                       </span>
//                     </div>
//                   )}

//                   <div className="receipt-row">
//                     <span className="receipt-label">Finished</span>
//                     <span className="receipt-value">{timesheet.endInput}</span>
//                   </div>
//                 </div>
//               </div>
//             )}
//           </>
//         )}
//       </div>

//       <QRScanner
//         open={scanOpen}
//         onClose={() => setScanOpen(false)}
//         onResult={(res) => setQrInput(res)}
//         title="Scan store QR"
//       />
//     </div>
//   );
// }

// const RefreshIcon = () => (
//   <svg
//     width="20"
//     height="20"
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke="currentColor"
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//   >
//     <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
//   </svg>
// );














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

// // Helpers
// function storeLabel(storeId) {
//   return STORES.find((s) => s.id === storeId)?.label || storeId || "-";
// }

// function getStoreMeta(storeId) {
//   return STORES.find((s) => s.id === storeId) || null;
// }

// function haversineMeters(aLat, aLng, bLat, bLng) {
//   const R = 6371000;
//   const toRad = (d) => (d * Math.PI) / 180;
//   const dLat = toRad(bLat - aLat);
//   const dLng = toRad(bLng - aLng);
//   const lat1 = toRad(aLat);
//   const lat2 = toRad(bLat);
//   const x =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
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
//   } catch {
//     return null;
//   }
//   return null;
// }

// export default function StaffToday() {
//   const { fbUser, profile } = useAuth();
//   const { showToast } = useToast();

//   const uid = fbUser?.uid;
//   const today = useMemo(() => toYMD(new Date()), []);

//   const [loading, setLoading] = useState(true);
//   const [todayShift, setTodayShift] = useState(null);
//   const [timesheet, setTimesheet] = useState(null);

//   // --- STOCK TAKE STATES ---
//   const [stockItems, setStockItems] = useState([{ name: "", qty: "" }]); 
//   const [stockTakeDone, setStockTakeDone] = useState(false);
//   const [showStockModal, setShowStockModal] = useState(false);
//   const [submittingStock, setSubmittingStock] = useState(false);

//   // Form Inputs
//   const [startInput, setStartInput] = useState("");
//   const [breakStartInput, setBreakStartInput] = useState("");
//   const [breakEndInput, setBreakEndInput] = useState("");
//   const [endInput, setEndInput] = useState("");

//   // Verification States
//   const [geo, setGeo] = useState(null);
//   const [geoErr, setGeoErr] = useState("");
//   const [geoBusy, setGeoBusy] = useState(false);
//   const [scanOpen, setScanOpen] = useState(false);
//   const [radiusM, setRadiusM] = useState(3000);
//   const [qrExpectedObj, setQrExpectedObj] = useState(null);
//   const [qrInput, setQrInput] = useState("");
//   const [verifiedOnce, setVerifiedOnce] = useState(false);

//   const storeMeta = useMemo(() => getStoreMeta(todayShift?.storeId), [todayShift?.storeId]);

//   const distanceM = useMemo(() => {
//     if (!geo || !storeMeta?.lat || !storeMeta?.lng) return null;
//     return Math.round(haversineMeters(geo.lat, geo.lng, storeMeta.lat, storeMeta.lng));
//   }, [geo, storeMeta]);

//   const geoOk = useMemo(() => {
//     if (!geo) return false;
//     return distanceM <= radiusM && (geo.accuracy ?? 999) <= 100;
//   }, [geo, distanceM, radiusM]);

//   const qrOk = useMemo(() => {
//     if (!qrExpectedObj) return false;
//     const raw = String(qrInput || "").trim();
//     if (!raw) return false;

//     const scannedObj = parseQrPayload(raw);

//     if (scannedObj) {
//       return (
//         String(scannedObj.storeId) === String(todayShift?.storeId) &&
//         String(scannedObj.code) === String(qrExpectedObj.code)
//       );
//     }

//     return String(raw) === String(qrExpectedObj.code);
//   }, [qrInput, qrExpectedObj, todayShift?.storeId]);

//   const canPerformActions = useMemo(() => {
//     if (timesheet?.startActual) return true;
//     return geoOk && qrOk;
//   }, [timesheet?.startActual, geoOk, qrOk]);

//   useEffect(() => {
//     if (uid) loadToday();
//   }, [uid, today]);

//   useEffect(() => {
//     if (!todayShift?.storeId) return;
//     refreshLocation();
//     loadStoreSettings(todayShift.storeId);
//     loadStoreQr(todayShift.storeId);
//     checkStockStatus(todayShift.storeId);
//   }, [todayShift?.storeId]);

//   useEffect(() => {
//     if (geoOk && qrOk && !verifiedOnce) {
//       setVerifiedOnce(true);
//       setScanOpen(false);
//       if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
//     }
//   }, [geoOk, qrOk, verifiedOnce]);

//   // --- STOCK TAKE LOGIC ---
//   const addStockRow = () => setStockItems([...stockItems, { name: "", qty: "" }]);
  
//   const updateStockRow = (index, field, value) => {
//     const updated = [...stockItems];
//     updated[index][field] = value;
//     setStockItems(updated);
//   };

//   const removeStockRow = (index) => {
//     if (stockItems.length === 1) return;
//     setStockItems(stockItems.filter((_, i) => i !== index));
//   };

//   // async function checkStockStatus(storeId) {
//   //   try {
//   //     const stockId = `${storeId}_${today}`;
//   //     const snap = await getDoc(doc(db, "dailyStockTake", stockId));
//   //     setStockTakeDone(snap.exists());
//   //   } catch (e) {
//   //     console.error("Stock check error:", e);
//   //   }
//   // }

//   // async function handleStockSubmit() {
//   //   const validItems = stockItems.filter(item => item.name.trim() !== "" && item.qty !== "");
//   //   if (validItems.length === 0) return showToast("Add at least one item.", "warning");
    
//   //   setSubmittingStock(true);
//   //   const stockId = `${todayShift.storeId}_${today}`;
//   //   try {
//   //     await setDoc(doc(db, "dailyStockTake", stockId), {
//   //       storeId: todayShift.storeId,
//   //       date: today,
//   //       submittedBy: uid,
//   //       staffName: `${profile?.firstName || ""} ${profile?.lastName || ""}`,
//   //       items: validItems,
//   //       timestamp: serverTimestamp()
//   //     });
//   //     setStockTakeDone(true);
//   //     setShowStockModal(false);
//   //     showToast("Stock take submitted!", "success");
//   //   } catch (e) {
//   //     showToast("Submission failed.", "error");
//   //   } finally {
//   //     setSubmittingStock(false);
//   //   }
//   // }


//   // --- UPDATED STOCK TAKE LOGIC ---
//   async function checkStockStatus(storeId) {
//     try {
//       const stockId = `${storeId}_${today}`;
//       const snap = await getDoc(doc(db, "dailyStockTake", stockId));
//       if (snap.exists()) {
//         setStockTakeDone(true);
//         // Load the existing items into state so the next person sees them
//         const data = snap.data();
//         if (data.items) {
//           setStockItems(data.items);
//         }
//       } else {
//         setStockTakeDone(false);
//         setStockItems([{ name: "", qty: "" }]); // Reset if no data exists yet
//       }
//     } catch (e) {
//       console.error("Stock check error:", e);
//     }
//   }

//   async function handleStockSubmit() {
//     const validItems = stockItems.filter(item => item.name.trim() !== "" && item.qty !== "");
//     if (validItems.length === 0) return showToast("Add at least one item.", "warning");
    
//     setSubmittingStock(true);
//     const stockId = `${todayShift.storeId}_${today}`;
    
//     const userName = `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim();

//     try {
//       await setDoc(doc(db, "dailyStockTake", stockId), {
//         storeId: todayShift.storeId,
//         date: today,
//         lastUpdatedBy: uid,
//         lastUpdatedByName: userName,
//         items: validItems,
//         timestamp: serverTimestamp()
//       }, { merge: true }); // Use merge: true to keep the original 'submittedBy' if you have one
      
//       setStockTakeDone(true);
//       setShowStockModal(false);
//       showToast("Stock updated successfully!", "success");
//     } catch (e) {
//       showToast("Update failed.", "error");
//     } finally {
//       setSubmittingStock(false);
//     }
//   }

//   // --- CORE ACTIONS ---
//   async function refreshLocation() {
//     setGeoErr(""); setGeoBusy(true);
//     try {
//       const res = await getCurrentPositionPromise({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
//       setGeo({ lat: res.coords.latitude, lng: res.coords.longitude, accuracy: res.coords.accuracy, checkedAt: new Date() });
//     } catch (e) {
//       setGeoErr(e?.message || "Location access denied");
//       setGeo(null);
//     } finally { setGeoBusy(false); }
//   }

//   async function loadStoreQr(storeId) {
//     try {
//       const snap = await getDoc(doc(db, "storeQr", storeId));
//       if (snap.exists()) {
//         const data = snap.data();
//         const payload = data?.currentPayload;
//         let obj = payload ? parseQrPayload(payload) : null;
//         if (!obj && data?.currentCode) obj = { v: 1, storeId, code: data.currentCode };
//         setQrExpectedObj(obj);
//       }
//     } catch (e) { console.error("QR Load Err:", e); }
//   }

//   async function loadStoreSettings(storeId) {
//     try {
//       const snap = await getDoc(doc(db, "storeSettings", storeId));
//       if (snap.exists() && snap.data()?.radiusM) setRadiusM(snap.data().radiusM);
//     } catch (e) { console.error("Settings Load Err:", e); }
//   }

//   async function loadToday() {
//     if (!uid) return;
//     setLoading(true);
//     try {
//       const rosterQ = query(collectionGroup(db, "shifts"), where("uid", "==", uid), where("date", "==", today));
//       const rosterSnap = await getDocs(rosterQ);
//       const shift = rosterSnap.docs.length ? { id: rosterSnap.docs[0].id, ...rosterSnap.docs[0].data() } : null;
//       setTodayShift(shift);

//       const timesheetId = `${uid}_${today}`;
//       const tsSnap = await getDoc(doc(db, "timesheets", timesheetId));
//       if (tsSnap.exists()) {
//         const ts = tsSnap.data();
//         setTimesheet({ id: timesheetId, ...ts });
//         setStartInput(ts.startInput || "");
//         setBreakStartInput(ts.breakStartInput || "");
//         setBreakEndInput(ts.breakEndInput || "");
//         setEndInput(ts.endInput || "");
//       } else { setTimesheet(null); }
//     } catch (err) { showToast("Failed to load shift.", "error"); } 
//     finally { setLoading(false); }
//   }

//   async function doClockOn() {
//     if (!startInput) return showToast("Select start time.", "warning");
//     if (!geoOk || !qrOk) return showToast("Verification required.", "warning");

//     try {
//       const tsRef = doc(db, "timesheets", `${uid}_${today}`);
//       await setDoc(tsRef, {
//         uid,
//         staffName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || profile?.email,
//         storeId: todayShift.storeId,
//         date: today,
//         startInput,
//         startActual: serverTimestamp(),
//         verification: { clockOn: { geo: { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy, distanceM, radiusMUsed: radiusM }, qrMatched: true, verifiedAt: serverTimestamp() } },
//         status: "working",
//         updatedAt: serverTimestamp(),
//       }, { merge: true });
//       showToast("Clocked on.", "success");
//       await loadToday();
//     } catch (e) { showToast("Clock on failed.", "error"); }
//   }

//   async function doStartBreak() {
//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         breakStartInput, breakStartActual: serverTimestamp(), status: "on_break", updatedAt: serverTimestamp(),
//       });
//       showToast("Break started.", "info");
//       await loadToday();
//     } catch (e) { showToast("Failed.", "error"); }
//   }

//   async function doEndBreak() {
//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         breakEndInput, breakEndActual: serverTimestamp(), status: "working", updatedAt: serverTimestamp(),
//       });
//       showToast("Break ended.", "success");
//       await loadToday();
//     } catch (e) { showToast("Failed.", "error"); }
//   }

//   async function doClockOff() {
//     if (!endInput) return showToast("Enter finish time.", "warning");
    
//     // Final check for stock take
//     const stockId = `${todayShift.storeId}_${today}`;
//     const stockSnap = await getDoc(doc(db, "dailyStockTake", stockId));
//     if (!stockSnap.exists()) {
//       return showToast("Please complete Stock Take first.", "error");
//     }

//     try {
//       await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
//         endInput, endActual: serverTimestamp(), status: "clocked_out",
//         "verification.clockOff": { geo: geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy, distanceM, radiusMUsed: radiusM } : "no_geo", verifiedAt: serverTimestamp() },
//         updatedAt: serverTimestamp(),
//       });
//       showToast("Clocked off.", "success");
//       await loadToday();
//     } catch (e) { showToast("Clock off failed.", "error"); }
//   }

//   const isOnBreak = timesheet?.status === "on_break" || (!!timesheet?.breakStartActual && !timesheet?.breakEndActual);

//   const liveStatus = useMemo(() => {
//     if (!timesheet?.startActual) return { key: "not_started", label: "Not started", dotClass: "dot-gray" };
//     if (timesheet?.endActual || timesheet?.status === "clocked_out") return { key: "clocked_out", label: "Clocked off", dotClass: "dot-gray" };
//     if (isOnBreak) return { key: "on_break", label: "On break", dotClass: "dot-orange" };
//     return { key: "working", label: "Working", dotClass: "dot-green" };
//   }, [timesheet, isOnBreak]);

//   if (loading) return <div className="container"><div className="card"><p>Loading dashboard...</p></div></div>;

//   return (
//     <div className="container">
//       <div className="card">
//         <div className="dashboard-header">
//           <div className="header-content">
//             <h1 className="dashboard-title">Shift Dashboard</h1>
//             <p className="dashboard-date">Today: <span className="date-highlight">{today}</span></p>
//           </div>
//           <div className="header-actions staff-ko-header">
//              {timesheet?.startActual && !timesheet?.endActual && (
//                 <button 
//                   className={`stock-btn ${stockTakeDone ? "is-done" : ""}`} 
//                   onClick={() => !stockTakeDone && setShowStockModal(true)}
//                 >
//                   {stockTakeDone ? "✅ Stock Done" : "📦 Stock Take"}
                  
//                 </button>
//              )}
//             <button className="icon-button-refresh" onClick={loadToday}><RefreshIcon /></button>
//           </div>
//         </div>

//         {!todayShift ? (
//           <div className="notice">
//             <div className="noticeTitle">No scheduled shift</div>
//             <div className="noticeSub">You aren't rostered for today.</div>
//           </div>
//         ) : (
//           <>
//             <div className="shift-info-card">
//               <div className="info-segment"><span className="info-label">Store</span><span className="info-value primary-link">{storeLabel(todayShift.storeId)}</span></div>
//               <div className="info-divider-vertical" />
//               <div className="info-segment"><span className="info-label">Roster</span><span className="info-value">{todayShift.startPlanned} - {todayShift.endPlanned}</span></div>
//               <div className="info-divider-vertical" />
//               <div className="info-segment"><span className="info-label">Status</span><span className="live-status-inline"><span className={`live-dot ${liveStatus.dotClass}`}></span><span className="info-value">{liveStatus.label}</span></span></div>
//             </div>

//             {!timesheet?.startActual && !canPerformActions && (
//               <div className="clock-card">
//                 <h2 className="clock-header">Verification</h2>
//                 <div className="status-container">
//                   <div className="status-row"><div className="status-label">1. Location</div><span className={`status-badge ${geoOk ? "is-ok" : "is-warn"}`}>{geoOk ? "In Range" : "Check Range"}</span></div>
//                   <button className="action-button secondary" onClick={refreshLocation} disabled={geoBusy}>{geoBusy ? "Locating..." : "Refresh GPS"}</button>
//                   <div className="divider" />
//                   <div className="status-row"><div className="status-label">2. QR Code</div><span className={`status-badge ${qrOk ? "is-ok" : "is-warn"}`}>{qrOk ? "Verified" : "Pending"}</span></div>
//                   <button className="action-button primary" onClick={() => setScanOpen(true)} disabled={!geoOk}>Scan QR Code</button>
//                 </div>
//               </div>
//             )}

//             {!timesheet?.startActual && canPerformActions && (
//               <div className="time-entry-card animation-fade-in">
//                 <h2 className="time-header">Ready to Start</h2>
//                 <div className="input-group">
//                   <input className="time-picker" type="time" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
//                   <button className="action-button brand-filled" onClick={doClockOn} disabled={!startInput}>Clock On Now</button>
//                 </div>
//               </div>
//             )}

//             {timesheet?.startActual && !timesheet?.endActual && (
//               <div className="flow">
//                 {!timesheet.breakStartActual && (
//                   <div className="break-card">
//                     <h3 className="break-title">Break Management</h3>
//                     <div className="input-stack">
//                       <input className="time-picker" type="time" value={breakStartInput} onChange={(e) => setBreakStartInput(e.target.value)} />
//                       <button className="action-button outline" onClick={doStartBreak} disabled={!breakStartInput}>Start Break</button>
//                     </div>
//                   </div>
//                 )}

//                 {isOnBreak && (
//                   <div className="break-active-card">
//                     <h3 className="break-title pulse-text">Currently on Break</h3>
//                     <div className="input-stack">
//                       <input className="time-picker highlight-border" type="time" value={breakEndInput} onChange={(e) => setBreakEndInput(e.target.value)} />
//                       <button className="action-button brand-filled" onClick={doEndBreak} disabled={!breakEndInput}>End Break</button>
//                     </div>
//                   </div>
//                 )}

//                 <div className={`clock-off-card ${isOnBreak || !stockTakeDone ? "is-locked" : ""}`}>
//                   <h2 className="clock-off-header">Finish Shift</h2>
//                   {isOnBreak && <p className="small-note">End your break before clocking off.</p>}
//                   {!stockTakeDone && <p className="small-note" style={{color: '#f87171', fontWeight: 'bold'}}>⚠️ Complete Stock Take to unlock</p>}
//                   <div className="input-group">
//                     <input className="time-picker" type="time" value={endInput} disabled={isOnBreak || !stockTakeDone} onChange={(e) => setEndInput(e.target.value)} />
//                     <button className="action-button brand-filled clock-off-btn" onClick={doClockOff} disabled={isOnBreak || !endInput || !stockTakeDone}>Clock Off</button>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {timesheet?.endActual && (
//               <div className="summary-card shift-done">
//                 {stockTakeDone ? "✅ Stock Take Done" : "📦 Stock Take"}
//                 <div className="summary-header"><h2 className="summary-title">Shift Completed</h2></div>
//                 <div className="receipt-container">
//                   <div className="receipt-row"><span className="receipt-label">Started</span><span className="receipt-value">{timesheet.startInput}</span></div>
//                   {timesheet.breakStartInput && <div className="receipt-row"><span className="receipt-label">Break</span><span className="receipt-value">{timesheet.breakStartInput} - {timesheet.breakEndInput}</span></div>}
//                   <div className="receipt-row"><span className="receipt-label">Finished</span><span className="receipt-value">{timesheet.endInput}</span></div>
//                 </div>
//               </div>
//             )}
//           </>
//         )}
//       </div>

//       {showStockModal && (
//         <div className="modal-overlay">
//           <div className="stock-modal">
//             <div className="modal-header">
//                 <h3>Store Stock Take</h3>
//                 <span className="modal-subtitle">Record daily counts</span>
//             </div>
//             <div className="stock-list-container">
//                 {stockItems.map((item, idx) => (
//                     <div key={idx} className="stock-row-input">
//                         <div className="input-main">
//                           <input className="item-name-input" placeholder="Item Name" value={item.name} onChange={e => updateStockRow(idx, 'name', e.target.value)} />
//                           <input className="qty-input" type="number" placeholder="Qty" value={item.qty} onChange={e => updateStockRow(idx, 'qty', e.target.value)} />
//                         </div>
//                         {stockItems.length > 1 && <button className="remove-row-btn" onClick={() => removeStockRow(idx)}>✕</button>}
//                     </div>
//                 ))}
//                 {/* ADD BUTTON IS NOW BELOW ITEMS */}
//                 <button className="add-row-btn" onClick={addStockRow}>+ Add Another Item</button>
//             </div>
//             <div className="modal-actions">
//                 <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button primary">{submittingStock ? "Saving..." : "Save & Complete"}</button>
//                 <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
//             </div>
//           </div>
//         </div>
//       )}

//       <QRScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={(res) => setQrInput(res)} title="Scan store QR" />
//     </div>
//   );
// }

// const RefreshIcon = () => (
//   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
// );




















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











import { useEffect, useMemo, useState } from "react";
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
  collection
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { STORES } from "../../utils/constants";

import { useStores } from "../../hooks/useStore";
import { toYMD } from "../../utils/dates";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import "./StaffToday.css";

// const storeLabel = (sId) => STORES.find((s) => s.id === sId)?.label || sId || "-";

export default function StaffToday() {
  const { fbUser, profile } = useAuth();
  const { showToast } = useToast();

  const { stores, getStoreLabel } = useStores();

  const uid = fbUser?.uid;
  
  // Date Logic
  const today = useMemo(() => toYMD(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toYMD(d);
  }, []);

  const [loading, setLoading] = useState(true);
  const [todayShift, setTodayShift] = useState(null);
  const [timesheet, setTimesheet] = useState(null);

  // --- STOCK STATES ---
  const [dbItems, setDbItems] = useState([]);
  const [stockDraft, setStockDraft] = useState([]);
  const [stockTakeDone, setStockTakeDone] = useState(false);
  const [isAdminProcessed, setIsAdminProcessed] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [submittingStock, setSubmittingStock] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  
  // Kitchen-specific state
  const [allStoreRequests, setAllStoreRequests] = useState([]);

  // --- FORM INPUTS ---
  const [startInput, setStartInput] = useState("");
  const [breakStartInput, setBreakStartInput] = useState("");
  const [breakEndInput, setBreakEndInput] = useState("");
  const [endInput, setEndInput] = useState("");

  // ✅ KITCHEN DETECTION
  const isKitchen = profile?.department === "kitchen" || todayShift?.storeId === "kitchen";

  useEffect(() => { if (uid) loadToday(); }, [uid, today]);

  useEffect(() => {
    if (todayShift?.storeId) {
      checkStockStatus(todayShift.storeId);
      if (isKitchen) loadAllStoreRequests();
    }
  }, [todayShift?.storeId, isKitchen]);

  async function checkStockStatus(storeId) {
    try {
      // Pull data for TODAY (which was submitted yesterday)
      const snap = await getDoc(doc(db, "dailyStockTake", `${storeId}_${today}`));
      if (snap.exists()) {
        const data = snap.data();
        setDbItems(data.items || []);
        setIsAdminProcessed(data.adminProcessed || false);
      }
      
      // Check if they have already submitted for TOMORROW
      const tomorrowSnap = await getDoc(doc(db, "dailyStockTake", `${storeId}_${tomorrow}`));
      if (tomorrowSnap.exists()) {
        setStockTakeDone(true);
      }
    } catch (e) { console.error(e); }
  }

  async function loadAllStoreRequests() {
    try {
      const q = query(collection(db, "dailyStockTake"), where("date", "==", today));
      const snap = await getDocs(q);
      setAllStoreRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  }

  const handleKitchenQtyChange = (docId, itemIndex, newVal) => {
    setAllStoreRequests(prev => prev.map(req => {
      if (req.id !== docId) return req;
      const updatedItems = [...req.items];
      updatedItems[itemIndex].qtySent = Number(newVal);
      return { ...req, items: updatedItems };
    }));
  };

  const toggleGroup = (id) => {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKitchenSubmit = async (record) => {
    try {
      const docRef = doc(db, "dailyStockTake", record.id);
      await updateDoc(docRef, {
        items: record.items,
        adminProcessed: true,
        processedAt: serverTimestamp(),
        processedBy: profile?.firstName
      });
      showToast(`Dispatched to ${getStoreLabel(record.storeId)}`, "success");
      loadAllStoreRequests();
    } catch (e) { showToast("Update failed", "error"); }
  };

  // const handleOpenStockModal = () => {
  //   const initial = [{ id: Math.random(), name: "", qtyRequested: "" }];
  //   setStockDraft(initial);
  //   setShowStockModal(true);
  // };

      const handleOpenStockModal = async () => {
        setLoading(true); // Show a brief loader while fetching
        try {
          // Attempt to fetch tomorrow's existing request
          const tomorrowSnap = await getDoc(doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`));
          
          if (tomorrowSnap.exists()) {
            const existingData = tomorrowSnap.data();
            // Pre-fill the draft with existing items, adding a temporary ID for the React keys
            const mappedItems = existingData.items.map(item => ({
              ...item,
              id: Math.random() // Unique ID for the UI list logic
            }));
            setStockDraft(mappedItems);
          } else {
            // If nothing exists, start with one empty row
            setStockDraft([{ id: Math.random(), name: "", qtyRequested: "" }]);
          }
          setShowStockModal(true);
        } catch (e) {
          showToast("Error loading existing request", "error");
        } finally {
          setLoading(false);
        }
      };

  const addStockRow = () => setStockDraft([...stockDraft, { id: Math.random(), name: "", qtyRequested: "" }]);
  const updateStockRow = (id, field, value) => setStockDraft(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  const removeStockRow = (id) => setStockDraft(prev => prev.filter(it => it.id !== id));

  async function handleStockSubmit() {
    const finalItems = stockDraft
      .filter(it => it.name.trim() !== "" && it.qtyRequested !== "")
      .map(({ id, ...rest }) => ({ ...rest, status: "pending", qtySent: 0 }));

    if (finalItems.length === 0) return showToast("Add items.", "warning");
    setSubmittingStock(true);
    try {
      // Save for TOMORROW
      await setDoc(doc(db, "dailyStockTake", `${todayShift.storeId}_${tomorrow}`), {
        storeId: todayShift.storeId, 
        storeLabel: getStoreLabel(todayShift.storeId), 
        date: tomorrow,
        lastUpdatedByName: profile?.firstName, 
        items: finalItems, 
        adminProcessed: false
      }, { merge: true });
      
      setStockTakeDone(true);
      setShowStockModal(false);
      showToast(`Request sent for ${tomorrow}`, "success");
    } catch (e) { showToast("Error", "error"); } finally { setSubmittingStock(false); }
  }

  async function loadToday() {
    setLoading(true);
    const rosterQ = query(collectionGroup(db, "shifts"), where("uid", "==", uid), where("date", "==", today));
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
      }
    }
    setLoading(false);
  }

  async function doClockOn() {
    await setDoc(doc(db, "timesheets", `${uid}_${today}`), {
      uid, staffName: profile?.firstName, storeId: todayShift.storeId,
      date: today, startInput, startActual: serverTimestamp(), status: "working"
    }, { merge: true });
    loadToday();
  }

  async function doStartBreak() {
    await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
      breakStartInput, breakStartActual: serverTimestamp(), status: "on_break"
    });
    showToast("Break started", "info");
    loadToday();
  }

  async function doEndBreak() {
    await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
      breakEndInput, breakEndActual: serverTimestamp(), status: "working"
    });
    showToast("Break ended", "success");
    loadToday();
  }

  async function doClockOff() {
    if (!isKitchen && !stockTakeDone) return showToast("Submit tomorrow's stock first!", "error");
    await updateDoc(doc(db, "timesheets", `${uid}_${today}`), {
      endInput, endActual: serverTimestamp(), status: "clocked_out"
    });
    loadToday();
  }

  const isOnBreak = timesheet?.status === "on_break";

  if (loading) return <div className="container"><div className="card">Loading...</div></div>;

  return (
    <div className="container">
      <div className="card">
        <div className="dashboard-header">
          <div className="header-content">
            <h1 className="dashboard-title">Shift Dashboard</h1>
            <p className="dashboard-date">{today} {isKitchen && <span className="kitchen-pill">KITCHEN</span>}</p>
          </div>
          <div className="header-actions add-item-dash">
            {!isKitchen && timesheet?.startActual && !timesheet?.endActual && (
               <div style={{display: 'flex', gap: '8px'}}>
                  <button className="view-log-btn" onClick={() => setShowDispatchModal(true)}>🚚 Log</button>
                  <button className={`stock-btn ${stockTakeDone ? "is-done" : ""}`} onClick={handleOpenStockModal}>
                    {stockTakeDone ? "📝 Edit Tomorrow" : "📦 Stock"}
                  </button>
               </div>
            )}
            <button className="icon-button-refresh" onClick={loadToday}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg></button>
          </div>
        </div>

        {!todayShift ? <div className="notice">No Shift Scheduled</div> : (
          <div className="flow">
            <div className="shift-info-card">
              <b>{getStoreLabel(todayShift.storeId)}</b> | {todayShift.startPlanned} - {todayShift.endPlanned}
            </div>

            {!timesheet?.startActual ? (
              <div className="time-entry-card">
                <input className="time-picker" type="time" value={startInput} onChange={e => setStartInput(e.target.value)} />
                <button className="action-button brand-filled" onClick={doClockOn}>Clock On</button>
              </div>
            ) : !timesheet?.endActual ? (
              <>
                {isKitchen && (
                  <div className="kitchen-dispatch-area">
                    <h3 className="section-label">Pending Orders for Today</h3>
                    {allStoreRequests.length === 0 ? <p className="small-note">No orders today.</p> : (
                      allStoreRequests.map(req => {
                        const isExpanded = !!collapsedGroups[req.id];
                        return (
                          <div key={req.id} className="dispatch-card">
                            <div className="dispatch-header clickable" onClick={() => toggleGroup(req.id)}>
                              <div className="header-left">
                                <span className={`arrow ${isExpanded ? 'down' : 'right'}`}>▶</span>
                                <b>{getStoreLabel(req.storeId)}</b>
                              </div>
                              <span className={req.adminProcessed ? "tag-green" : "tag-orange"}>
                                {req.adminProcessed ? "Dispatched" : "Pending"}
                              </span>
                            </div>
                            {isExpanded && (
                              <div className="dispatch-content-wrapper">
                                {req.items.map((it, idx) => (
                                  <div key={idx} className="dispatch-row">
                                    <span>{it.name} <small>(Req: {it.qtyRequested})</small></span>
                                    <input type="number" className="qty-send-input" value={it.qtySent || ""} placeholder="0" onChange={(e) => handleKitchenQtyChange(req.id, idx, e.target.value)} />
                                  </div>
                                ))}
                                <button className="dispatch-submit-btn" onClick={() => handleKitchenSubmit(req)}>Save Dispatch</button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* BREAK SECTION */}
                {!timesheet.breakStartActual ? (
                  <div className="break-card">
                    <h3 className="break-title">Take a Break</h3>
                    <div className="input-stack">
                      <input className="time-picker" type="time" value={breakStartInput} onChange={e => setBreakStartInput(e.target.value)} />
                      <button className="action-button outline" onClick={doStartBreak} disabled={!breakStartInput}>Start Break</button>
                    </div>
                  </div>
                ) : !timesheet.breakEndActual || isOnBreak ? (
                  <div className="break-active-card">
                    <h3 className="break-title pulse-text">Currently on Break</h3>
                    <div className="input-stack">
                      <input className="time-picker" type="time" value={breakEndInput} onChange={e => setBreakEndInput(e.target.value)} />
                      <button className="action-button brand-filled" onClick={doEndBreak} disabled={!breakEndInput}>End Break</button>
                    </div>
                  </div>
                ) : (
                  <div className="notice success-sub">Break Completed ✅</div>
                )}

                <div className={`clock-off-card ${isOnBreak || (!isKitchen && !stockTakeDone) ? "is-locked" : ""}`}>
                   {!isKitchen && !stockTakeDone && <p className="stock-warning-text">Submit Tomorrow's Stock Take to unlock Clock Off</p>}
                  <div className="input-group">
                    <input className="time-picker" type="time" value={endInput} disabled={isOnBreak} onChange={e => setEndInput(e.target.value)} />
                    <button className="action-button brand-filled" onClick={doClockOff} disabled={isOnBreak || !endInput}>Clock Off</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="summary-card"><h3>Shift Completed ✅</h3></div>
            )}
          </div>
        )}
      </div>

      {/* DISPATCH LOG POPUP */}
      {showDispatchModal && (
        <div className="modal-overlay">
          <div className="stock-modal">
            <div className="modal-header"><h3>Today's Dispatch</h3></div>
            <div className="log-table">
              <div className="log-row header"><span>Item</span><span>Req</span><span>Sent</span></div>
              {dbItems.length > 0 ? dbItems.map((it, idx) => (
                <div key={idx} className="log-row">
                  <span>{it.name}</span><span>{it.qtyRequested}</span>
                  <span className={isAdminProcessed ? "text-green" : ""}>{isAdminProcessed ? it.qtySent : "..."}</span>
                </div>
              )) : <p className="notice">No request found for today.</p>}
            </div>
            <button onClick={() => setShowDispatchModal(false)} className="action-button secondary" style={{marginTop: '20px'}}>Close</button>
          </div>
        </div>
      )}

      {/* STOCK MODAL */}
      {/* {showStockModal && (
        <div className="modal-overlay">
          <div className="stock-modal">
            <div className="modal-header">
              <h3>Stock for {tomorrow}</h3>
            </div>
            <div className="stock-list-container">
              {stockDraft.map((item) => (
                <div key={item.id} className="stock-row-input">
                  <div className="input-main">
                    <input className="item-name-input" placeholder="Item" value={item.name} onChange={e => updateStockRow(item.id, 'name', e.target.value)} />
                    <input className="qty-input" type="number" placeholder="Qty" value={item.qtyRequested} onChange={e => updateStockRow(item.id, 'qtyRequested', e.target.value)} />
                  </div>
                  <button className="remove-row-btn" onClick={() => removeStockRow(item.id)}>✕</button>
                </div>
              ))}
              <button className="add-row-btn" onClick={addStockRow}>+ Add Item</button>
            </div>
            <div className="modal-actions">
              <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button brand-filled">Send Request</button>
              <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
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
        {stockDraft.map((item) => (
          <div key={item.id} className="stock-row-input">
            <div className="input-main">
              <input 
                className="item-name-input" 
                placeholder="Item Name" 
                value={item.name} 
                onChange={e => updateStockRow(item.id, 'name', e.target.value)} 
              />
              <input 
                className="qty-input" 
                type="number" 
                placeholder="Qty" 
                value={item.qtyRequested} 
                onChange={e => updateStockRow(item.id, 'qtyRequested', e.target.value)} 
              />
            </div>
            <button className="remove-row-btn" onClick={() => removeStockRow(item.id)}>✕</button>
          </div>
        ))}
        <button className="add-row-btn" onClick={addStockRow}>+ Add Item</button>
      </div>
      <div className="modal-actions">
        <button onClick={handleStockSubmit} disabled={submittingStock} className="action-button brand-filled">
          {stockTakeDone ? "Update Request" : "Send Request"}
        </button>
        <button onClick={() => setShowStockModal(false)} className="action-button secondary">Cancel</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}