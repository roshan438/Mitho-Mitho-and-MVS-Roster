// import React, { useEffect, useState } from "react";
// import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// // import { STORES } from "../../utils/constants";

// import { useStores } from "../../hooks/useStore";
// import { toYMD } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable"; // ✅ Import autoTable directly
// import "./StockManager.css";
// import { Link, useNavigate } from "react-router-dom";

// export default function StockManager() {
//   const { showToast } = useToast();

//   const { stores, getStoreLabel } = useStores();

//   const [loading, setLoading] = useState(true);
//   const [stockRecords, setStockRecords] = useState([]);
//   const [filterDate, setFilterDate] = useState(toYMD(new Date()));
//   const [filterStore, setFilterStore] = useState("all");
//   const navigate = useNavigate();

//   useEffect(() => {
//     loadStockRecords();
//   }, [filterDate, filterStore]);

//   async function loadStockRecords() {
//     setLoading(true);
//     try {
//       let q = query(collection(db, "dailyStockTake"), where("date", "==", filterDate));
//       const snap = await getDocs(q);
//       let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

//       if (filterStore !== "all") {
//         records = records.filter(r => r.storeId === filterStore);
//       }
//       setStockRecords(records);
//     } catch (e) {
//       showToast("Error loading records", "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   const updateItemQtySent = (recordId, itemIndex, val) => {
//     // We use functional state update to ensure React registers the change
//     setStockRecords(prev => prev.map(record => {
//       if (record.id !== recordId) return record;
//       const newItems = [...record.items];
//       newItems[itemIndex] = { ...newItems[itemIndex], qtySent: val };
//       return { ...record, items: newItems };
//     }));
//   };

//   const markAsDone = async (record) => {
//     try {
//       const docRef = doc(db, "dailyStockTake", record.id);
      
//       // Calculate new statuses based on the currently edited qtySent
//       const updatedItems = record.items.map(it => ({
//         ...it,
//         status: Number(it.qtySent) >= Number(it.qtyRequested) ? "fulfilled" : "partial"
//       }));

//       await updateDoc(docRef, {
//         items: updatedItems,
//         adminProcessed: true,
//         processedAt: serverTimestamp()
//       });

//       showToast(`Stock updated for ${getStoreLabel(record.storeId)}`, "success");
//       loadStockRecords(); // Refresh data
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to update database", "error");
//     }
//   };

//   const downloadPDF = (record) => {
//     try {
//       const doc = new jsPDF();
//       doc.setFontSize(18);
//       doc.text("Stock Dispatch Manifest", 14, 15);
      
//       doc.setFontSize(10);
//       doc.setTextColor(100);
//       doc.text(`Store: ${getStoreLabel(record.storeId)}`, 14, 22);
//       doc.text(`Date: ${record.date}`, 14, 27);
//       doc.text(`Dispatcher: Admin`, 14, 32);

//       const tableRows = record.items.map(it => [
//         it.name,
//         it.qtyRequested,
//         it.qtySent,
//         it.status.toUpperCase()
//       ]);

//       // ✅ Use the imported autoTable function directly
//       autoTable(doc, {
//         head: [['Item Name', 'Requested', 'Sent', 'Status']],
//         body: tableRows,
//         startY: 40,
//         theme: 'grid',
//         headStyles: { fillColor: [246, 166, 0] }, // Matching your brand color
//         styles: { fontSize: 9 }
//       });

//       doc.save(`Dispatch_${getStoreLabel(record.storeId)}_${record.date}.pdf`);
//     } catch (err) {
//       console.error("PDF Error:", err);
//       showToast("Could not generate PDF", "error");
//     }
//   };

//   return (
//     <div className="stock-admin-wrapper">
//       <header className="stock-admin-header">
//         <div className="title-block">
//         <button className="back-btn" onClick={() => navigate("/admin/dashboard")}>
//             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                 <path d="M19 12H5M12 19l-7-7 7-7"/>
//             </svg>
//             Go Back To DashBoard
//             </button>


            
//             <h1>Stock Management</h1>
//             <p>Fulfill and dispatch store inventory requests</p>
//         </div>
//         <div className="admin-filters-bar">
//           <input type="date" className="filter-input" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
//           <select className="filter-select" value={filterStore} onChange={e => setFilterStore(e.target.value)}>
//             <option value="all">All Stores</option>
//             {stores.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
//           </select>
//         </div>
//       </header>

//       {loading ? (
//         <div className="admin-loader">Loading inventory requests...</div>
//       ) : (
//         <div className="stock-grid">
//           {stockRecords.length === 0 ? (
//             <div className="empty-stock-state">No stock requests found for this selection.</div>
//           ) : (
//             stockRecords.map(record => (
//               <div key={record.id} className={`admin-stock-card ${record.adminProcessed ? 'processed' : 'pending'}`}>
//                 <div className="card-header">
//                   <div className="shop-info">
//                     <span className="shop-badge">SHOP</span>
//                     <h3>{getStoreLabel(record.storeId)}</h3>
//                   </div>
//                   <button onClick={() => downloadPDF(record)} className="btn-pdf">
//                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
//                     PDF
//                   </button>
//                 </div>

//                 <div className="staff-meta">
//                   Requested by: <strong>{record.lastUpdatedByName}</strong>
//                 </div>
                
//                 <div className="table-scroll">
//                     <table className="stock-fulfillment-table">
//                     <thead>
//                         <tr>
//                         <th>Item Description</th>
//                         <th>Req</th>
//                         <th>Sending</th>
//                         <th>State</th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {record.items.map((item, idx) => (
//                         <tr key={idx}>
//                             <td className="item-name">{item.name}</td>
//                             <td className="qty-req">{item.qtyRequested}</td>
//                             <td>
//                             <input 
//                                 type="number" 
//                                 className="qty-edit-input"
//                                 value={item.qtySent} 
//                                 onChange={e => updateItemQtySent(record.id, idx, e.target.value)}
//                             />
//                             </td>
//                             <td className="status-col">
//                                 {Number(item.qtySent) >= Number(item.qtyRequested) ? '✅' : '📦'}
//                             </td>
//                         </tr>
//                         ))}
//                     </tbody>
//                     </table>
//                 </div>

//                 <button 
//                   className={`btn-dispatch ${record.adminProcessed ? 'secondary' : 'primary'}`} 
//                   onClick={() => markAsDone(record)}
//                 >
//                   {record.adminProcessed ? "Update Dispatch" : "Confirm & Save Dispatch"}
//                 </button>
//               </div>
//             ))
//           )}
//         </div>
//       )}
//     </div>
//   );
// }



































// import React, { useEffect, useState } from "react";
// import {
//   collection,
//   getDocs,
//   query,
//   where,
//   doc,
//   updateDoc,
//   serverTimestamp,
//   deleteDoc,
// } from "firebase/firestore";
// import { db } from "../../firebase/firebase";
// import { useStores } from "../../hooks/useStore";
// import { toYMD } from "../../utils/dates";
// import { useToast } from "../../context/ToastContext";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";
// import "./StockManager.css";
// import { useNavigate } from "react-router-dom";

// export default function StockManager() {
//   const { showToast } = useToast();
//   const { stores, getStoreLabel } = useStores();
//   const navigate = useNavigate();

//   const [loading, setLoading] = useState(true);
//   const [stockRecords, setStockRecords] = useState([]);
//   const [filterDate, setFilterDate] = useState(toYMD(new Date()));
//   const [filterStore, setFilterStore] = useState("all");

//   useEffect(() => {
//     loadStockRecords();
//   }, [filterDate, filterStore]);

//   async function loadStockRecords() {
//     setLoading(true);
//     try {
//       let q = query(collection(db, "dailyStockTake"), where("date", "==", filterDate));
//       const snap = await getDocs(q);
//       let records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

//       if (filterStore !== "all") {
//         records = records.filter((r) => r.storeId === filterStore);
//       }

//       setStockRecords(records);
//     } catch (e) {
//       showToast("Error loading records", "error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   function updateItemField(recordId, itemIndex, field, value) {
//     setStockRecords((prev) =>
//       prev.map((record) => {
//         if (record.id !== recordId) return record;
//         const newItems = [...(record.items || [])];
//         newItems[itemIndex] = {
//           ...newItems[itemIndex],
//           [field]: value,
//         };
//         return { ...record, items: newItems };
//       })
//     );
//   }

//   function addNewItem(recordId) {
//     setStockRecords((prev) =>
//       prev.map((record) => {
//         if (record.id !== recordId) return record;
//         return {
//           ...record,
//           items: [
//             ...(record.items || []),
//             {
//               name: "",
//               qtyRequested: 1,
//               qtySent: 0,
//               status: "pending",
//             },
//           ],
//         };
//       })
//     );
//   }

//   async function deleteItemFromRecord(record, itemIndex) {
//     const confirmDelete = window.confirm("Delete this item?");
//     if (!confirmDelete) return;

//     try {
//       const updatedItems = (record.items || []).filter((_, idx) => idx !== itemIndex);

//       if (updatedItems.length === 0) {
//         showToast("Cannot delete last item. Delete whole record instead.", "warning");
//         return;
//       }

//       await updateDoc(doc(db, "dailyStockTake", record.id), {
//         items: updatedItems,
//         updatedAt: serverTimestamp(),
//       });

//       showToast("Item deleted", "success");
//       loadStockRecords();
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to delete item", "error");
//     }
//   }

//   async function deleteEntireRecord(record) {
//     const confirmDelete = window.confirm(
//       `Delete entire stock request for ${getStoreLabel(record.storeId)}?`
//     );
//     if (!confirmDelete) return;

//     try {
//       await deleteDoc(doc(db, "dailyStockTake", record.id));
//       showToast("Stock record deleted", "success");
//       loadStockRecords();
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to delete record", "error");
//     }
//   }

//   async function markAsDone(record) {
//     try {
//       const docRef = doc(db, "dailyStockTake", record.id);

//       const cleanedItems = (record.items || [])
//         .map((it) => ({
//           ...it,
//           name: String(it.name || "").trim(),
//           qtyRequested: Number(it.qtyRequested || 0),
//           qtySent: Number(it.qtySent || 0),
//         }))
//         .filter((it) => it.name && it.qtyRequested > 0);

//       if (cleanedItems.length === 0) {
//         showToast("Add at least one valid item before saving", "error");
//         return;
//       }

//       const updatedItems = cleanedItems.map((it) => ({
//         ...it,
//         status: Number(it.qtySent) >= Number(it.qtyRequested) ? "fulfilled" : "partial",
//       }));

//       await updateDoc(docRef, {
//         items: updatedItems,
//         adminProcessed: true,
//         processedAt: serverTimestamp(),
//         updatedAt: serverTimestamp(),
//       });

//       showToast(`Stock updated for ${getStoreLabel(record.storeId)}`, "success");
//       loadStockRecords();
//     } catch (e) {
//       console.error(e);
//       showToast("Failed to update database", "error");
//     }
//   }

//   const downloadPDF = (record) => {
//     try {
//       const pdf = new jsPDF();
//       pdf.setFontSize(18);
//       pdf.text("Stock Dispatch Manifest", 14, 15);

//       pdf.setFontSize(10);
//       pdf.setTextColor(100);
//       pdf.text(`Store: ${getStoreLabel(record.storeId)}`, 14, 22);
//       pdf.text(`Date: ${record.date}`, 14, 27);
//       pdf.text(`Dispatcher: Admin`, 14, 32);

//       const tableRows = (record.items || []).map((it) => [
//         it.name,
//         it.qtyRequested,
//         it.qtySent,
//         String(it.status || "").toUpperCase(),
//       ]);

//       autoTable(pdf, {
//         head: [["Item Name", "Requested", "Sent", "Status"]],
//         body: tableRows,
//         startY: 40,
//         theme: "grid",
//         headStyles: { fillColor: [246, 166, 0] },
//         styles: { fontSize: 9 },
//       });

//       pdf.save(`Dispatch_${getStoreLabel(record.storeId)}_${record.date}.pdf`);
//     } catch (err) {
//       console.error("PDF Error:", err);
//       showToast("Could not generate PDF", "error");
//     }
//   };

//   return (
//     <div className="stock-admin-wrapper">
//       <header className="stock-admin-header">
//         <div className="title-block">
//           <button className="back-btn" onClick={() => navigate("/admin/dashboard")}>
//             <svg
//               width="20"
//               height="20"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2.5"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <path d="M19 12H5M12 19l-7-7 7-7" />
//             </svg>
//             Go Back To DashBoard
//           </button>

//           <h1>Stock Management</h1>
//           <p>Fulfill and dispatch store inventory requests</p>
//         </div>

//         <div className="admin-filters-bar">
//           <input
//             type="date"
//             className="filter-input"
//             value={filterDate}
//             onChange={(e) => setFilterDate(e.target.value)}
//           />

//           <select
//             className="filter-select"
//             value={filterStore}
//             onChange={(e) => setFilterStore(e.target.value)}
//           >
//             <option value="all">All Stores</option>
//             {stores.map((s) => (
//               <option key={s.id} value={s.id}>
//                 {s.label}
//               </option>
//             ))}
//           </select>
//         </div>
//       </header>

//       {loading ? (
//         <div className="admin-loader">Loading inventory requests...</div>
//       ) : (
//         <div className="stock-grid">
//           {stockRecords.length === 0 ? (
//             <div className="empty-stock-state">No stock requests found for this selection.</div>
//           ) : (
//             stockRecords.map((record) => (
//               <div
//                 key={record.id}
//                 className={`admin-stock-card ${record.adminProcessed ? "processed" : "pending"}`}
//               >
//                 <div className="card-header">
//                   <div className="shop-info">
//                     <span className="shop-badge">SHOP</span>
//                     <h3>{getStoreLabel(record.storeId)}</h3>
//                   </div>

//                   <div className="card-actions">
//                     <button onClick={() => downloadPDF(record)} className="btn-pdf">
//                       <svg
//                         width="14"
//                         height="14"
//                         viewBox="0 0 24 24"
//                         fill="none"
//                         stroke="currentColor"
//                         strokeWidth="2"
//                       >
//                         <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
//                       </svg>
//                       PDF
//                     </button>

//                     <button
//                       onClick={() => deleteEntireRecord(record)}
//                       className="btn-delete-record"
//                     >
//                       Delete All
//                     </button>
//                   </div>
//                 </div>

//                 <div className="staff-meta">
//                   Requested by: <strong>{record.lastUpdatedByName}</strong>
//                 </div>

//                 <div className="table-scroll">
//                   <table className="stock-fulfillment-table">
//                     <thead>
//                       <tr>
//                         <th>Item Description</th>
//                         <th>Req</th>
//                         <th>Sending</th>
//                         <th>State</th>
//                         <th>Delete</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {(record.items || []).map((item, idx) => (
//                         <tr key={idx}>
//                           {/* <td className="item-name">
//                             <input
//                               type="text"
//                               className="item-edit-input"
//                               value={item.name || ""}
//                               onChange={(e) =>
//                                 updateItemField(record.id, idx, "name", e.target.value)
//                               }
//                               placeholder="Item name"
//                             />
//                           </td> */}


//                             <td className="item-name">{item.name}</td>

//                           <td className="qty-req">
//                             <input
//                               type="number"
//                               className="qty-edit-input"
//                               value={item.qtyRequested ?? ""}
//                               onChange={(e) =>
//                                 updateItemField(record.id, idx, "qtyRequested", e.target.value)
//                               }
//                             />
//                           </td>

//                           <td>
//                             <input
//                               type="number"
//                               className="qty-edit-input"
//                               value={item.qtySent ?? ""}
//                               onChange={(e) =>
//                                 updateItemField(record.id, idx, "qtySent", e.target.value)
//                               }
//                             />
//                           </td>

//                           <td className="status-col">
//                             {Number(item.qtySent) >= Number(item.qtyRequested) ? "✅" : "📦"}
//                           </td>

//                           <td>
//                             <button
//                               className="btn-delete"
//                               onClick={() => deleteItemFromRecord(record, idx)}
//                             >
//                               ✕
//                             </button>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>

//                 <div className="stock-card-footer">
//                   <button className="btn-add-item" onClick={() => addNewItem(record.id)}>
//                     Add Item
//                   </button>

//                   <button
//                     className={`btn-dispatch ${record.adminProcessed ? "secondary" : "primary"}`}
//                     onClick={() => markAsDone(record)}
//                   >
//                     {record.adminProcessed ? "Update Dispatch" : "Confirm & Save Dispatch"}
//                   </button>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       )}
//     </div>
//   );
// }


















import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./StockManager.css";
import { useNavigate } from "react-router-dom";

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
      throw new Error(`Item name cannot contain numbers (line ${i + 1})`);
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

export default function StockManager() {
  const { showToast } = useToast();
  const { stores, getStoreLabel } = useStores();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stockRecords, setStockRecords] = useState([]);
  const [filterDate, setFilterDate] = useState(toYMD(new Date()));
  const [filterStore, setFilterStore] = useState("all");

  const [showStockModal, setShowStockModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [stockBulkText, setStockBulkText] = useState("");
  const [submittingStock, setSubmittingStock] = useState(false);

  useEffect(() => {
    loadStockRecords();
  }, [filterDate, filterStore]);

  async function loadStockRecords() {
    setLoading(true);
    try {
      let q = query(collection(db, "dailyStockTake"), where("date", "==", filterDate));
      const snap = await getDocs(q);
      let records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (filterStore !== "all") {
        records = records.filter((r) => r.storeId === filterStore);
      }

      setStockRecords(records);
    } catch (e) {
      showToast("Error loading records", "error");
    } finally {
      setLoading(false);
    }
  }

  const updateItemQtySent = (recordId, itemIndex, val) => {
    setStockRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) return record;
        const newItems = [...(record.items || [])];
        newItems[itemIndex] = {
          ...newItems[itemIndex],
          qtySent: val,
        };
        return { ...record, items: newItems };
      })
    );
  };

  const deleteItemFromRecord = async (record, itemIndex) => {
    const confirmDelete = window.confirm("Delete this item?");
    if (!confirmDelete) return;

    try {
      const updatedItems = (record.items || []).filter((_, idx) => idx !== itemIndex);

      if (updatedItems.length === 0) {
        showToast("Cannot delete last item. Delete whole record instead.", "warning");
        return;
      }

      await updateDoc(doc(db, "dailyStockTake", record.id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });

      showToast("Item deleted", "success");
      loadStockRecords();
    } catch (e) {
      console.error(e);
      showToast("Failed to delete item", "error");
    }
  };

  const deleteEntireRecord = async (record) => {
    const confirmDelete = window.confirm(
      `Delete entire stock request for ${getStoreLabel(record.storeId)}?`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "dailyStockTake", record.id));
      showToast("Stock record deleted", "success");
      loadStockRecords();
    } catch (e) {
      console.error(e);
      showToast("Failed to delete record", "error");
    }
  };

  const markAsDone = async (record) => {
    try {
      const docRef = doc(db, "dailyStockTake", record.id);

      const updatedItems = (record.items || []).map((it) => ({
        ...it,
        qtyRequested: Number(it.qtyRequested || 0),
        qtySent: Number(it.qtySent || 0),
        status:
          Number(it.qtySent) >= Number(it.qtyRequested) ? "fulfilled" : "partial",
      }));

      await updateDoc(docRef, {
        items: updatedItems,
        adminProcessed: true,
        processedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast(`Stock updated for ${getStoreLabel(record.storeId)}`, "success");
      loadStockRecords();
    } catch (e) {
      console.error(e);
      showToast("Failed to update database", "error");
    }
  };

  const openStockEditModal = (record) => {
    setEditingRecord(record);

    const existingItems = record.items || [];
    const bulkText = existingItems
      .map((item) => {
        const qty = Number(item.qtyRequested || 1);
        return qty === 1 ? `${item.name}` : `${item.name} ${qty}`;
      })
      .join("\n");

    setStockBulkText(bulkText);
    setShowStockModal(true);
  };

  const handleAdminStockSave = async () => {
    if (!editingRecord) return;

    try {
      const parsedItems = parseStockBulkText(stockBulkText);

      if (parsedItems.length === 0) {
        showToast("Please enter at least one item", "error");
        return;
      }

      setSubmittingStock(true);

      const oldItems = editingRecord.items || [];

      const mergedItems = parsedItems.map((newItem) => {
        const oldMatch = oldItems.find(
          (oldItem) =>
            String(oldItem.name).trim().toLowerCase() ===
            String(newItem.name).trim().toLowerCase()
        );

        return {
          ...newItem,
          qtySent: oldMatch?.qtySent || 0,
          status: oldMatch?.status || "pending",
        };
      });

      await updateDoc(doc(db, "dailyStockTake", editingRecord.id), {
        items: mergedItems,
        lastUpdatedByName: "Admin",
        updatedAt: serverTimestamp(),
      });

      showToast("Stock request updated", "success");
      setShowStockModal(false);
      setEditingRecord(null);
      setStockBulkText("");
      loadStockRecords();
    } catch (err) {
      showToast(err.message || "Failed to update stock", "error");
    } finally {
      setSubmittingStock(false);
    }
  };

  const downloadPDF = (record) => {
    try {
      const pdf = new jsPDF();
      pdf.setFontSize(18);
      pdf.text("Stock Dispatch Manifest", 14, 15);

      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Store: ${getStoreLabel(record.storeId)}`, 14, 22);
      pdf.text(`Date: ${record.date}`, 14, 27);
      pdf.text(`Dispatcher: Admin`, 14, 32);

      const tableRows = (record.items || []).map((it) => [
        it.name,
        it.qtyRequested,
        it.qtySent,
        String(it.status || "").toUpperCase(),
      ]);

      autoTable(pdf, {
        head: [["Item Name", "Requested", "Sent", "Status"]],
        body: tableRows,
        startY: 40,
        theme: "grid",
        headStyles: { fillColor: [246, 166, 0] },
        styles: { fontSize: 9 },
      });

      pdf.save(`Dispatch_${getStoreLabel(record.storeId)}_${record.date}.pdf`);
    } catch (err) {
      console.error("PDF Error:", err);
      showToast("Could not generate PDF", "error");
    }
  };

  return (
    <div className="stock-admin-wrapper">
      <header className="stock-admin-header">
        <div className="title-block">
          <button className="back-btn" onClick={() => navigate("/admin/dashboard")}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Go Back To DashBoard
          </button>

          <h1>Stock Management</h1>
          <p>Fulfill and dispatch store inventory requests</p>
        </div>

        <div className="admin-filters-bar">
          <input
            type="date"
            className="filter-input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />

          <select
            className="filter-select"
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
          >
            <option value="all">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="admin-loader">Loading inventory requests...</div>
      ) : (
        <div className="stock-grid">
          {stockRecords.length === 0 ? (
            <div className="empty-stock-state">No stock requests found for this selection.</div>
          ) : (
            stockRecords.map((record) => (
              <div
                key={record.id}
                className={`admin-stock-card ${record.adminProcessed ? "processed" : "pending"}`}
              >
                <div className="card-header">
                  <div className="shop-info">
                    <span className="shop-badge">SHOP</span>
                    <h3>{getStoreLabel(record.storeId)}</h3>
                  </div>

                  <div className="card-actions">

                  <button onClick={() => downloadPDF(record)} className="btn-pdf">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      PDF
                    </button>

                    <div className="edit-delete-btn">
                      <button
                        onClick={() => openStockEditModal(record)}
                        className="btn-add"
                      >
                        Edit
                      </button>

                      

                      <button
                        onClick={() => deleteEntireRecord(record)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="staff-meta">
                  Requested by: <strong>{record.lastUpdatedByName}</strong>
                </div>

                <div className="table-scroll">
                  <table className="stock-fulfillment-table">
                    <thead>
                      <tr>
                        <th>Item Description</th>
                        <th>Req</th>
                        <th>Sending</th>
                        <th>State</th>
                        <th>Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(record.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="item-name">{item.name}</td>
                          <td className="qty-req">{item.qtyRequested}</td>
                          <td>
                            <input
                              type="number"
                              className="qty-edit-input"
                              value={item.qtySent ?? ""}
                              onChange={(e) =>
                                updateItemQtySent(record.id, idx, e.target.value)
                              }
                            />
                          </td>
                          <td className="status-col">
                            {Number(item.qtySent) >= Number(item.qtyRequested) ? "✅" : "📦"}
                          </td>
                          <td>
                            <button
                              className="btn-delete-item"
                              onClick={() => deleteItemFromRecord(record, idx)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  className={`btn-dispatch ${record.adminProcessed ? "secondary" : "primary"}`}
                  onClick={() => markAsDone(record)}
                >
                  {record.adminProcessed ? "Update Dispatch" : "Confirm & Save Dispatch"}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {showStockModal && (
        <div className="modal-overlay">
          <div className="stock-modal">
            <div className="modal-header add-item-dash">
              <h3>Edit Stock Items</h3>
              <p className="small-note-sub">
                One item per line. Add quantity at end if needed.
              </p>
            </div>

            <div className="stock-list-container">
              <textarea
                className="stock-bulk-textarea"
                placeholder={`Milk 2\nOnion 5\nEgg`}
                value={stockBulkText}
                onChange={(e) => setStockBulkText(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                onClick={handleAdminStockSave}
                disabled={submittingStock}
                className="action-button brand-filled"
              >
                {submittingStock ? "Saving..." : "Save Items"}
              </button>

              <button
                onClick={() => {
                  setShowStockModal(false);
                  setEditingRecord(null);
                  setStockBulkText("");
                }}
                className="action-button secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}