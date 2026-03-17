import { useNavigate } from "react-router-dom";
import { useNotificationsCenter } from "../../notifications/NotificationsProvider.jsx";
import "./NotificationsCenter.css";

function formatRelativeDate(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsCenter() {
  const navigate = useNavigate();
  const { items, unreadCount, markRead, markAllRead } = useNotificationsCenter();

  async function handleOpen(item) {
    await markRead(item.id);
    if (item.link) navigate(item.link);
  }

  return (
    <div className="mobile-app-wrapper notifications-page">
      <header className="app-header notifications-header">
        <div className="header-text">
          <h1 className="main-title">Notifications</h1>
          <span className="subtitle">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}` : "All caught up"}
          </span>
        </div>
        <button
          className="pill-btn notifications-mark-all"
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
        >
          Mark all
        </button>
      </header>

      <main className="scroll-content">
        {items.length === 0 ? (
          <section className="notifications-empty">
            <h2>No notifications</h2>
            <p>Shift changes, leave decisions, and approval updates will appear here.</p>
          </section>
        ) : (
          <section className="notifications-list">
            {items.map((item) => (
              <article
                key={item.id}
                className={`notification-center-card ${item.type || "info"} ${item.read ? "is-read" : "is-unread"}`}
              >
                <div className="notification-center-main">
                  <div className="notification-center-topline">
                    <strong>{item.title || "Update"}</strong>
                    <span>{formatRelativeDate(item.createdAt)}</span>
                  </div>
                  <p>{item.message}</p>
                </div>

                <div className="notification-center-actions">
                  <button
                    type="button"
                    className="pill-btn"
                    onClick={() => markRead(item.id)}
                  >
                    Done
                  </button>
                  {item.link ? (
                    <button
                      type="button"
                      className="pill-btn active"
                      onClick={() => handleOpen(item)}
                    >
                      Open
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
