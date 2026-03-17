import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import "./StaffNotificationsPanel.css";

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => {
    const aMs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bMs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bMs - aMs;
  });
}

function formatRelativeDate(ts) {
  if (!ts?.toDate) return "";
  const date = ts.toDate();
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StaffNotificationsPanel({
  title = "Updates",
  subtitle = "Recent staff updates",
  limit = 4,
  compact = false,
}) {
  const { fbUser } = useAuth();
  const uid = fbUser?.uid;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "notifications"), where("uid", "==", uid)));
      const list = sortByCreatedAtDesc(
        snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      );
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const visibleItems = useMemo(() => items.slice(0, limit), [items, limit]);

  async function markRead(id, link) {
    try {
      await updateDoc(doc(db, "notifications", id), {
        read: true,
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (link) window.location.assign(link);
    } catch {
      // Keep silent in panel interaction.
    }
  }

  if (!uid) return null;

  return (
    <section className={`staff-notifications-panel ${compact ? "compact" : ""}`}>
      <div className="staff-notifications-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {items.length > limit ? (
          <span className="staff-notifications-count">{items.length}</span>
        ) : null}
      </div>

      {loading ? (
        <div className="staff-notifications-empty">Loading updates...</div>
      ) : visibleItems.length === 0 ? (
        <div className="staff-notifications-empty">No new updates.</div>
      ) : (
        <div className="staff-notifications-list">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className={`staff-notification-item ${item.type || "info"}`}
            >
              <div className="staff-notification-main">
                <div className="staff-notification-title-row">
                  <strong>{item.title || "Update"}</strong>
                  <span>{formatRelativeDate(item.createdAt)}</span>
                </div>
                <p>{item.message}</p>
              </div>
              <button
                type="button"
                className="staff-notification-action"
                onClick={() => markRead(item.id, item.link)}
              >
                {item.link ? "Open" : "Done"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
