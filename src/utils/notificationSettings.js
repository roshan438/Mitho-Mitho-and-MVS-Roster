export const DEFAULT_NOTIFICATION_SETTINGS = {
  browserEnabled: true,
  pushEnabled: true,
  badgeMode: "priority",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
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

function mergeCategorySettings(input = {}) {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS.categories,
    ...(input || {}),
  };
}

export function normalizeNotificationSettings(input = {}) {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(input || {}),
    categories: mergeCategorySettings(input?.categories),
  };
}

function toMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function isInQuietHours(settings, now = new Date()) {
  if (!settings?.quietHoursEnabled) return false;

  const start = toMinutes(settings.quietHoursStart);
  const end = toMinutes(settings.quietHoursEnd);
  if (start == null || end == null) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}
