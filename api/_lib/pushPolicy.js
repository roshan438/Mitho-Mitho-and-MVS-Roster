const DEFAULT_NOTIFICATION_SETTINGS = {
  pushEnabled: true,
  categories: {
    roster: true,
    shiftRequests: true,
    leave: true,
    timesheet: true,
    reminders: true,
    kitchen: true,
    general: true,
  },
};

const KIND_META = {
  "roster-published": { categoryKey: "roster", priority: 3 },
  "shift-added": { categoryKey: "roster", priority: 1 },
  "shift-updated": { categoryKey: "roster", priority: 2 },
  "shift-removed": { categoryKey: "roster", priority: 3 },
  "open-shift": { categoryKey: "shiftRequests", priority: 1 },
  "shift-request": { categoryKey: "shiftRequests", priority: 2 },
  "shift-request-approved": { categoryKey: "shiftRequests", priority: 3 },
  "leave-status": { categoryKey: "leave", priority: 2 },
  "timesheet-status": { categoryKey: "timesheet", priority: 2 },
  "timesheet-approved": { categoryKey: "timesheet", priority: 2 },
  "break-reminder": { categoryKey: "reminders", priority: 3 },
  "break-end-reminder": { categoryKey: "reminders", priority: 3 },
  "kitchen-stocktake": { categoryKey: "kitchen", priority: 1 },
};

function normalizeNotificationSettings(input = {}) {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(input || {}),
    categories: {
      ...DEFAULT_NOTIFICATION_SETTINGS.categories,
      ...(input?.categories || {}),
    },
  };
}

export function getPushMeta(notification = {}) {
  const kind = notification?.metadata?.kind || notification?.data?.metadata?.kind || "";
  const base = KIND_META[kind] || {};
  const fallbackPriority =
    notification?.type === "warning" || notification?.type === "error" ? 2 : 1;

  return {
    kind,
    categoryKey: base.categoryKey || "general",
    priority: base.priority || fallbackPriority,
  };
}

export function shouldDeliverPush(userProfile = {}, notification = {}) {
  const settings = normalizeNotificationSettings(userProfile?.notificationSettings);
  const meta = getPushMeta(notification);

  if (userProfile?.pushNotificationsEnabled === false) return false;
  if (settings.pushEnabled === false) return false;
  if (settings.categories[meta.categoryKey] === false) return false;

  return meta.priority >= 2;
}
