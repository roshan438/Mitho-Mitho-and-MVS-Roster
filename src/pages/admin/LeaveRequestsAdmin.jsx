import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import { formatLeaveDateRange, getLeaveTypeLabel, sortLeaveRequests } from "../../utils/leaveRequests";
import { createNotification } from "../../utils/notifications";
import "./LeaveRequestsAdmin.css";

export default function LeaveRequestsAdmin() {
  const { fbUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [requests, setRequests] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});

  const loadRequests = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "leaveRequests"));
      const items = sortLeaveRequests(
        snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      );

      setRequests(items);
      setReviewNotes(
        items.reduce((acc, request) => {
          acc[request.id] = request.adminNote || "";
          return acc;
        }, {})
      );

      if (isManual) showToast("Leave requests synced", "success");
    } catch (error) {
      console.error("Admin leave request load failed", error);
      showToast("Failed to load leave requests", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) =>
      statusFilter === "all" ? true : request.status === statusFilter
    );
  }, [requests, statusFilter]);

  async function updateRequestStatus(request, status) {
    if (!fbUser?.uid) return;

    setSavingId(request.id);
    try {
      await updateDoc(doc(db, "leaveRequests", request.id), {
        status,
        adminNote: reviewNotes[request.id] || "",
        reviewedAt: serverTimestamp(),
        reviewedBy: fbUser.uid,
        updatedAt: serverTimestamp(),
      });

      await createNotification(db, {
        uid: request.uid,
        title: status === "approved" ? "Leave approved" : "Leave update",
        message:
          status === "approved"
            ? `Your ${getLeaveTypeLabel(request.type).toLowerCase()} request for ${formatLeaveDateRange(
                request.startDate,
                request.endDate
              )} was approved.`
            : `Your ${getLeaveTypeLabel(request.type).toLowerCase()} request for ${formatLeaveDateRange(
                request.startDate,
                request.endDate
              )} was ${status}.`,
        type: status === "approved" ? "success" : "warning",
        link: "/staff/leave",
        metadata: {
          leaveRequestId: request.id,
          status,
        },
      });

      showToast(`Leave request ${status}`, "success");
      await loadRequests();
    } catch (error) {
      console.error("Leave request review failed", error);
      showToast("Failed to update leave request", "error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mobile-app-wrapper leave-admin-page">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Leave Management</h1>
          <span className="subtitle">Approve, reject, and review staff leave</span>
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

      <main className="scroll-content leave-admin-content">
        <section className="leave-admin-filter-bar">
          {["all", "pending", "approved", "rejected"].map((status) => (
            <button
              key={status}
              className={`pill-btn ${statusFilter === status ? "active" : ""}`}
              onClick={() => setStatusFilter(status)}
              type="button"
            >
              {status === "all" ? "All" : status}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="loader-inline">
            <div className="spinner"></div>
            <span>Loading leave requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="leave-empty-state">No leave requests match this filter.</div>
        ) : (
          <div className="leave-admin-list">
            {filteredRequests.map((request) => (
              <article key={request.id} className="leave-admin-card">
                <div className="leave-admin-top">
                  <div>
                    <h3>{request.staffName || request.uid}</h3>
                    <p>
                      {getLeaveTypeLabel(request.type)} •{" "}
                      {formatLeaveDateRange(request.startDate, request.endDate)}
                    </p>
                  </div>
                  <span className={`leave-status-pill ${request.status || "pending"}`}>
                    {request.status || "pending"}
                  </span>
                </div>

                <p className="leave-reason-text">{request.reason}</p>

                <label className="leave-field leave-review-field">
                  <span>Admin Note</span>
                  <textarea
                    rows="3"
                    value={reviewNotes[request.id] || ""}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                    }
                    placeholder="Optional note for the staff member"
                  />
                </label>

                <div className="leave-admin-actions">
                  <button
                    className="btn-secondary leave-review-btn"
                    disabled={savingId === request.id}
                    onClick={() => updateRequestStatus(request, "rejected")}
                    type="button"
                  >
                    Reject
                  </button>
                  <button
                    className="btn-brand leave-review-btn"
                    disabled={savingId === request.id}
                    onClick={() => updateRequestStatus(request, "approved")}
                    type="button"
                  >
                    {savingId === request.id ? "Saving..." : "Approve"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
