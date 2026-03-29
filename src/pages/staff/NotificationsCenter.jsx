import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationsCenter } from "../../notifications/NotificationsProvider.jsx";
import { groupNotifications } from "../../utils/notificationItems";
import "./NotificationsCenter.css";

const FILTERS = [
  { id: "focused", label: "Focused" },
  { id: "unread", label: "Unread" },
  { id: "all", label: "All" },
];

function NotificationIcon({ icon }) {
  const icons = {
    bell: (
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 10h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.4 2.4 4.6-5.1" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3l9 16H3L12 3z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
    exchange: (
      <>
        <path d="M17 3l4 4-4 4" />
        <path d="M3 7h18" />
        <path d="M7 21l-4-4 4-4" />
        <path d="M21 17H3" />
      </>
    ),
    leave: (
      <>
        <path d="M5 18c5-9 11-11 14-11-1 6-5 12-14 11z" />
        <path d="M9 13c1.5.5 3.5 1.8 5 4" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[icon] || icons.bell}
    </svg>
  );
}

function filterItems(items, mode) {
  if (mode === "unread") return items.filter((item) => item.isUnread);
  if (mode === "focused") return items.filter((item) => item.isUnread || item.isHighPriority);
  return items;
}

export default function NotificationsCenter() {
  const navigate = useNavigate();
  const {
    items,
    unreadCount,
    priorityCount,
    notificationSettings,
    markRead,
    markAllRead,
    archiveItem,
    markActed,
  } = useNotificationsCenter();
  const [filter, setFilter] = useState("focused");

  const filteredItems = useMemo(() => filterItems(items, filter), [filter, items]);
  const groupedItems = useMemo(() => groupNotifications(filteredItems), [filteredItems]);
  const sections = useMemo(
    () => Object.entries(groupedItems).filter(([, group]) => group.length > 0),
    [groupedItems]
  );

  async function handleOpen(item) {
    await markActed(item.id);
    if (item.link) navigate(item.link);
  }

  return (
    <div className="mobile-app-wrapper notifications-page">
      <header className="app-header notifications-header">
        <div className="header-text">
          <h1 className="main-title">Notifications</h1>
          <span className="subtitle">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? "s" : ""}` : "Your inbox is clear"}
          </span>
        </div>
        <button
          className="pill-btn notifications-mark-all"
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
        >
          Mark all read
        </button>
      </header>

      <main className="scroll-content notifications-content">
        <section className="notifications-toolbar">
          <div className="notifications-filter-row">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`pill-btn ${filter === option.id ? "active" : ""}`}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="notifications-summary-card">
            <strong>Operations inbox</strong>
            <p>
              {notificationSettings.badgeMode === "priority"
                ? `${priorityCount} priority alert${priorityCount === 1 ? "" : "s"} are currently driving the bell badge.`
                : `${unreadCount} unread update${unreadCount === 1 ? "" : "s"} are currently counted on the bell badge.`}
            </p>
            <p>
              {notificationSettings.quietHoursEnabled
                ? `Quiet hours are on from ${notificationSettings.quietHoursStart} to ${notificationSettings.quietHoursEnd}.`
                : "Quiet hours are off, so urgent alerts can appear right away."}
            </p>
          </div>
        </section>

        {sections.length === 0 ? (
          <section className="notifications-empty">
            <h2>No notifications</h2>
            <p>Roster changes, leave decisions, and timesheet reviews will show up here when something important happens.</p>
          </section>
        ) : (
          <section className="notifications-groups">
            {sections.map(([section, group]) => (
              <div key={section} className="notifications-group">
                <div className="notifications-group-header">
                  <h2>{section}</h2>
                  <span>{group.length}</span>
                </div>

                <div className="notifications-list">
                  {group.map((item) => (
                    <article
                      key={item.id}
                      className={`notification-center-card ${item.meta.accent} ${item.read ? "is-read" : "is-unread"}`}
                    >
                      <div className={`notification-center-icon ${item.meta.accent}`}>
                        <NotificationIcon icon={item.meta.icon} />
                      </div>

                      <div className="notification-center-main">
                        <div className="notification-center-topline">
                          <div className="notification-center-heading">
                            <strong>{item.title || "Update"}</strong>
                            {!item.read ? <em>New</em> : null}
                          </div>
                          <span>{item.timeLabel}</span>
                        </div>

                        <div className="notification-center-meta">
                          <span className={`notification-category-chip ${item.meta.accent}`}>{item.categoryLabel}</span>
                        </div>

                        <p>{item.message}</p>
                      </div>

                      <div className="notification-center-actions">
                        <button
                          type="button"
                          className="pill-btn"
                          onClick={() => markRead(item.id)}
                        >
                          {item.read ? "Seen" : "Mark read"}
                        </button>
                        <button
                          type="button"
                          className="pill-btn"
                          onClick={() => archiveItem(item.id)}
                        >
                          Archive
                        </button>
                        {item.link ? (
                          <button
                            type="button"
                            className="pill-btn active"
                            onClick={() => handleOpen(item)}
                          >
                            {item.actionLabel}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
