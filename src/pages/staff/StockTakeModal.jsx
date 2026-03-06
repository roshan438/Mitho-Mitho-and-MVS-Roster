import React, { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";

export default function StockTakeModal({ storeId, date, uid, profile, onComplete, onClose }) {
  const [items, setItems] = useState([{ name: "", qty: "" }]);
  const [loading, setLoading] = useState(false);

  const addItem = () => setItems([...items, { name: "", qty: "" }]);
  
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.some(i => !i.name || !i.qty)) return alert("Please fill all fields");

    setLoading(true);
    try {
      const stockId = `${storeId}_${date}`;
      await setDoc(doc(db, "dailyStockTake", stockId), {
        storeId,
        date,
        submittedBy: uid,
        staffName: `${profile?.firstName || ""} ${profile?.lastName || ""}`,
        items,
        timestamp: serverTimestamp(),
      });
      alert("Stock take submitted successfully!");
      onComplete();
    } catch (error) {
      console.error(error);
      alert("Submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal stock-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Daily Stock Take</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-content">
          <p className="hint-text">List items that need ordering for this store.</p>
          
          {items.map((item, idx) => (
            <div key={idx} className="stock-input-row">
              <input 
                placeholder="Item name" 
                value={item.name} 
                onChange={(e) => updateItem(idx, "name", e.target.value)} 
              />
              <input 
                type="number" 
                placeholder="Qty" 
                className="qty-input"
                value={item.qty} 
                onChange={(e) => updateItem(idx, "qty", e.target.value)} 
              />
            </div>
          ))}

          <button type="button" className="text-btn" onClick={addItem}>+ Add Another Item</button>
          
          <div className="modal-footer" style={{marginTop: '20px'}}>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? "Submitting..." : "Submit Stock Take"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}