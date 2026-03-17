










import { useState, useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import ClearableTimeInput from "../../components/ClearableTimeInput";
import "./StaffAvailability.css";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function makeDefaultAvailability() {
  const obj = {};
  DAY_KEYS.forEach(day => { obj[day] = { enabled: false, start: "", end: "" }; });
  return obj;
}

function labelize(day) { return day.charAt(0).toUpperCase() + day.slice(1); }

export default function StaffAvailability() {
  const { fbUser, profile } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();
  const location = useLocation();

  const isSetupMode = location.pathname.includes("/setup");
  const [availability, setAvailability] = useState(makeDefaultAvailability());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.availability) setAvailability(profile.availability);
  }, [profile]);

  function updateDay(day, field, value) {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function validateAvailability() {
    const enabledDays = DAY_KEYS.filter((day) => availability[day]?.enabled);

    if (enabledDays.length === 0) {
      showToast("Please select at least one available day", "error");
      return false;
    }

    for (const day of enabledDays) {
      const row = availability[day];
      if (!row.start || !row.end) {
        showToast(`Please set start and end time for ${labelize(day)}`, "error");
        return false;
      }

      if (row.end <= row.start) {
        showToast(`End time must be after start time for ${labelize(day)}`, "error");
        return false;
      }
    }

    return true;
  }
  function copyMondayToAll() {
    const { start, end } = availability.monday;
    if (!start || !end) {
      showToast("Set Monday times first", "error");
      return;
    }
    const newAvail = { ...availability };
    DAY_KEYS.forEach(day => {
      if (day !== 'monday') {
        newAvail[day] = { ...newAvail[day], start, end, enabled: true };
      }
    });
    setAvailability(newAvail);
    showToast("Monday times copied to all days", "success");
  }

  async function handleSave() {
    if (!fbUser?.uid) return;
    if (!validateAvailability()) return;

    try {
      setSaving(true);
      await setDoc(doc(db, "users", fbUser.uid), {
        availability,
        availabilitySubmitted: true,
        availabilityUpdatedAt: serverTimestamp(),
      }, { merge: true });

      showToast(isSetupMode ? "Availability set!" : "Updated", "success");
      nav("/staff/today", { replace: true });
    } catch {
      showToast("Failed to save", "error");
    } finally { setSaving(false); }
  }

  return (
    <div className="availability-page">
      <div className="availability-card">
        <div className="availability-header">
          <h1>{isSetupMode ? "Work Availability" : "Edit Times"}</h1>
          <p>Toggle days and set your available hours.</p>
          {availability.monday.enabled && (
            <button className="copy-btn" onClick={copyMondayToAll}>Copy Monday to All Days</button>
          )}
        </div>

        <div className="availability-grid">
          {DAY_KEYS.map((day) => {
            const row = availability[day];
            return (
              <div key={day} className={`availability-row ${row.enabled ? "enabled" : ""}`}>
                <div className="day-side">
                  <label className="ios-switch">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => updateDay(day, "enabled", e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                  <span className="day-label">{labelize(day).substring(0, 3)}</span>
                </div>

                <div className="time-side">
                  <ClearableTimeInput
                    value={row.start}
                    disabled={!row.enabled}
                    onChange={(e) => updateDay(day, "start", e.target.value)}
                    clearLabel={`Clear ${labelize(day)} start time`}
                  />
                  <span className="sep">-</span>
                  <ClearableTimeInput
                    value={row.end}
                    disabled={!row.enabled}
                    onChange={(e) => updateDay(day, "end", e.target.value)}
                    clearLabel={`Clear ${labelize(day)} end time`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="availability-actions">
          {!isSetupMode && <button className="btn-secondary availability" onClick={() => nav(-1)}>Back</button>}
          <button className="btn-primary availability" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>
    </div>
  );
}
