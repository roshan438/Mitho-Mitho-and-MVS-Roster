import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { STORES as LEGACY_STORES } from "../utils/constants";

function mergeStores(remoteStores) {
  const merged = new Map();

  LEGACY_STORES.forEach((store) => {
    merged.set(store.id, { ...store });
  });

  remoteStores.forEach((store) => {
    const existing = merged.get(store.id) || {};
    merged.set(store.id, { ...existing, ...store });
  });

  return Array.from(merged.values()).sort((a, b) =>
    String(a.label || a.id).localeCompare(String(b.label || b.id))
  );
}

export function useStores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const snap = await getDocs(collection(db, "stores"));
        const remoteStores = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setStores(mergeStores(remoteStores));
      } catch (e) {
        console.error("Error fetching stores", e);
        setStores(mergeStores([]));
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const getStoreLabel = useCallback((storeId) => {
    return stores.find((s) => s.id === storeId)?.label || storeId || "-";
  }, [stores]);

  return { stores, getStoreLabel, loading };
}
