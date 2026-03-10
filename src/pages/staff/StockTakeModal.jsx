// import React, { useState } from "react";
// import { doc, setDoc, serverTimestamp } from "firebase/firestore";
// import { db } from "../../firebase/firebase";

// export default function StockTakeModal({ storeId, date, uid, profile, onComplete, onClose }) {
//   const [items, setItems] = useState([{ name: "", qty: "" }]);
//   const [loading, setLoading] = useState(false);

//   const addItem = () => setItems([...items, { name: "", qty: "" }]);
  
//   const updateItem = (index, field, value) => {
//     const newItems = [...items];
//     newItems[index][field] = value;
//     setItems(newItems);
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (items.some(i => !i.name || !i.qty)) return alert("Please fill all fields");

//     setLoading(true);
//     try {
//       const stockId = `${storeId}_${date}`;
//       await setDoc(doc(db, "dailyStockTake", stockId), {
//         storeId,
//         date,
//         submittedBy: uid,
//         staffName: `${profile?.firstName || ""} ${profile?.lastName || ""}`,
//         items,
//         timestamp: serverTimestamp(),
//       });
//       alert("Stock take submitted successfully!");
//       onComplete();
//     } catch (error) {
//       console.error(error);
//       alert("Submission failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="modal-overlay" onClick={onClose}>
//       <div className="profile-modal stock-modal-box" onClick={(e) => e.stopPropagation()}>
//         <div className="modal-header">
//           <h2>Daily Stock Take</h2>
//           <button className="close-btn" onClick={onClose}>×</button>
//         </div>
//         <form onSubmit={handleSubmit} className="modal-content">
//           <p className="hint-text">List items that need ordering for this store.</p>
          
//           {items.map((item, idx) => (
//             <div key={idx} className="stock-input-row">
//               <input 
//                 placeholder="Item name" 
//                 value={item.name} 
//                 onChange={(e) => updateItem(idx, "name", e.target.value)} 
//               />
//               <input 
//                 type="number" 
//                 placeholder="Qty" 
//                 className="qty-input"
//                 value={item.qty} 
//                 onChange={(e) => updateItem(idx, "qty", e.target.value)} 
//               />
//             </div>
//           ))}

//           <button type="button" className="text-btn" onClick={addItem}>+ Add Another Item</button>
          
//           <div className="modal-footer" style={{marginTop: '20px'}}>
//             <button type="submit" className="save-btn" disabled={loading}>
//               {loading ? "Submitting..." : "Submit Stock Take"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }












// import React, { useMemo, useState } from "react";
// import { doc, setDoc, serverTimestamp } from "firebase/firestore";
// import { db } from "../../firebase/firebase";

// function parseStockLines(text) {
//   const lines = String(text || "")
//     .split("\n")
//     .map((line) => line.trim())
//     .filter(Boolean);

//   const items = [];

//   for (const line of lines) {
//     // Match: "item name 3" -> name="item name", qty=3
//     const match = line.match(/^(.*?)(?:\s+(\d+))?$/);

//     if (!match) continue;

//     const rawName = (match[1] || "").trim();
//     const rawQty = match[2];

//     if (!rawName) continue;

//     items.push({
//       name: rawName,
//       qty: rawQty ? Number(rawQty) : 1,
//     });
//   }

//   return items;
// }

// export default function StockTakeModal({
//   storeId,
//   date,
//   uid,
//   profile,
//   onComplete,
//   onClose,
// }) {
//   const [rawText, setRawText] = useState("");
//   const [loading, setLoading] = useState(false);

//   const previewItems = useMemo(() => parseStockLines(rawText), [rawText]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     const items = parseStockLines(rawText);

//     if (items.length === 0) {
//       alert("Please enter at least one item");
//       return;
//     }

//     setLoading(true);
//     try {
//       const stockId = `${storeId}_${date}`;

//       await setDoc(doc(db, "dailyStockTake", stockId), {
//         storeId,
//         date,
//         submittedBy: uid,
//         staffName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim(),
//         items,
//         rawText: rawText.trim(),
//         timestamp: serverTimestamp(),
//       });

//       alert("Stock take submitted successfully!");
//       onComplete();
//     } catch (error) {
//       console.error(error);
//       alert("Submission failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="modal-overlay" onClick={onClose}>
//       <div
//         className="profile-modal stock-modal-box"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div className="modal-header">
//           <h2>Daily Stock Take</h2>
//           <button className="close-btn" onClick={onClose}>
//             ×
//           </button>
//         </div>

//         <form onSubmit={handleSubmit} className="modal-content">
//           <p className="hint-text">
//             Enter one item per line. Add quantity at the end if needed.
//           </p>

//           <div className="stock-text-help">
//             Example:
//             <br />
//             Momo wrappers 3
//             <br />
//             Coke cans 2
//             <br />
//             Napkins
//           </div>

//           <textarea
//             className="stock-textarea"
//             placeholder={`Momo wrappers 3\nCoke cans 2\nNapkins`}
//             value={rawText}
//             onChange={(e) => setRawText(e.target.value)}
//             rows={8}
//           />

//           <div className="stock-preview-box">
//             <div className="stock-preview-title">
//               Preview ({previewItems.length})
//             </div>

//             {previewItems.length === 0 ? (
//               <div className="stock-preview-empty">No items yet</div>
//             ) : (
//               <div className="stock-preview-list">
//                 {previewItems.map((item, idx) => (
//                   <div key={`${item.name}-${idx}`} className="stock-preview-row">
//                     <span className="stock-preview-name">{item.name}</span>
//                     <span className="stock-preview-qty">x{item.qty}</span>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           <div className="modal-footer" style={{ marginTop: "20px" }}>
//             <button type="submit" className="save-btn" disabled={loading}>
//               {loading ? "Submitting..." : "Submit Stock Take"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }















