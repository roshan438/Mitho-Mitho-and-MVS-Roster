import { addDays, toYMD } from "./dates";

export const LEAVE_TYPE_OPTIONS = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "unavailable", label: "Unavailable" },
  { value: "personal", label: "Personal Leave" },
];

export function getLeaveTypeLabel(type) {
  return LEAVE_TYPE_OPTIONS.find((option) => option.value === type)?.label || "Leave";
}

export function formatLeaveDateRange(startDate, endDate) {
  if (!startDate) return "-";

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${(endDate || startDate)}T00:00:00`);

  const fmt = (date) =>
    date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  if (startDate === (endDate || startDate)) {
    return fmt(start);
  }

  return `${fmt(start)} - ${fmt(end)}`;
}

export function eachLeaveDay(startDate, endDate) {
  if (!startDate) return [];

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${(endDate || startDate)}T00:00:00`);
  const dates = [];

  for (let current = start; current <= end; current = addDays(current, 1)) {
    dates.push(toYMD(current));
  }

  return dates;
}

export function requestTouchesDate(request, ymd) {
  return eachLeaveDay(request?.startDate, request?.endDate).includes(ymd);
}

export function sortLeaveRequests(requests) {
  return [...requests].sort((a, b) => {
    const aCreated = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bCreated = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;

    if (aCreated !== bCreated) return bCreated - aCreated;
    return String(b.startDate || "").localeCompare(String(a.startDate || ""));
  });
}
