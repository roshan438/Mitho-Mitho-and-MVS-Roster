import { useMemo } from "react";
import { useNotificationsCenter } from "../notifications/NotificationsProvider.jsx";
import "./StaffNotificationsPanel.css";

function NotificationIcon({ icon }) {
  return (
    <span className="staff-notification-glyph" aria-hidden="true">
      {icon === "calendar" && "Cal"}
      {icon === "clock" && "Hrs"}
      {icon === "check" && "OK"}
      {icon === "warning" && "!"}
      {icon === "exchange" && "Swap"}
      {icon === "leave" && "Leave"}
      {icon === "spark" && "New"}
      {(!icon || icon === "bell") && "Alert"}
    </span>
  );
}

export default function StaffNotificationsPanel({
  title = "Updates",
  subtitle = "Recent staff updates",
  limit = 4,
  compact = false,
}) {
  const { items, markRead, markActed } = useNotificationsCenter();

  const visibleItems = useMemo(
    () => items.filter((item) => item.isUnread).slice(0, limit),
    [items, limit]
  );

  async function handleAction(item) {
    if (item.link) await markActed(item.id);
    else await markRead(item.id);
    if (item.link) window.location.assign(item.link);
  }

  return (
    <section className={`staff-notifications-panel ${compact ? "compact" : ""}`}>
      <div className="staff-notifications-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {visibleItems.length > 0 ? (
          <span className="staff-notifications-count">{visibleItems.length}</span>
        ) : null}
      </div>

      {visibleItems.length === 0 ? (
        <div className="staff-notifications-empty">No new updates.</div>
      ) : (
        <div className="staff-notifications-list">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              className={`staff-notification-item ${item.meta.accent}`}
            >
              <div className={`staff-notification-icon ${item.meta.accent}`}>
                <NotificationIcon icon={item.meta.icon} />
              </div>

              <div className="staff-notification-main">
                <div className="staff-notification-title-row">
                  <strong>{item.title || "Update"}</strong>
                  <span>{item.timeLabel}</span>
                </div>
                <div className="staff-notification-meta-row">
                  <span className={`staff-notification-chip ${item.meta.accent}`}>{item.categoryLabel}</span>
                </div>
                <p>{item.message}</p>
              </div>

              <button
                type="button"
                className="staff-notification-action"
                onClick={() => handleAction(item)}
              >
                {item.actionLabel}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
