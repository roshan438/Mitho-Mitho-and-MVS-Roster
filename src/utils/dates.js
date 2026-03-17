function pad(n) {
    return String(n).padStart(2, "0");
  }
  
  export function toYMD(date) {
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    return `${y}-${m}-${d}`;
  }
  export function getWeekStartMonday(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun..6 Sat
    const diff = day === 0 ? -6 : 1 - day; // Sun -> -6
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  
  export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  export function subDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() - days);
    return d;
  }
  
  export function weekDates(weekStartMonday) {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStartMonday, i));
  }
  
  export function prettyDate(date) {
    return date.toLocaleDateString(undefined, { weekday: "short"});
  }


  export function prettyTime(time) {
    if (!time) return "";
  
    let date;
    if (typeof time.toDate === 'function') {
      date = time.toDate();
    } 
    else {
      const [hours, minutes] = String(time).split(':');
      date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
    }
  
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).toLowerCase();
  }
  
  
  