import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { useStores } from "../../hooks/useStore";
import { toYMD } from "../../utils/dates";
import { useToast } from "../../context/ToastContext";
import "./StockManager.css";

function parseStockBulkText(text) {
  if (!text?.trim()) return [];

  const lines = text.split("\n");
  const parsed = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    let qty = 1;
    const nameParts = [...parts];
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

const DEFAULT_ITEM_FORM = {
  id: "",
  name: "",
  code: "",
  location: "",
  shelf: "",
  category: "",
  parLevel: "",
  storeId: "",
  department: "kitchen",
  active: true,
};

export default function StockManager() {
  const { showToast } = useToast();
  const { stores, getStoreLabel } = useStores();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("dispatch");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stockRecords, setStockRecords] = useState([]);
  const [kitchenItems, setKitchenItems] = useState([]);
  const [kitchenSessions, setKitchenSessions] = useState([]);
  const [lowStockEntries, setLowStockEntries] = useState([]);
  const [filterDate, setFilterDate] = useState(toYMD(new Date()));
  const [filterStore, setFilterStore] = useState("all");

  const [showStockModal, setShowStockModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [stockBulkText, setStockBulkText] = useState("");
  const [submittingStock, setSubmittingStock] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState(DEFAULT_ITEM_FORM);
  const [qrPreview, setQrPreview] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [reportDetails, setReportDetails] = useState(null);
  const [expandedDispatchId, setExpandedDispatchId] = useState(null);
  const dispatchCardRefs = useRef({});

  const filteredKitchenItems = useMemo(() => {
    return kitchenItems.filter((item) => filterStore === "all" || item.storeId === filterStore);
  }, [filterStore, kitchenItems]);

  const reportRows = useMemo(() => {
    return kitchenSessions.map((session) => {
      const completedCount = Number(session.completedCount || 0);
      const itemCount = Number(session.itemCount || 0);
      const progress = itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0;

      return {
        ...session,
        completedCount,
        itemCount,
        progress,
        lowStockCount: Number(session.lowStockCount || 0),
        reopenedCount: Number(session.reopenedCount || 0),
      };
    });
  }, [kitchenSessions]);

  const stockSummary = useMemo(() => {
    const pendingDispatch = stockRecords.filter((record) => !record.adminProcessed).length;
    const processedDispatch = stockRecords.filter((record) => record.adminProcessed).length;
    const dispatchItems = stockRecords.reduce(
      (total, record) => total + (record.items || []).length,
      0
    );

    return {
      pendingDispatch,
      processedDispatch,
      dispatchItems,
      kitchenItems: filteredKitchenItems.length,
      sessions: kitchenSessions.length,
      lowStock: lowStockEntries.length,
    };
  }, [filteredKitchenItems.length, kitchenSessions.length, lowStockEntries.length, stockRecords]);

  const loadDispatchRecords = useCallback(async () => {
    let recordsQuery = query(collection(db, "dailyStockTake"), where("date", "==", filterDate));
    const snap = await getDocs(recordsQuery);
    let records = snap.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));

    if (filterStore !== "all") {
      records = records.filter((record) => record.storeId === filterStore);
    }

    setStockRecords(records);
  }, [filterDate, filterStore]);

  const loadKitchenInventory = useCallback(async () => {
    const snap = await getDocs(collection(db, "inventoryItems"));
    const items = snap.docs
      .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }))
      .filter((item) => String(item.department || "").toLowerCase() === "kitchen")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    setKitchenItems(items);
  }, []);

  const loadKitchenReports = useCallback(async () => {
    const sessionSnap = await getDocs(
      query(
        collection(db, "stockTakeSessions"),
        where("date", "==", filterDate),
        where("department", "==", "kitchen"),
        orderBy("updatedAt", "desc")
      )
    );

    let sessions = sessionSnap.docs.map((sessionDoc) => ({ id: sessionDoc.id, ...sessionDoc.data() }));
    if (filterStore !== "all") {
      sessions = sessions.filter((session) => session.storeId === filterStore);
    }
    setKitchenSessions(sessions);

    const lowEntrySnaps = await Promise.all(
      sessions.map((session) =>
        getDocs(
          query(
            collection(db, "stockTakeSessions", session.id, "entries"),
            where("lowStock", "==", true),
            orderBy("updatedAt", "desc")
          )
        )
      )
    );

    const lowEntries = lowEntrySnaps
      .flatMap((snap, index) =>
        snap.docs.map((entryDoc) => ({
          id: entryDoc.id,
          sessionId: sessions[index]?.id || "",
          ...entryDoc.data(),
        }))
      )
      .sort((a, b) => {
        const aTime = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
        const bTime = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

    setLowStockEntries(lowEntries);
  }, [filterDate, filterStore]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [dispatchResult, inventoryResult, reportsResult] = await Promise.allSettled([
        loadDispatchRecords(),
        loadKitchenInventory(),
        loadKitchenReports(),
      ]);

      const failures = [
        ["dispatch records", dispatchResult],
        ["kitchen inventory", inventoryResult],
        ["kitchen reports", reportsResult],
      ].filter(([, result]) => result.status === "rejected");

      if (failures.length > 0) {
        failures.forEach(([label, result]) => {
          console.error(`Stock manager ${label} load failed`, result.reason);
        });
        throw failures[0][1].reason;
      }
    } catch (error) {
      console.error("Stock manager load failed", error);
      showToast("We could not load stock management data right now.", "error");
    } finally {
      setLoading(false);
    }
  }, [loadDispatchRecords, loadKitchenInventory, loadKitchenReports, showToast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (activeTab !== "dispatch") return;
    if (stockRecords.length === 0) {
      setExpandedDispatchId(null);
      return;
    }

    const currentExists = stockRecords.some((record) => record.id === expandedDispatchId);
    if (currentExists) return;

    const nextDefault =
      stockRecords.find((record) => !record.adminProcessed)?.id || stockRecords[0]?.id || null;
    setExpandedDispatchId(nextDefault);
  }, [activeTab, expandedDispatchId, stockRecords]);

  useEffect(() => {
    if (!expandedDispatchId) return;

    const target = dispatchCardRefs.current[expandedDispatchId];
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 128;
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth",
    });
  }, [expandedDispatchId]);

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
    const confirmDelete = window.confirm("Delete this item from the request?");
    if (!confirmDelete) return;

    try {
      const updatedItems = (record.items || []).filter((_, idx) => idx !== itemIndex);
      if (updatedItems.length === 0) {
        showToast("Delete the whole request instead if there are no items left.", "warning");
        return;
      }

      await updateDoc(doc(db, "dailyStockTake", record.id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });

      showToast("Item removed from the stock request.", "success");
      loadDispatchRecords();
    } catch (error) {
      console.error(error);
      showToast("We could not delete that item.", "error");
    }
  };

  const deleteEntireRecord = async (record) => {
    const confirmDelete = window.confirm(
      `Delete the stock request for ${getStoreLabel(record.storeId)}?`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "dailyStockTake", record.id));
      showToast("Stock request deleted.", "success");
      loadDispatchRecords();
    } catch (error) {
      console.error(error);
      showToast("We could not delete that stock request.", "error");
    }
  };

  const markAsDone = async (record) => {
    try {
      const updatedItems = (record.items || []).map((item) => ({
        ...item,
        qtyRequested: Number(item.qtyRequested || 0),
        qtySent: Number(item.qtySent || 0),
        status:
          Number(item.qtySent) >= Number(item.qtyRequested) ? "fulfilled" : "partial",
      }));

      await updateDoc(doc(db, "dailyStockTake", record.id), {
        items: updatedItems,
        adminProcessed: true,
        processedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast(`Dispatch saved for ${getStoreLabel(record.storeId)}.`, "success");
      loadDispatchRecords();
    } catch (error) {
      console.error(error);
      showToast("We could not save that dispatch update.", "error");
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
        showToast("Please enter at least one item.", "error");
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

      showToast("Stock request updated.", "success");
      setShowStockModal(false);
      setEditingRecord(null);
      setStockBulkText("");
      loadDispatchRecords();
    } catch (error) {
      showToast(error.message || "We could not update the stock request.", "error");
    } finally {
      setSubmittingStock(false);
    }
  };

  const downloadPDF = async (record) => {
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const pdf = new jsPDF();
      pdf.setFontSize(18);
      pdf.text("Stock Dispatch Manifest", 14, 15);

      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Store: ${getStoreLabel(record.storeId)}`, 14, 22);
      pdf.text(`Date: ${record.date}`, 14, 27);
      pdf.text(`Dispatcher: Admin`, 14, 32);

      const tableRows = (record.items || []).map((item) => [
        item.name,
        item.qtyRequested,
        item.qtySent,
        String(item.status || "").toUpperCase(),
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
    } catch (error) {
      console.error("PDF Error", error);
      showToast("The dispatch PDF could not be generated.", "error");
    }
  };

  const openItemModal = (item = null) => {
    setItemForm(
      item
        ? {
            id: item.id,
            name: item.name || "",
            code: item.code || "",
            location: item.location || "",
            shelf: item.shelf || "",
            category: item.category || "",
            parLevel: item.parLevel || "",
            storeId: item.storeId || "",
            department: "kitchen",
            active: item.active !== false,
          }
        : {
            ...DEFAULT_ITEM_FORM,
            storeId: filterStore !== "all" ? filterStore : stores[0]?.id || "",
          }
    );
    setShowItemModal(true);
  };

  const saveKitchenItem = async () => {
    if (!itemForm.name.trim()) {
      showToast("Item name is required.", "warning");
      return;
    }
    if (!itemForm.storeId) {
      showToast("Pick a store for this kitchen item.", "warning");
      return;
    }

    setSaving(true);
    try {
      const itemRef = itemForm.id
        ? doc(db, "inventoryItems", itemForm.id)
        : doc(collection(db, "inventoryItems"));

      const itemId = itemRef.id;
      const payload = {
        name: itemForm.name.trim(),
        code: itemForm.code.trim() || itemId.slice(0, 8).toUpperCase(),
        location: itemForm.location.trim(),
        shelf: itemForm.shelf.trim(),
        category: itemForm.category.trim(),
        parLevel: itemForm.parLevel.trim(),
        storeId: itemForm.storeId,
        department: "kitchen",
        active: Boolean(itemForm.active),
        qrValue: `KQS:${itemId}`,
        updatedAt: serverTimestamp(),
      };

      if (!itemForm.id) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(
        itemRef,
        payload,
        { merge: true }
      );

      showToast("Kitchen inventory item saved.", "success");
      setShowItemModal(false);
      setItemForm(DEFAULT_ITEM_FORM);
      loadKitchenInventory();
    } catch (error) {
      console.error("Kitchen item save failed", error);
      showToast("We could not save that kitchen inventory item.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteKitchenItem = async (item) => {
    const confirmDelete = window.confirm(`Delete kitchen item "${item.name}"?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "inventoryItems", item.id));
      showToast("Kitchen inventory item deleted.", "success");
      loadKitchenInventory();
    } catch (error) {
      console.error("Kitchen item delete failed", error);
      showToast("We could not delete that kitchen item.", "error");
    }
  };

  const openQrPreview = async (item) => {
    try {
      const qrValue = item.qrValue || `KQS:${item.id}`;
      const qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 280,
        margin: 2,
        color: {
          dark: "#111111",
          light: "#fffaf0",
        },
      });

      setQrPreview({
        itemId: item.id,
        name: item.name,
        storeLabel: getStoreLabel(item.storeId),
        location: item.location || item.shelf || "Unsorted",
        code: item.code || "-",
        qrValue,
        qrDataUrl,
      });
    } catch (error) {
      console.error("Kitchen QR preview failed", error);
      showToast("We could not generate that QR label.", "error");
    }
  };

  const printQrPreview = () => {
    if (!qrPreview?.qrDataUrl) return;

    const popup = window.open("", "_blank", "width=420,height=620");
    if (!popup) {
      showToast("Please allow popups to print the QR label.", "warning");
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>${qrPreview.name} QR Label</title>
          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #fffaf0;
              color: #111;
            }
            .label {
              border: 2px solid #111;
              border-radius: 18px;
              padding: 18px;
              text-align: center;
            }
            img {
              width: 220px;
              height: 220px;
              object-fit: contain;
              margin: 12px auto;
              display: block;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 24px;
            }
            p {
              margin: 6px 0;
              font-size: 15px;
            }
            code {
              display: inline-block;
              margin-top: 6px;
              padding: 6px 10px;
              border-radius: 999px;
              background: #f4ead2;
              font-size: 14px;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <h1>${qrPreview.name}</h1>
            <p>${qrPreview.storeLabel}</p>
            <p>${qrPreview.location}</p>
            <p>Code: ${qrPreview.code}</p>
            <img src="${qrPreview.qrDataUrl}" alt="Kitchen shelf QR" />
            <code>${qrPreview.qrValue}</code>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="stock-admin-wrapper">
      <header className="stock-admin-header">
        <div className="title-block">
          <button className="back-btn" onClick={() => navigate("/admin/dashboard")} type="button">
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
            Go Back To Dashboard
          </button>

          <h1>Stock Management</h1>
          <p>Dispatch shop requests, manage kitchen items, and monitor stock take sessions.</p>
        </div>

        <div className="admin-filters-bar">
          <input
            type="date"
            className="filter-input"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
          />

          <select
            className="filter-select"
            value={filterStore}
            onChange={(event) => setFilterStore(event.target.value)}
          >
            <option value="all">All Stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.label}
              </option>
            ))}
          </select>

          <button className="btn-pdf" onClick={loadAllData} type="button">
            Refresh
          </button>
        </div>
      </header>

      <section className="stock-summary-strip">
        <article className="stock-summary-tile">
          <span>Pending</span>
          <strong>{stockSummary.pendingDispatch}</strong>
        </article>
        <article className="stock-summary-tile">
          <span>Done</span>
          <strong>{stockSummary.processedDispatch}</strong>
        </article>
        <article className="stock-summary-tile">
          <span>Items</span>
          <strong>{stockSummary.dispatchItems}</strong>
        </article>
        <article className="stock-summary-tile">
          <span>Kitchen</span>
          <strong>{stockSummary.kitchenItems}</strong>
        </article>
      </section>

      <div className="stock-tab-bar">
        <button
          type="button"
          className={`stock-tab ${activeTab === "dispatch" ? "active" : ""}`}
          onClick={() => setActiveTab("dispatch")}
        >
          Dispatch
        </button>
        <button
          type="button"
          className={`stock-tab ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          Kitchen Items
        </button>
        <button
          type="button"
          className={`stock-tab ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          Kitchen Reports
        </button>
      </div>

      {loading ? (
        <div className="admin-loader">Loading stock management...</div>
      ) : (
        <>
          {activeTab === "dispatch" && (
            <div className="stock-grid">
              {stockRecords.length === 0 ? (
                <div className="empty-stock-state">No stock requests found for this selection.</div>
              ) : (
                stockRecords.map((record) => (
                  <div
                    key={record.id}
                    className={`admin-stock-card ${record.adminProcessed ? "processed" : "pending"}`}
                    ref={(node) => {
                      if (node) {
                        dispatchCardRefs.current[record.id] = node;
                      } else {
                        delete dispatchCardRefs.current[record.id];
                      }
                    }}
                  >
                    <button
                      className="dispatch-summary-header"
                      type="button"
                      onClick={() =>
                        setExpandedDispatchId((prev) => (prev === record.id ? null : record.id))
                      }
                    >
                      <div className="shop-info">
                        <span className="shop-badge">SHOP</span>
                        <h3>{getStoreLabel(record.storeId)}</h3>
                        <div className="stock-card-meta-line">
                          <span>{(record.items || []).length} items</span>
                          <span>{record.adminProcessed ? "Processed" : "Needs dispatch"}</span>
                          <span>{record.lastUpdatedByName || "Unknown"}</span>
                        </div>
                      </div>

                      <div className="dispatch-summary-side">
                        <span className={`dispatch-state-pill ${record.adminProcessed ? "done" : "pending"}`}>
                          {record.adminProcessed ? "Done" : "Pending"}
                        </span>
                        <span className="dispatch-expand-indicator">
                          {expandedDispatchId === record.id ? "Hide" : "Open"}
                        </span>
                      </div>
                    </button>

                    {expandedDispatchId === record.id && (
                      <>
                        <div className="card-actions compact-actions action-row">
                          <button onClick={() => downloadPDF(record)} className="btn-pdf" type="button">
                          PDF
                          </button>

                          <div className="edit-delete-btn">
                            <button onClick={() => openStockEditModal(record)} className="btn-add" type="button">
                              Edit
                            </button>

                            <button onClick={() => deleteEntireRecord(record)} className="btn-delete" type="button">
                              Delete
                            </button>
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
                                <tr key={`${record.id}_${item.name}_${idx}`}>
                                  <td className="item-name">{item.name}</td>
                                  <td className="qty-req">{item.qtyRequested}</td>
                                  <td>
                                    <input
                                      type="number"
                                      className="qty-edit-input"
                                      value={item.qtySent ?? ""}
                                      onChange={(event) =>
                                        updateItemQtySent(record.id, idx, event.target.value)
                                      }
                                    />
                                  </td>
                                  <td className="status-col">
                                    {Number(item.qtySent) >= Number(item.qtyRequested) ? "Done" : "Pending"}
                                  </td>
                                  <td>
                                    <button
                                      className="btn-delete-item"
                                      onClick={() => deleteItemFromRecord(record, idx)}
                                      type="button"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="stock-mobile-list">
                          {(record.items || []).map((item, idx) => (
                            <div key={`${record.id}_mobile_${item.name}_${idx}`} className="stock-mobile-row">
                              <div className="stock-mobile-main">
                                <strong>{item.name}</strong>
                                <span>{Number(item.qtySent) >= Number(item.qtyRequested) ? "Done" : "Pending"}</span>
                              </div>
                              <div className="stock-mobile-meta">
                                <span className="stock-mobile-req">Req {item.qtyRequested}</span>
                                <input
                                  type="number"
                                  className="qty-edit-input"
                                  value={item.qtySent ?? ""}
                                  onChange={(event) =>
                                    updateItemQtySent(record.id, idx, event.target.value)
                                  }
                                />
                                <button
                                  className="btn-delete-item"
                                  onClick={() => deleteItemFromRecord(record, idx)}
                                  type="button"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          className={`btn-dispatch ${record.adminProcessed ? "secondary" : "primary"}`}
                          onClick={() => markAsDone(record)}
                          type="button"
                        >
                          {record.adminProcessed ? "Update Dispatch" : "Confirm & Save Dispatch"}
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "inventory" && (
            <div className="inventory-panel">
              <div className="inventory-panel-header">
                <div>
                  <h2>Kitchen inventory items</h2>
                  <p>
                    These are the fast-count items shown to kitchen staff. Each item automatically gets a QR value like <code>KQS:itemId</code>.
                  </p>
                </div>
                <div className="inventory-panel-actions">
                  <button className="btn-add" onClick={() => openItemModal()} type="button">
                    Add kitchen item
                  </button>
                  <button className="btn-pdf" onClick={() => navigate("/admin/store-settings")} type="button">
                    Store Rules
                  </button>
                </div>
              </div>

              <div className="inventory-card-grid">
                {filteredKitchenItems.map((item) => (
                  <article key={item.id} className={`inventory-card ${item.active === false ? "is-muted" : ""}`}>
                    <div className="inventory-card-top">
                      <button
                        className="inventory-name-button"
                        onClick={() => setItemDetails(item)}
                        type="button"
                      >
                        <h3>{item.name}</h3>
                      </button>
                      <span className="shop-badge">{item.active === false ? "Inactive" : "Active"}</span>
                    </div>
                    <div className="inventory-actions compact-inventory-actions">
                      <button className="btn-pdf" onClick={() => openQrPreview(item)} type="button">
                        View QR
                      </button>
                      <button className="btn-add" onClick={() => openItemModal(item)} type="button">
                        Edit
                      </button>
                      <button className="btn-delete" onClick={() => deleteKitchenItem(item)} type="button">
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {filteredKitchenItems.length === 0 && (
                  <div className="empty-stock-state">
                    No kitchen inventory items found for this filter yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="reports-layout">
              <section className="report-panel">
                <div className="panel-heading">
                  <h2>Completed and active sessions</h2>
                  <p>Basic reporting for kitchen stock take completion, progress, and reopen tracking.</p>
                </div>
                <div className="report-card-list">
                  {reportRows.length === 0 ? (
                    <div className="empty-stock-state">No kitchen stock take sessions for this date.</div>
                  ) : (
                    reportRows.map((session) => (
                      <article key={session.id} className="report-row-card">
                        <div className="report-row-main">
                          <strong>{session.userName || "Kitchen Staff"}</strong>
                          <span>{getStoreLabel(session.storeId)}</span>
                        </div>
                        <div className="report-row-metrics">
                          <span>{session.completedCount}/{session.itemCount || 0}</span>
                          <span>{session.lowStockCount} low</span>
                          <span>{session.progress}%</span>
                        </div>
                        <span className={`shop-badge ${session.status === "completed" ? "success-badge" : ""}`}>
                          {session.status === "completed" ? "Done" : "Live"}
                        </span>
                        <button
                          className="report-open-btn"
                          onClick={() => setReportDetails(session)}
                          type="button"
                        >
                          Open
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="report-panel">
                <div className="panel-heading">
                  <h2>Low-stock items</h2>
                  <p>Items marked low, out, or custom below the low-stock threshold.</p>
                </div>
                <div className="report-card-list">
                  {lowStockEntries.length === 0 ? (
                    <div className="empty-stock-state">No low-stock items recorded for this date.</div>
                  ) : (
                    lowStockEntries.map((entry) => (
                      <article key={`${entry.sessionId}_${entry.itemId}`} className="report-row-card low-stock-row">
                        <div className="report-row-main">
                          <strong>{entry.itemName}</strong>
                          <span>{getStoreLabel(entry.storeId)} • {entry.enteredByName || "Kitchen Staff"}</span>
                        </div>
                        <div className="report-row-metrics">
                          <span>{entry.location || entry.shelf || "-"}</span>
                          <span>{entry.customValue ? `${entry.customValue}%` : "-"}</span>
                        </div>
                        <span className="shop-badge low-badge">
                          {String(entry.status || "").toUpperCase()}
                        </span>
                        <button
                          className="report-open-btn"
                          onClick={() =>
                            setItemDetails({
                              name: entry.itemName,
                              code: entry.itemCode || "-",
                              location: entry.location || "-",
                              shelf: entry.shelf || "-",
                              category: "Low-stock record",
                              parLevel: entry.customValue || "-",
                              storeId: entry.storeId,
                              active: true,
                            })
                          }
                          type="button"
                        >
                          Open
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {showStockModal && (
        <div className="modal-overlay">
          <div className="stock-modal">
            <div className="modal-header add-item-dash">
              <h3>Edit Stock Items</h3>
              <p className="small-note-sub">One item per line. Add quantity at end if needed.</p>
            </div>

            <div className="stock-list-container">
              <textarea
                className="stock-bulk-textarea"
                placeholder={`Milk 2\nOnion 5\nEgg`}
                value={stockBulkText}
                onChange={(event) => setStockBulkText(event.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                onClick={handleAdminStockSave}
                disabled={submittingStock}
                className="action-button brand-filled"
                type="button"
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
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="modal-overlay">
          <div className="stock-modal">
            <div className="modal-header add-item-dash">
              <h3>{itemForm.id ? "Edit kitchen item" : "Add kitchen item"}</h3>
              <p className="small-note-sub">These items power the quick mobile kitchen stock take.</p>
            </div>

            <div className="inventory-form-grid">
              <input
                className="filter-input light"
                placeholder="Item name"
                value={itemForm.name}
                onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <input
                className="filter-input light"
                placeholder="Code"
                value={itemForm.code}
                onChange={(event) => setItemForm((prev) => ({ ...prev, code: event.target.value }))}
              />
              <input
                className="filter-input light"
                placeholder="Location"
                value={itemForm.location}
                onChange={(event) => setItemForm((prev) => ({ ...prev, location: event.target.value }))}
              />
              <input
                className="filter-input light"
                placeholder="Shelf"
                value={itemForm.shelf}
                onChange={(event) => setItemForm((prev) => ({ ...prev, shelf: event.target.value }))}
              />
              <input
                className="filter-input light"
                placeholder="Category"
                value={itemForm.category}
                onChange={(event) => setItemForm((prev) => ({ ...prev, category: event.target.value }))}
              />
              <input
                className="filter-input light"
                placeholder="Par level"
                value={itemForm.parLevel}
                onChange={(event) => setItemForm((prev) => ({ ...prev, parLevel: event.target.value }))}
              />
              <select
                className="filter-select light"
                value={itemForm.storeId}
                onChange={(event) => setItemForm((prev) => ({ ...prev, storeId: event.target.value }))}
              >
                <option value="">Select store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.label}
                  </option>
                ))}
              </select>
              <select
                className="filter-select light"
                value={itemForm.active ? "active" : "inactive"}
                onChange={(event) =>
                  setItemForm((prev) => ({ ...prev, active: event.target.value === "active" }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <p className="small-note-sub">
              QR value: <code>{itemForm.id ? `KQS:${itemForm.id}` : "Generated when saved"}</code>
            </p>

            <div className="modal-actions">
              <button className="action-button brand-filled" onClick={saveKitchenItem} disabled={saving} type="button">
                {saving ? "Saving..." : "Save Kitchen Item"}
              </button>
              <button
                className="action-button secondary"
                onClick={() => {
                  setShowItemModal(false);
                  setItemForm(DEFAULT_ITEM_FORM);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {qrPreview && (
        <div className="modal-overlay" onClick={() => setQrPreview(null)}>
          <div className="stock-modal qr-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{qrPreview.name}</h3>
                <p className="small-note-sub">{qrPreview.storeLabel} • {qrPreview.location}</p>
              </div>
              <button
                className="btn-delete-item qr-close-btn"
                onClick={() => setQrPreview(null)}
                type="button"
                aria-label="Close QR preview"
              >
                ×
              </button>
            </div>

            <div className="qr-preview-card">
              <img src={qrPreview.qrDataUrl} alt={`${qrPreview.name} QR code`} className="qr-preview-image" />
              <div className="qr-preview-meta">
                <strong>{qrPreview.code}</strong>
                <code>{qrPreview.qrValue}</code>
              </div>
            </div>

            <div className="modal-actions">
              <button className="action-button brand-filled" onClick={printQrPreview} type="button">
                Print Label
              </button>
              <button className="action-button secondary" onClick={() => setQrPreview(null)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {itemDetails && (
        <div className="modal-overlay" onClick={() => setItemDetails(null)}>
          <div className="stock-modal item-details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{itemDetails.name}</h3>
                <p className="small-note-sub">{getStoreLabel(itemDetails.storeId)}</p>
              </div>
              <button
                className="btn-delete-item qr-close-btn"
                onClick={() => setItemDetails(null)}
                type="button"
                aria-label="Close item details"
              >
                ×
              </button>
            </div>

            <div className="inventory-details-grid">
              <span><strong>Code</strong><em>{itemDetails.code || "-"}</em></span>
              <span><strong>QR</strong><code>{itemDetails.qrValue || `KQS:${itemDetails.id}`}</code></span>
              <span><strong>Location</strong><em>{itemDetails.location || itemDetails.shelf || "-"}</em></span>
              <span><strong>Shelf</strong><em>{itemDetails.shelf || "-"}</em></span>
              <span><strong>Category</strong><em>{itemDetails.category || "-"}</em></span>
              <span><strong>Par</strong><em>{itemDetails.parLevel || "-"}</em></span>
              <span><strong>Status</strong><em>{itemDetails.active === false ? "Inactive" : "Active"}</em></span>
            </div>

            <div className="modal-actions">
              <button className="action-button brand-filled" onClick={() => openQrPreview(itemDetails)} type="button">
                View QR
              </button>
              <button className="action-button secondary" onClick={() => setItemDetails(null)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {reportDetails && (
        <div className="modal-overlay" onClick={() => setReportDetails(null)}>
          <div className="stock-modal item-details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{reportDetails.userName || "Kitchen Staff"}</h3>
              <button className="btn-pdf qr-close-btn" onClick={() => setReportDetails(null)} type="button">
                ×
              </button>
            </div>
            <div className="inventory-details-grid">
              <span>
                <strong>Store</strong>
                <em>{getStoreLabel(reportDetails.storeId)}</em>
              </span>
              <span>
                <strong>Status</strong>
                <em>{reportDetails.status === "completed" ? "Completed" : "In progress"}</em>
              </span>
              <span>
                <strong>Items</strong>
                <em>{reportDetails.completedCount || 0}/{reportDetails.itemCount || 0}</em>
              </span>
              <span>
                <strong>Low Stock</strong>
                <em>{reportDetails.lowStockCount || 0}</em>
              </span>
              <span>
                <strong>Shift</strong>
                <em>{reportDetails.shiftStart || "-"} to {reportDetails.shiftEnd || "-"}</em>
              </span>
              <span>
                <strong>Reopened</strong>
                <em>{reportDetails.reopenedCount || 0}</em>
              </span>
              <span>
                <strong>Date</strong>
                <em>{reportDetails.date || "-"}</em>
              </span>
              <span>
                <strong>Session</strong>
                <code>{reportDetails.id}</code>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
