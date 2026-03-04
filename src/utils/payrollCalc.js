// src/utils/payrollCalc.js

// Convert "HH:MM" to minutes since 00:00
export function hmToMinutes(hm) {
    if (!hm || typeof hm !== "string") return null;
    const [h, m] = hm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }
  
  // Calculate hours from timesheet data (uses inputs as fallback)
  // Break is optional. If no break, breakMinutes = 0.
  export function calcHoursFromTimesheet(ts) {
    const startMin = hmToMinutes(ts?.startInput);
    const endMin = hmToMinutes(ts?.endInput);
  
    // If missing end, can't compute final hours
    if (startMin == null || endMin == null) return null;
  
    let total = endMin - startMin;
    if (total < 0) total += 24 * 60; // handle crossing midnight (rare)
  
    const bStart = hmToMinutes(ts?.breakStartInput);
    const bEnd = hmToMinutes(ts?.breakEndInput);
  
    let breakMin = 0;
    if (bStart != null && bEnd != null) {
      breakMin = bEnd - bStart;
      if (breakMin < 0) breakMin += 24 * 60;
    }
  
    const workMin = Math.max(0, total - breakMin);
    const hours = workMin / 60;
  
    // round to 2 decimals
    return Math.round(hours * 100) / 100;
  }
  
  // Week helpers (Mon–Sun)
  export function toYMD(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  
  export function getWeekStartMon(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diff = (day === 0 ? -6 : 1) - day; // move to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  
  export function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  
  // Payday: next Thursday AFTER the week ends (Mon–Sun)
  // Week ends Sunday => next Thursday is +4 days from Sunday
  export function getPaydayForWeek(weekStartYMD) {
    const weekStart = new Date(weekStartYMD + "T00:00:00");
    const weekEnd = addDays(weekStart, 6); // Sunday
    const payday = addDays(weekEnd, 4); // Thursday after week end
    return toYMD(payday);
  }