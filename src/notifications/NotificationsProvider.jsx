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
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import {
  normalizeNotification,
  shouldKeepNotification,
  shouldShowBrowserNotification,
  sortNotificationsByCreatedAtDesc,
} from "../utils/notificationItems";
import {
  isInQuietHours,
  normalizeNotificationSettings,
} from "../utils/notificationSettings";

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
  const { fbUser, profile } = useAuth();
  const seenIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const [items, setItems] = useState([]);
  const notificationSettings = useMemo(
    () => normalizeNotificationSettings(profile?.notificationSettings),
    [profile?.notificationSettings]
  );

  useEffect(() => {
    maybeRequestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!fbUser?.uid) {
      initializedRef.current = false;
      seenIdsRef.current = new Set();
      setItems([]);
      return undefined;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("uid", "==", fbUser.uid),
      orderBy("createdAt", "desc"),
      limit(60)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const liveItems = sortNotificationsByCreatedAtDesc(
        snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter(shouldKeepNotification)
          .map(normalizeNotification)
          .filter((item) => notificationSettings.categories[item.categoryKey] !== false)
      );
      setItems(liveItems);

      if (!initializedRef.current) {
        snapshot.docs.forEach((docSnap) => seenIdsRef.current.add(docSnap.id));
        initializedRef.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        const item = normalizeNotification({ id: change.doc.id, ...change.doc.data() });
        if (seenIdsRef.current.has(item.id)) return;
        seenIdsRef.current.add(item.id);
        if (notificationSettings.categories[item.categoryKey] === false) return;
        if (!notificationSettings.browserEnabled) return;
        if (isInQuietHours(notificationSettings)) return;
        if (!shouldShowBrowserNotification(item)) return;

        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification(item.title || "Roster update", {
            body: item.message || "Open the app to see the latest update.",
            icon: "/icon-app.svg",
            badge: "/icon-app.svg",
            tag: item.metadata?.kind || item.id,
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
  }, [fbUser?.uid, notificationSettings]);

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

  const archiveItem = useCallback(async (id) => {
    if (!id) return;
    await updateDoc(doc(db, "notifications", id), {
      read: true,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const markActed = useCallback(async (id) => {
    if (!id) return;
    await updateDoc(doc(db, "notifications", id), {
      read: true,
      actedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const priorityCount = useMemo(
    () => items.filter((item) => item.isUnread && item.isHighPriority).length,
    [items]
  );
  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items]
  );
  const badgeCount = notificationSettings.badgeMode === "priority" ? priorityCount : unreadCount;

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      priorityCount,
      badgeCount,
      notificationSettings,
      markRead,
      markAllRead,
      archiveItem,
      markActed,
    }),
    [archiveItem, badgeCount, items, markActed, markAllRead, markRead, notificationSettings, priorityCount, unreadCount]
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
