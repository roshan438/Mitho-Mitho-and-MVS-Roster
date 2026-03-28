



























import { useEffect, useMemo, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  addDays,
  subDays,
  getWeekStartMonday,
  prettyDate,
  toYMD,
  weekDates,
} from "../../utils/dates";
import {
  formatLeaveDateRange,
  getLeaveTypeLabel,
  requestTouchesDate,
} from "../../utils/leaveRequests";
import { notifyUsers, pushUsers } from "../../utils/notifications";
import { useToast } from "../../context/ToastContext";
import { useStores } from "../../hooks/useStore";
import ClearableTimeInput from "../../components/ClearableTimeInput";
import "./RosterManager.css";

function addMonthsSafe(date, amount) {
  const d = new Date(date);
  const originalDate = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDate, lastDay));
  return d;
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return 0;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function formatHours(totalMinutes) {
  const hours = totalMinutes / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getDayKeyFromDate(dateObj) {
  return DAY_KEYS[new Date(dateObj).getDay()];
}

function isStaffAvailableOnDate(staff, dateObj) {
  const dayKey = getDayKeyFromDate(dateObj);
  const row = staff?.availability?.[dayKey];
  return !!row?.enabled;
}

function getAvailabilityTextForDate(staff, dateObj) {
  const dayKey = getDayKeyFromDate(dateObj);
  const row = staff?.availability?.[dayKey];

  if (!row?.enabled) return "Unavailable";
  if (row?.start && row?.end) return `${row.start} - ${row.end}`;
  return "Available";
}

export default function RosterManager() {
  const { showToast } = useToast();
  const { stores } = useStores();

  const [viewMode, setViewMode] = useState("W");
  const [weekStart, setWeekStart] = useState(() =>
    toYMD(getWeekStartMonday(addDays(new Date(), 7)))
  );
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));

  const [publishedMap, setPublishedMap] = useState({});
  const [staffApproved, setStaffApproved] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [approvedLeaveRequests, setApprovedLeaveRequests] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("all");
  const [selectedDepartment] = useState("all");
  const [editingShift, setEditingShift] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [clearingWeek, setClearingWeek] = useState(false);

  const todayYmd = toYMD(new Date());

  const referenceDate = useMemo(() => {
    if (viewMode === "D") return new Date(selectedDate + "T00:00:00");
    return new Date(weekStart + "T00:00:00");
  }, [weekStart, selectedDate, viewMode]);

  const days = useMemo(() => {
    if (viewMode === "D") {
      return [new Date(selectedDate + "T00:00:00")];
    }

    if (viewMode === "W") {
      return weekDates(referenceDate);
    }

    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1));
  }, [referenceDate, viewMode, selectedDate]);

  const neededWeekKeys = useMemo(() => {
    const keys = new Set();
    days.forEach((d) => keys.add(toYMD(getWeekStartMonday(d))));
    return Array.from(keys);
  }, [days]);

  const currentWeekKey = useMemo(
    () => toYMD(getWeekStartMonday(referenceDate)),
    [referenceDate]
  );

  const previousWeekKey = useMemo(
    () => toYMD(subDays(new Date(currentWeekKey + "T00:00:00"), 7)),
    [currentWeekKey]
  );

  const dayPickerWeek = useMemo(() => {
    return weekDates(getWeekStartMonday(new Date(selectedDate + "T00:00:00")));
  }, [selectedDate]);

  const isLocked =
    selectedStoreId === "all" ||
    publishedMap[currentWeekKey]?.[selectedStoreId] === true;

  const gridTemplateColumns = useMemo(() => {
    if (viewMode === "M") {
      return `220px repeat(${days.length}, minmax(42px, 42px)) 100px`;
    }
    if (viewMode === "D") {
      return `220px minmax(240px, 1fr) 100px`;
    }
    return `190px repeat(${days.length}, minmax(140px, 1fr)) 100px`;
  }, [days.length, viewMode]);

  const loadData = useCallback(async () => {
    try {
      const staffQs = query(
        collection(db, "users"),
        where("role", "in", ["staff", "manager"]),
        where("status", "==", "approved")
      );
      const staffSnap = await getDocs(staffQs);
      const approvedLeaveSnap = await getDocs(
        query(collection(db, "leaveRequests"), where("status", "==", "approved"))
      );

      const normalizedStaff = staffSnap.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
        role: (d.data().role || "staff").toLowerCase(),
        department: (d.data().department || "shop").toLowerCase(),
        name: `${d.data().firstName || ""} ${d.data().lastName || ""}`.trim(),
        availability: d.data().availability || null,
        availabilitySubmitted: !!d.data().availabilitySubmitted,
      }));

      setStaffApproved(normalizedStaff);
      setApprovedLeaveRequests(
        approvedLeaveSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      let allShifts = [];
      let allPublishStates = {};

      await Promise.all(
        neededWeekKeys.map(async (weekKey) => {
          const sSnap = await getDocs(collection(db, "rosterWeeks", weekKey, "shifts"));
          allShifts = [
            ...allShifts,
            ...sSnap.docs.map((d) => ({
              id: d.id,
              weekKey,
              ...d.data(),
              role: (d.data().role || "staff").toLowerCase(),
              department: (d.data().department || "shop").toLowerCase(),
            })),
          ];

          const wSnap = await getDoc(doc(db, "rosterWeeks", weekKey));
          if (wSnap.exists()) {
            allPublishStates[weekKey] = wSnap.data().publishedStores || {};
          }
        })
      );

      setShifts(allShifts);
      setPublishedMap(allPublishStates);
    } catch (error) {
      console.error(error);
      showToast("Failed to load roster data", "error");
    }
  }, [neededWeekKeys, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredStaff = useMemo(() => {
    return staffApproved
      .filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((s) =>
        selectedDepartment === "all"
          ? true
          : (s.department || "shop").toLowerCase() === selectedDepartment
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staffApproved, searchTerm, selectedDepartment]);

  const userProfileMap = useMemo(() => {
    const map = {};
    staffApproved.forEach((staff) => {
      map[staff.uid] = {
        role: (staff.role || "staff").toLowerCase(),
        department: (staff.department || "shop").toLowerCase(),
        name: staff.name || "",
        availability: staff.availability || null,
        availabilitySubmitted: !!staff.availabilitySubmitted,
      };
    });
    return map;
  }, [staffApproved]);

  const visibleShifts = useMemo(() => {
    let arr = shifts.map((shift) => {
      const profile = userProfileMap[shift.uid];

      return {
        ...shift,
        liveRole: (profile?.role || shift.role || "staff").toLowerCase(),
        liveDepartment: (profile?.department || shift.department || "shop").toLowerCase(),
        liveStaffName: profile?.name || shift.staffName || "",
        liveAvailability: profile?.availability || null,
        availabilitySubmitted: !!profile?.availabilitySubmitted,
      };
    });

    if (selectedStoreId !== "all") {
      arr = arr.filter((s) => s.storeId === selectedStoreId);
    }

    if (selectedDepartment !== "all") {
      arr = arr.filter((s) => s.liveDepartment === selectedDepartment);
    }

    return arr;
  }, [shifts, selectedStoreId, selectedDepartment, userProfileMap]);

  const shiftLookup = useMemo(() => {
    const map = {};
    visibleShifts.forEach((s) => {
      const key = `${s.uid}_${s.date}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [visibleShifts]);

  const leaveLookup = useMemo(() => {
    const map = {};

    approvedLeaveRequests.forEach((request) => {
      days.forEach((day) => {
        const ymd = toYMD(day);
        if (!requestTouchesDate(request, ymd)) return;
        const key = `${request.uid}_${ymd}`;
        if (!map[key]) map[key] = [];
        map[key].push(request);
      });
    });

    return map;
  }, [approvedLeaveRequests, days]);

  const visibleShiftCount = useMemo(() => {
    const dayKeys = new Set(days.map((d) => toYMD(d)));
    return visibleShifts.filter((s) => dayKeys.has(s.date)).length;
  }, [visibleShifts, days]);

  const totalWeeklyHoursMap = useMemo(() => {
    const map = {};
    const dayKeys = new Set(days.map((d) => toYMD(d)));

    visibleShifts.forEach((s) => {
      if (!dayKeys.has(s.date)) return;
      const start = timeToMinutes(s.startPlanned);
      const end = timeToMinutes(s.endPlanned);
      const mins = Math.max(0, end - start);
      map[s.uid] = (map[s.uid] || 0) + mins;
    });

    return map;
  }, [visibleShifts, days]);

  const storeLabelMap = useMemo(() => {
    const map = {};
    stores.forEach((store) => {
      map[store.id] = store.label;
    });
    return map;
  }, [stores]);

  async function togglePublish() {
    if (selectedStoreId === "all") return;

    try {
      const newState = !publishedMap[currentWeekKey]?.[selectedStoreId];

      await setDoc(
        doc(db, "rosterWeeks", currentWeekKey),
        {
          publishedStores: {
            ...(publishedMap[currentWeekKey] || {}),
            [selectedStoreId]: newState,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPublishedMap((prev) => ({
        ...prev,
        [currentWeekKey]: {
          ...(prev[currentWeekKey] || {}),
          [selectedStoreId]: newState,
        },
      }));

      if (newState) {
        const affectedUids = shifts
          .filter((shift) => shift.weekKey === currentWeekKey && shift.storeId === selectedStoreId)
          .map((shift) => shift.uid);

        await notifyUsers(db, affectedUids, {
          title: "Roster Published",
          message: `Your ${storeLabelMap[selectedStoreId] || "store"} roster for week ${currentWeekKey} is now live.`,
          type: "success",
          link: "/staff/my-roster",
          metadata: { weekKey: currentWeekKey, storeId: selectedStoreId, kind: "roster-published" },
        });

        await pushUsers(affectedUids, {
          title: "Roster Published",
          message: `Your ${storeLabelMap[selectedStoreId] || "store"} roster for week ${currentWeekKey} is now live.`,
          link: "/staff/my-roster",
          metadata: { weekKey: currentWeekKey, storeId: selectedStoreId, kind: "roster-published" },
        });
      }

      showToast(newState ? "Roster published" : "Roster unpublished", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to update publish state", "error");
    }
  }

  async function addShift(ymd, uid) {
    if (isLocked || selectedStoreId === "all") return;

    try {
      const weekKey = toYMD(getWeekStartMonday(new Date(ymd + "T00:00:00")));
      const staff = staffApproved.find((s) => s.uid === uid);
      const targetDate = new Date(ymd + "T00:00:00");
      const available = isStaffAvailableOnDate(staff, targetDate);
      const leaveRequests = leaveLookup[`${uid}_${ymd}`] || [];

      const newShift = {
        uid,
        staffName: staff?.name || "",
        date: ymd,
        storeId: selectedStoreId,
        role: (staff?.role || "staff").toLowerCase(),
        department: (staff?.department || "shop").toLowerCase(),
        startPlanned: "13:00",
        endPlanned: "21:00",
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "rosterWeeks", weekKey, "shifts"),
        newShift
      );

      setShifts((prev) => [...prev, { id: docRef.id, weekKey, ...newShift }]);

      await notifyUsers(db, [uid], {
        title: "New Shift Added",
        message: `${ymd} • ${newShift.startPlanned} - ${newShift.endPlanned} at ${
          storeLabelMap[selectedStoreId] || selectedStoreId
        }.`,
        type: "info",
        link: "/staff/my-roster",
        metadata: { weekKey, storeId: selectedStoreId, kind: "shift-added" },
      });

      if (leaveRequests.length > 0) {
        showToast("Shift added, but staff already has approved leave that day", "warning");
      } else if (!available) {
        showToast("Shift added, but staff is marked unavailable that day", "warning");
      } else {
        showToast("Shift added", "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to add shift", "error");
    }
  }

  async function handleUpdateShift() {
    if (!editingShift) return;

    try {
      const targetShift = editingShift;
      await updateDoc(
        doc(db, "rosterWeeks", targetShift.weekKey, "shifts", targetShift.id),
        {
          startPlanned: targetShift.startPlanned,
          endPlanned: targetShift.endPlanned,
          updatedAt: serverTimestamp(),
        }
      );

      setShifts((prev) =>
        prev.map((s) =>
          s.id === targetShift.id && s.weekKey === targetShift.weekKey
            ? {
                ...s,
                startPlanned: targetShift.startPlanned,
                endPlanned: targetShift.endPlanned,
              }
            : s
        )
      );

      setEditingShift(null);
      await notifyUsers(db, [targetShift.uid], {
        title: "Shift Updated",
        message: `Your shift on ${targetShift.date} is now ${targetShift.startPlanned} - ${targetShift.endPlanned}.`,
        type: "info",
        link: "/staff/my-roster",
        metadata: { weekKey: targetShift.weekKey, storeId: targetShift.storeId, kind: "shift-updated" },
      });
      showToast("Shift updated", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to update shift", "error");
    }
  }

  async function handleDeleteShift() {
    if (!editingShift) return;

    try {
      const targetShift = editingShift;
      await deleteDoc(
        doc(db, "rosterWeeks", targetShift.weekKey, "shifts", targetShift.id)
      );

      setShifts((prev) =>
        prev.filter(
          (s) => !(s.id === targetShift.id && s.weekKey === targetShift.weekKey)
        )
      );

      setEditingShift(null);
      await notifyUsers(db, [targetShift.uid], {
        title: "Shift Removed",
        message: `Your shift on ${targetShift.date} was removed from the roster.`,
        type: "warning",
        link: "/staff/my-roster",
        metadata: { weekKey: targetShift.weekKey, storeId: targetShift.storeId, kind: "shift-removed" },
      });
      showToast("Shift deleted", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete shift", "error");
    }
  }

  async function handleDuplicateShiftToNextDay() {
    if (!editingShift || selectedStoreId === "all" || isLocked) return;

    try {
      const nextDate = addDays(new Date(editingShift.date + "T00:00:00"), 1);
      const newYmd = toYMD(nextDate);
      const newWeekKey = toYMD(getWeekStartMonday(nextDate));

      const payload = {
        uid: editingShift.uid,
        staffName: userProfileMap[editingShift.uid]?.name || editingShift.staffName || "",
        date: newYmd,
        storeId: editingShift.storeId,
        role: (userProfileMap[editingShift.uid]?.role || editingShift.role || "staff").toLowerCase(),
        department: (
          userProfileMap[editingShift.uid]?.department ||
          editingShift.department ||
          "shop"
        ).toLowerCase(),
        startPlanned: editingShift.startPlanned,
        endPlanned: editingShift.endPlanned,
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "rosterWeeks", newWeekKey, "shifts"),
        payload
      );

      setShifts((prev) => [...prev, { id: docRef.id, weekKey: newWeekKey, ...payload }]);

      const targetStaff = staffApproved.find((s) => s.uid === editingShift.uid);
      const available = isStaffAvailableOnDate(targetStaff, nextDate);

      setEditingShift(null);

      if (!available) {
        showToast("Shift duplicated, but staff is marked unavailable next day", "warning");
      } else {
        showToast("Shift duplicated to next day", "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to duplicate shift", "error");
    }
  }

  async function handleCopyPreviousWeek() {
    if (selectedStoreId === "all") {
      showToast("Select a specific store first", "error");
      return;
    }

    if (publishedMap[currentWeekKey]?.[selectedStoreId]) {
      showToast("Unpublish current week before copying", "error");
      return;
    }

    try {
      setCopyingWeek(true);

      const prevSnap = await getDocs(collection(db, "rosterWeeks", previousWeekKey, "shifts"));
      const previousWeekShifts = prevSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.storeId === selectedStoreId);

      if (previousWeekShifts.length === 0) {
        showToast("No shifts found in previous week", "error");
        return;
      }

      const currentSnap = await getDocs(collection(db, "rosterWeeks", currentWeekKey, "shifts"));
      const currentWeekShifts = currentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.storeId === selectedStoreId);

      if (currentWeekShifts.length > 0) {
        showToast("Current week already has shifts. Clear manually before copy.", "error");
        return;
      }

      const prevStartDate = new Date(previousWeekKey + "T00:00:00");
      const currStartDate = new Date(currentWeekKey + "T00:00:00");

      let warningCount = 0;

      await Promise.all(
        previousWeekShifts.map((shift) => {
          const oldDate = new Date(shift.date + "T00:00:00");
          const diffDays = Math.round((oldDate - prevStartDate) / (1000 * 60 * 60 * 24));
          const newDate = toYMD(addDays(currStartDate, diffDays));

          const liveProfile = userProfileMap[shift.uid];
          const targetStaff = staffApproved.find((s) => s.uid === shift.uid);

          if (!isStaffAvailableOnDate(targetStaff, new Date(newDate + "T00:00:00"))) {
            warningCount += 1;
          }

          const payload = {
            uid: shift.uid,
            staffName: liveProfile?.name || shift.staffName || "",
            date: newDate,
            storeId: selectedStoreId,
            role: (liveProfile?.role || shift.role || "staff").toLowerCase(),
            department: (liveProfile?.department || shift.department || "shop").toLowerCase(),
            startPlanned: shift.startPlanned || "13:00",
            endPlanned: shift.endPlanned || "21:00",
            updatedAt: serverTimestamp(),
          };

          return addDoc(collection(db, "rosterWeeks", currentWeekKey, "shifts"), payload);
        })
      );

      await loadData();

      if (warningCount > 0) {
        showToast(`Week copied. ${warningCount} shift(s) fall outside availability`, "warning");
      } else {
        showToast("Previous week copied successfully", "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to copy previous week", "error");
    } finally {
      setCopyingWeek(false);
    }
  }

  async function handleClearCurrentWeek() {
    if (selectedStoreId === "all") {
      showToast("Select a specific store first", "error");
      return;
    }

    if (publishedMap[currentWeekKey]?.[selectedStoreId]) {
      showToast("Unpublish current week before clearing", "error");
      return;
    }

    try {
      setClearingWeek(true);

      const snap = await getDocs(collection(db, "rosterWeeks", currentWeekKey, "shifts"));
      const docsToDelete = snap.docs.filter((d) => d.data().storeId === selectedStoreId);

      if (docsToDelete.length === 0) {
        showToast("Nothing to clear", "error");
        return;
      }

      const batch = writeBatch(db);
      docsToDelete.forEach((d) => {
        batch.delete(doc(db, "rosterWeeks", currentWeekKey, "shifts", d.id));
      });

      await batch.commit();

      setShifts((prev) =>
        prev.filter(
          (s) => !(s.weekKey === currentWeekKey && s.storeId === selectedStoreId)
        )
      );

      showToast("Current week cleared", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to clear week", "error");
    } finally {
      setClearingWeek(false);
    }
  }

  function handlePrev() {
    if (viewMode === "M") {
      const prevMonth = addMonthsSafe(referenceDate, -1);
      setWeekStart(toYMD(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)));
      return;
    }

    if (viewMode === "W") {
      setWeekStart(toYMD(subDays(referenceDate, 7)));
      return;
    }

    setSelectedDate(toYMD(subDays(new Date(selectedDate + "T00:00:00"), 1)));
  }

  function handleNext() {
    if (viewMode === "M") {
      const nextMonth = addMonthsSafe(referenceDate, 1);
      setWeekStart(toYMD(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)));
      return;
    }

    if (viewMode === "W") {
      setWeekStart(toYMD(addDays(referenceDate, 7)));
      return;
    }

    setSelectedDate(toYMD(addDays(new Date(selectedDate + "T00:00:00"), 1)));
  }

  return (
    <div className={`roster-page view-mode-${viewMode}`}>
      <header className="roster-header">
        <div className="header-left">
          <div className="view-switcher">
            {["M", "W", "D"].map((m) => (
              <button
                key={m}
                className={viewMode === m ? "active" : ""}
                onClick={() => setViewMode(m)}
              >
                {m === "M" ? "Month" : m === "W" ? "Week" : "Day"}
              </button>
            ))}
          </div>

          <div className="week-nav">
            <button onClick={handlePrev}>←</button>
            <span className="date-display">
              {viewMode === "M"
                ? referenceDate.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })
                : viewMode === "W"
                ? `${toYMD(days[0])} → ${toYMD(days[days.length - 1])}`
                : prettyDate(referenceDate)}
            </span>
            <button onClick={handleNext}>→</button>
          </div>
        </div>

        <div className="header-right">
          <input
            type="text"
            placeholder="Search staff..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            className="btn-secondary"
            onClick={handleCopyPreviousWeek}
            disabled={
              selectedStoreId === "all" ||
              viewMode === "M" ||
              copyingWeek ||
              publishedMap[currentWeekKey]?.[selectedStoreId]
            }
          >
            {copyingWeek ? "Copying..." : "Copy"}
          </button>

          <button
            className="btn-secondary danger"
            onClick={handleClearCurrentWeek}
            disabled={
              selectedStoreId === "all" ||
              viewMode === "M" ||
              clearingWeek ||
              publishedMap[currentWeekKey]?.[selectedStoreId]
            }
          >
            {clearingWeek ? "Clearing..." : "Clear"}
          </button>

          <button
            className={`btn-primary ${
              isLocked && selectedStoreId !== "all" ? "btn-unpublish" : ""
            }`}
            onClick={togglePublish}
            disabled={selectedStoreId === "all"}
          >
            {publishedMap[currentWeekKey]?.[selectedStoreId] ? "Unpublish" : "Publish"}
          </button>
        </div>
      </header>

      <div className="roster-toolbar">
        <div className="legend">
          <span className="legend-title">Legend</span>

          <div className="legend-item">
            <span className="legend-swatch role-staff-swatch"></span>
            <span>Staff</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch role-admin-swatch"></span>
            <span>Admin</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch role-manager-swatch"></span>
            <span>Manager</span>
          </div>

          <div className="legend-divider"></div>

          <div className="legend-item">
            <span className="legend-swatch dept-shop-swatch"></span>
            <span>Shop</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch dept-kitchen-swatch"></span>
            <span>Kitchen</span>
          </div>

          <div className="legend-divider"></div>

          <div className="legend-item">
            <span className="legend-swatch availability-warning-swatch"></span>
            <span>Outside availability</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch leave-warning-swatch"></span>
            <span>Approved leave</span>
          </div>
        </div>

        <div className="roster-stats">
          <div className="stat-card">
            <span className="stat-label">Visible Staff</span>
            <strong>{filteredStaff.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Visible Shifts</span>
            <strong>{visibleShiftCount}</strong>
          </div>
          <div className="stat-card">
            <select
              className="filter-select"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              <option value="all">View All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {viewMode === "D" && (
        <div className="day-picker">
          {dayPickerWeek.map((d) => {
            const ymd = toYMD(d);
            return (
              <button
                key={ymd}
                className={ymd === selectedDate ? "active" : ""}
                onClick={() => setSelectedDate(ymd)}
              >
                <span>{prettyDate(d).split(",")[0]}</span>
                <strong>{d.getDate()}</strong>
              </button>
            );
          })}
        </div>
      )}

      {selectedStoreId === "all" ? (
        <div className="lock-banner view-only">
          Select a specific store to add, edit, delete, copy, clear, or publish shifts.
        </div>
      ) : isLocked ? (
        <div className="lock-banner">
          This roster is published. Unpublish it first to make changes.
        </div>
      ) : null}

      <div className="roster-grid-container">
        <div className="roster-grid">
          <div
            className="grid-row header-row roster flexdisp"
            style={{ gridTemplateColumns }}
          >
            <div className="cell sticky-cell staff-heading">Staff</div>

            {days.map((d) => {
              const ymd = toYMD(d);
              const isToday = ymd === todayYmd;

              return (
                <div
                  key={ymd}
                  className={`cell date-header ${viewMode === "M" ? "month-header-cell" : ""} ${
                    isToday ? "today-column-header" : ""
                  }`}
                  onClick={() => {
                    if (viewMode === "W") {
                      setSelectedDate(ymd);
                      setViewMode("D");
                    }
                  }}
                  role={viewMode === "W" ? "button" : undefined}
                  title={viewMode === "W" ? "Open day view" : undefined}
                >
                  {viewMode === "M" ? (
                    <strong>{d.getDate()}</strong>
                  ) : (
                    <>
                      <span>{prettyDate(d).split(",")[0]}</span> /
                      <strong>{d.getDate()}</strong>
                    </>
                  )}
                </div>
              );
            })}

            <div className="cell totals-header">Hours</div>
          </div>

          {filteredStaff.length === 0 && (
            <div className="empty-state">No staff found.</div>
          )}

          {filteredStaff.map((staff) => (
            <div
              key={staff.uid}
              className="grid-row roster flexdisp"
              style={{ gridTemplateColumns }}
            >
              <div className="cell sticky-cell staff-cell">
                <strong>{userProfileMap[staff.uid]?.name || staff.name}</strong>
                <span className="role-subtext">
                  {(userProfileMap[staff.uid]?.role || staff.role)} •{" "}
                  {(userProfileMap[staff.uid]?.department || staff.department || "shop").toLowerCase()}
                </span>
              </div>

              {days.map((d) => {
                const ymd = toYMD(d);
                const isToday = ymd === todayYmd;
                const dayShifts = shiftLookup[`${staff.uid}_${ymd}`] || [];
                const leaveRequests = leaveLookup[`${staff.uid}_${ymd}`] || [];
                const hasApprovedLeave = leaveRequests.length > 0;
                const available = isStaffAvailableOnDate(staff, d);
                const availabilityText = getAvailabilityTextForDate(staff, d);
                const leaveSummary = leaveRequests
                  .map((request) =>
                    `${getLeaveTypeLabel(request.type)} (${formatLeaveDateRange(
                      request.startDate,
                      request.endDate
                    )})`
                  )
                  .join(", ");
                const cellTitleParts = [];
                if (!available) cellTitleParts.push(`Unavailable: ${availabilityText}`);
                else cellTitleParts.push(`Available: ${availabilityText}`);
                if (hasApprovedLeave) cellTitleParts.push(`Approved leave: ${leaveSummary}`);

                return (
                  <div
                    key={ymd}
                    className={`cell ${viewMode === "M" ? "month-cell" : ""} ${
                      isToday ? "today-column-cell" : ""
                    } ${!available ? "availability-warning-cell" : ""} ${
                      hasApprovedLeave ? "leave-warning-cell" : ""
                    }`}
                    title={cellTitleParts.join(" • ")}
                  >
                    {viewMode === "M" ? (
                      <>
                        {dayShifts.length > 0 ? (
                          <button
                            className={`month-count-badge role-${
                              dayShifts[0]?.liveRole || "staff"
                            } dept-${dayShifts[0]?.liveDepartment || "shop"} ${
                              !available ? "availability-warning-badge" : ""
                            } ${hasApprovedLeave ? "leave-warning-badge" : ""}`}
                            onClick={() => {
                              setSelectedDate(ymd);
                              setViewMode("D");
                            }}
                            title={`${dayShifts.length} shift${dayShifts.length > 1 ? "s" : ""}${
                              hasApprovedLeave ? ` • ${leaveSummary}` : ""
                            }`}
                          >
                            {dayShifts.length}
                          </button>
                        ) : hasApprovedLeave ? (
                          <button
                            className="leave-day-chip"
                            onClick={() => {
                              setSelectedDate(ymd);
                              setViewMode("D");
                            }}
                            title={`Approved leave • ${leaveSummary}`}
                          >
                            L
                          </button>
                        ) : !isLocked ? (
                          <button
                            className={`add-btn-inline compact-add ${!available ? "availability-warning-add" : ""}`}
                            onClick={() => addShift(ymd, staff.uid)}
                            title={!available ? `Add anyway — ${availabilityText}` : "Add shift"}
                          >
                            +
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {dayShifts.length === 0 && (
                          <div className="day-warning-stack">
                            {!available && (
                              <div className="availability-warning-note">Unavailable</div>
                            )}
                            {hasApprovedLeave && (
                              <div className="leave-warning-note">On Leave</div>
                            )}
                          </div>
                        )}

                        {dayShifts.map((s) => (
                          <div
                            key={s.id}
                            className={`shift-card role-${s.liveRole} dept-${s.liveDepartment} ${
                              isLocked ? "locked-card" : ""
                            } ${!available ? "availability-warning-card" : ""} ${
                              hasApprovedLeave ? "leave-warning-card" : ""
                            }`}
                            onClick={() => !isLocked && setEditingShift(s)}
                            title={cellTitleParts.join(" • ")}
                          >
                            <div className="card-time">
                              {s.startPlanned} - {s.endPlanned}
                            </div>
                            <div className="card-meta">
                              {s.liveDepartment}
                            </div>
                            {!available && (
                              <div className="card-warning-text">Outside availability</div>
                            )}
                            {hasApprovedLeave && (
                              <div className="card-warning-text leave-card-warning-text">
                                Approved leave
                              </div>
                            )}
                          </div>
                        ))}

                        {!isLocked && dayShifts.length === 0 && (
                          <button
                            className={`add-btn-inline ${!available ? "availability-warning-add" : ""}`}
                            onClick={() => addShift(ymd, staff.uid)}
                            title={!available ? `Add anyway — ${availabilityText}` : "Add shift"}
                          >
                            +
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              <div className="cell hours-cell">
                <strong>{formatHours(totalWeeklyHoursMap[staff.uid] || 0)}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingShift && !isLocked && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Manage Shift</h3>
            <p>
              {(userProfileMap[editingShift.uid]?.name || editingShift.staffName)} —{" "}
              {editingShift.date}
            </p>

            {!isStaffAvailableOnDate(
              staffApproved.find((s) => s.uid === editingShift.uid),
              new Date(editingShift.date + "T00:00:00")
            ) && (
              <div className="availability-modal-warning">
                Warning: this shift is outside the staff member’s availability.
              </div>
            )}

            {(leaveLookup[`${editingShift.uid}_${editingShift.date}`] || []).length > 0 && (
              <div className="leave-modal-warning">
                Warning: this staff member has approved leave on this date.
              </div>
            )}

            <div className="time-edit-grid">
              <div>
                <label>Start</label>
                <ClearableTimeInput
                  value={editingShift.startPlanned}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      startPlanned: e.target.value,
                    })
                  }
                  clearLabel="Clear shift start time"
                />
              </div>

              <div>
                <label>End</label>
                <ClearableTimeInput
                  value={editingShift.endPlanned}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      endPlanned: e.target.value,
                    })
                  }
                  clearLabel="Clear shift end time"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-save-full" onClick={handleUpdateShift}>
                Update Shift
              </button>
              <button className="btn-secondary" onClick={handleDuplicateShiftToNextDay}>
                Duplicate to Next Day
              </button>
              <button className="btn-delete-full" onClick={handleDeleteShift}>
                Delete Shift
              </button>
              <button className="btn-cancel" onClick={() => setEditingShift(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
