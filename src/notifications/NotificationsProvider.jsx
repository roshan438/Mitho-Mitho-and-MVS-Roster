import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

async function maybeRequestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  if (!isStandalone()) return;

  try {
    await Notification.requestPermission();
  } catch (error) {
    console.error("Notification permission request failed:", error);
  }
}

const NotificationsCenterContext = createContext(null);

export default function NotificationsProvider({ children }) {
  const { fbUser } = useAuth();
  const seenIdsRef = useRef(new Set());
  const [items, setItems] = useState([]);

  useEffect(() => {
    maybeRequestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!fbUser?.uid) return undefined;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("uid", "==", fbUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const liveItems = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setItems(liveItems);

      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const item = { id: change.doc.id, ...change.doc.data() };
        if (seenIdsRef.current.has(item.id)) return;
        seenIdsRef.current.add(item.id);

        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification(item.title || "Roster update", {
            body: item.message || "Open the app to see the latest update.",
            icon: "/icon-app.svg",
            badge: "/icon-app.svg",
            tag: item.id,
            data: { link: item.link || "/" },
          });

          notification.onclick = () => {
            window.focus();
            if (item.link) window.location.assign(item.link);
            notification.close();
          };
        }
      });
    });

    return () => unsubscribe();
  }, [fbUser?.uid]);

  const markRead = useCallback(async (id) => {
    if (!id) return;
    await updateDoc(doc(db, "notifications", id), { read: true });
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = items.filter((item) => !item.read);
    await Promise.all(
      unread.map((item) => updateDoc(doc(db, "notifications", item.id), { read: true }))
    );
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      unreadCount: items.filter((item) => !item.read).length,
      markRead,
      markAllRead,
    }),
    [items, markAllRead, markRead]
  );

  return (
    <NotificationsCenterContext.Provider value={value}>
      {children}
    </NotificationsCenterContext.Provider>
  );
}

export function useNotificationsCenter() {
  const ctx = useContext(NotificationsCenterContext);
  if (!ctx) {
    throw new Error("useNotificationsCenter must be used inside NotificationsProvider");
  }
  return ctx;
}
