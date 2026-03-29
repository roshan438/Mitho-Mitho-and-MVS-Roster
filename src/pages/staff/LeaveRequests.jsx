import { useCallback, useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import { LEAVE_TYPE_OPTIONS, formatLeaveDateRange, getLeaveTypeLabel, sortLeaveRequests } from "../../utils/leaveRequests";
import { toYMD } from "../../utils/dates";
import "./LeaveRequests.css";

export default function LeaveRequests() {
  const { fbUser, profile } = useAuth();
  const { showToast } = useToast();
  const uid = fbUser?.uid;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({
    type: "annual",
    startDate: toYMD(new Date()),
    endDate: toYMD(new Date()),
    reason: "",
  });

  const loadRequests = useCallback(async (isManual = false) => {
    if (!uid) return;
    setLoading(true);

    try {
      const snap = await getDocs(
        query(collection(db, "leaveRequests"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(40))
      );

      const items = sortLeaveRequests(
        snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      );

      setRequests(items);
      if (isManual) showToast("Leave requests updated", "success");
    } catch (error) {
      console.error("Leave request load failed", error);
      showToast("Failed to load leave requests", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, uid]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const stats = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        acc.total += 1;
        acc[request.status || "pending"] += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 }
    );
  }, [requests]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!uid) return;
    if (!form.startDate || !form.endDate) {
      showToast("Please choose both start and end dates", "warning");
      return;
    }
    if (form.endDate < form.startDate) {
      showToast("End date must be after the start date", "warning");
      return;
    }
    if (!form.reason.trim()) {
      showToast("Please add a short reason", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "leaveRequests"), {
        uid,
        staffName:
          `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
          fbUser?.email ||
          uid,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
        status: "pending",
        adminNote: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm((prev) => ({
        ...prev,
        startDate: toYMD(new Date()),
        endDate: toYMD(new Date()),
        reason: "",
      }));
      showToast("Leave request submitted", "success");
      await loadRequests();
    } catch (error) {
      console.error("Leave request submit failed", error);
      showToast("Failed to submit leave request", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mobile-app-wrapper leave-page">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Leave Requests</h1>
          <span className="subtitle">Request time away and track approval status</span>
        </div>
        <button
          className={`refresh-circle ${loading ? "spinning" : ""}`}
          onClick={() => loadRequests(true)}
          disabled={loading}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </header>

      <main className="scroll-content leave-content">
        <section className="leave-stats">
          <div className="leave-stat-card">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="leave-stat-card pending">
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </div>
          <div className="leave-stat-card approved">
            <span>Approved</span>
            <strong>{stats.approved}</strong>
          </div>
        </section>

        <section className="leave-form-card">
          <div className="section-head">
            <h2>New Request</h2>
            <p>Submit leave for one day or a date range.</p>
          </div>

          <form className="leave-form-grid" onSubmit={handleSubmit}>
            <label className="leave-field">
              <span>Leave Type</span>
              <select value={form.type} onChange={(e) => updateField("type", e.target.value)}>
                {LEAVE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="leave-field">
              <span>Start Date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
              />
            </label>

            <label className="leave-field">
              <span>End Date</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
              />
            </label>

            <label className="leave-field leave-field-full">
              <span>Reason</span>
              <textarea
                rows="4"
                value={form.reason}
                onChange={(e) => updateField("reason", e.target.value)}
                placeholder="Briefly explain the leave request"
              />
            </label>

            <button className="btn-brand leave-submit" disabled={submitting} type="submit">
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </section>

        <section className="leave-history-card">
          <div className="section-head">
            <h2>My Requests</h2>
            <p>Recent requests and admin responses.</p>
          </div>

          {loading ? (
            <div className="loader-inline">
              <div className="spinner"></div>
              <span>Loading requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="app-empty-state">
              <div className="app-empty-icon">Leave</div>
              <h2>No leave requests yet</h2>
              <p>Your submitted requests and admin responses will show up here.</p>
            </div>
          ) : (
            <div className="leave-request-list">
              {requests.map((request) => (
                <article key={request.id} className="leave-request-card">
                  <div className="leave-request-top">
                    <div>
                      <h3>{getLeaveTypeLabel(request.type)}</h3>
                      <p>{formatLeaveDateRange(request.startDate, request.endDate)}</p>
                    </div>
                    <span className={`leave-status-pill ${request.status || "pending"}`}>
                      {request.status || "pending"}
                    </span>
                  </div>

                  <p className="leave-reason-text">{request.reason}</p>

                  {request.adminNote ? (
                    <div className="leave-admin-note">
                      <strong>Admin note</strong>
                      <span>{request.adminNote}</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
