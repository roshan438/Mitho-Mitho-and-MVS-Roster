const IGNORED_NOTIFICATION_HOURS = 72;

function hmToMinutes(hm) {
  if (!hm) return null;
  const [h, m] = String(hm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function timestampMs(value) {
  if (value?.toDate) return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

export function clampDateRange(filters) {
  const start = new Date(`${filters.dateFrom}T00:00:00`);
  const end = new Date(`${filters.dateTo}T00:00:00`);
  return {
    start,
    end,
  };
}

export function buildUserDirectory(users = []) {
  return users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});
}

export function filterByCommonFields(items = [], filters = {}, userMap = {}) {
  return items.filter((item) => {
    const storeMatch = filters.storeId === "all" || item.storeId === filters.storeId;
    const statusMatch = filters.status === "all" || String(item.status || "").toLowerCase() === filters.status;
    const actorUid = item.uid || item.requestorUid || item.claimantUid || "";
    const staffMatch = filters.staffUid === "all" || actorUid === filters.staffUid;
    const department = String(item.department || userMap[actorUid]?.department || "").toLowerCase();
    const departmentMatch = filters.department === "all" || department === filters.department;
    return storeMatch && statusMatch && staffMatch && departmentMatch;
  });
}

export function calculateLaborCost(timesheets = [], usersByUid = {}, getStoreLabel) {
  const perDay = new Map();
  const perStore = new Map();
  let totalCost = 0;
  let totalHours = 0;

  timesheets.forEach((timesheet) => {
    const start = hmToMinutes(timesheet.startInput);
    const end = hmToMinutes(timesheet.endInput);
    if (start == null || end == null) return;

    let worked = end - start;
    if (worked < 0) worked += 1440;

    const breakStart = hmToMinutes(timesheet.breakStartInput);
    const breakEnd = hmToMinutes(timesheet.breakEndInput);
    if (breakStart != null && breakEnd != null) {
      let breakWorked = breakEnd - breakStart;
      if (breakWorked < 0) breakWorked += 1440;
      worked -= breakWorked;
    }

    const hours = Math.max(0, worked) / 60;
    const hourlyRate = Number(usersByUid[timesheet.uid]?.hourlyRate || 0);
    const amount = Number((hours * hourlyRate).toFixed(2));
    totalCost += amount;
    totalHours += hours;

    perDay.set(timesheet.date, (perDay.get(timesheet.date) || 0) + amount);
    const storeKey = getStoreLabel(timesheet.storeId);
    perStore.set(storeKey, (perStore.get(storeKey) || 0) + amount);
  });

  return {
    totalCost,
    totalHours,
    byDay: [...perDay.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)),
    byStore: [...perStore.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
  };
}

export function calculateAttendanceTrends(shifts = [], timesheets = []) {
  const timesheetByKey = timesheets.reduce((acc, item) => {
    acc[`${item.uid}_${item.date}`] = item;
    return acc;
  }, {});

  let absent = 0;
  let late = 0;
  let onTime = 0;

  shifts.forEach((shift) => {
    const timesheet = timesheetByKey[`${shift.uid}_${shift.date}`];
    if (!timesheet?.startActual?.toDate) {
      absent += 1;
      return;
    }

    const planned = hmToMinutes(shift.startPlanned);
    if (planned == null) return;

    const actualDate = timesheet.startActual.toDate();
    const actual = actualDate.getHours() * 60 + actualDate.getMinutes();

    if (actual - planned > 5) late += 1;
    else onTime += 1;
  });

  return {
    absent,
    late,
    onTime,
    total: shifts.length,
  };
}

export function calculateLeaveTrends(leaveRequests = []) {
  const byType = new Map();
  const byStatus = new Map();

  leaveRequests.forEach((request) => {
    byType.set(request.type || "other", (byType.get(request.type || "other") || 0) + 1);
    byStatus.set(request.status || "pending", (byStatus.get(request.status || "pending") || 0) + 1);
  });

  return {
    total: leaveRequests.length,
    byType: [...byType.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    byStatus: [...byStatus.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
  };
}

export function calculateShiftPatterns(shiftRequests = []) {
  const byStatus = new Map();
  let claimed = 0;
  let approved = 0;

  shiftRequests.forEach((request) => {
    byStatus.set(request.status || "pending", (byStatus.get(request.status || "pending") || 0) + 1);
    if (request.claimantUid) claimed += 1;
    if (request.status === "approved") approved += 1;
  });

  return {
    total: shiftRequests.length,
    claimed,
    approved,
    byStatus: [...byStatus.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
  };
}

export function calculateNotificationEffectiveness(notifications = []) {
  const now = Date.now();
  let opened = 0;
  let acted = 0;
  let ignored = 0;

  notifications.forEach((notification) => {
    if (notification.actedAt) acted += 1;
    if (notification.read) opened += 1;

    const ageHours = (now - timestampMs(notification.createdAt)) / (1000 * 60 * 60);
    if (!notification.read && ageHours >= IGNORED_NOTIFICATION_HOURS) ignored += 1;
  });

  return {
    total: notifications.length,
    opened,
    acted,
    ignored,
  };
}

export function money(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}
