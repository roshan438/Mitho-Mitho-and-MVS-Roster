const MS_IN_DAY = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 21;

const KIND_META = {
  "roster-published": {
    categoryKey: "roster",
    icon: "calendar",
    label: "Roster",
    accent: "success",
    actionLabel: "View roster",
    priority: 3,
  },
  "shift-added": {
    categoryKey: "roster",
    icon: "spark",
    label: "Roster",
    accent: "info",
    actionLabel: "Check shift",
    priority: 1,
  },
  "shift-updated": {
    categoryKey: "roster",
    icon: "spark",
    label: "Roster",
    accent: "info",
    actionLabel: "Review change",
    priority: 2,
  },
  "shift-removed": {
    categoryKey: "roster",
    icon: "warning",
    label: "Roster",
    accent: "warning",
    actionLabel: "Review roster",
    priority: 3,
  },
  "open-shift": {
    categoryKey: "shiftRequests",
    icon: "exchange",
    label: "Shift Board",
    accent: "info",
    actionLabel: "View roster",
    priority: 1,
  },
  "shift-request": {
    categoryKey: "shiftRequests",
    icon: "exchange",
    label: "Shift Request",
    accent: "warning",
    actionLabel: "Open request",
    priority: 2,
  },
  "shift-request-approved": {
    categoryKey: "shiftRequests",
    icon: "check",
    label: "Shift Request",
    accent: "success",
    actionLabel: "See outcome",
    priority: 3,
  },
  "leave-status": {
    categoryKey: "leave",
    icon: "leave",
    label: "Leave",
    accent: "info",
    actionLabel: "Open leave",
    priority: 2,
  },
  "timesheet-status": {
    categoryKey: "timesheet",
    icon: "clock",
    label: "Timesheet",
    accent: "info",
    actionLabel: "Open timesheet",
    priority: 2,
  },
  "timesheet-approved": {
    categoryKey: "timesheet",
    icon: "clock",
    label: "Timesheet",
    accent: "success",
    actionLabel: "View hours",
    priority: 2,
  },
  "break-reminder": {
    categoryKey: "reminders",
    icon: "warning",
    label: "Reminder",
    accent: "warning",
    actionLabel: "Open app",
    priority: 3,
  },
  "break-end-reminder": {
    categoryKey: "reminders",
    icon: "warning",
    label: "Reminder",
    accent: "warning",
    actionLabel: "Open app",
    priority: 3,
  },
  "kitchen-stocktake": {
    categoryKey: "kitchen",
    icon: "spark",
    label: "Kitchen",
    accent: "info",
    actionLabel: "Review update",
    priority: 1,
  },
};

function getTimestampMs(ts) {
  if (ts?.toDate) return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return 0;
}

export function getNotificationKind(item = {}) {
  return item.metadata?.kind || "";
}

export function getNotificationMeta(item = {}) {
  const kind = getNotificationKind(item);
  const base = KIND_META[kind] || {};

  return {
    kind,
    categoryKey: base.categoryKey || "general",
    icon: base.icon || "bell",
    label: base.label || "Update",
    accent: base.accent || item.type || "info",
    actionLabel: base.actionLabel || (item.link ? "Open" : "Mark read"),
    priority: base.priority || (item.type === "warning" || item.type === "error" ? 2 : 1),
  };
}

export function formatNotificationTime(ts) {
  const ms = getTimestampMs(ts);
  if (!ms) return "";

  const diff = Date.now() - ms;
  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}m ago`;
  if (diff < MS_IN_DAY) return `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))}h ago`;
  if (diff < 2 * MS_IN_DAY) return "Yesterday";

  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getNotificationSectionLabel(ts) {
  const ms = getTimestampMs(ts);
  if (!ms) return "Earlier";

  const diff = Date.now() - ms;
  if (diff < MS_IN_DAY) return "Today";
  if (diff < 2 * MS_IN_DAY) return "Yesterday";
  if (diff < 7 * MS_IN_DAY) return "This week";
  return "Earlier";
}

export function shouldKeepNotification(item = {}) {
  if (!item?.id) return false;
  if (item.archivedAt) return false;
  if (!item.read) return true;

  const createdAtMs = getTimestampMs(item.createdAt);
  const isRecent = createdAtMs && Date.now() - createdAtMs <= RECENT_WINDOW_DAYS * MS_IN_DAY;
  const meta = getNotificationMeta(item);

  return Boolean(isRecent || meta.priority >= 3);
}

export function shouldShowBrowserNotification(item = {}) {
  const meta = getNotificationMeta(item);
  return meta.priority >= 2 && !item.read;
}

export function sortNotificationsByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
}

export function normalizeNotification(item = {}) {
  const meta = getNotificationMeta(item);

  return {
    ...item,
    meta,
    categoryLabel: meta.label,
    categoryKey: meta.categoryKey,
    timeLabel: formatNotificationTime(item.createdAt),
    actionLabel: meta.actionLabel,
    isActionable: Boolean(item.link),
    isUnread: !item.read,
    isHighPriority: meta.priority >= 2,
  };
}

export function groupNotifications(items = []) {
  return items.reduce((groups, item) => {
    const key = getNotificationSectionLabel(item.createdAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}
