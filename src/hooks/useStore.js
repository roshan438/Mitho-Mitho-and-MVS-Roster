import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export function useStores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const snap = await getDocs(collection(db, "stores"));
        setStores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error fetching stores", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const getStoreLabel = (storeId) => {
    return stores.find((s) => s.id === storeId)?.label || storeId || "-";
  };

  return { stores, getStoreLabel, loading };
}