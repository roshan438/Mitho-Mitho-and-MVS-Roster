import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";
import { notifyUsers, pushUsers } from "../../utils/notifications";
import {
  getShiftRequestStatusLabel,
  SHIFT_REQUEST_STATUS,
} from "../../utils/shiftRequests";
import { prettyTime } from "../../utils/dates";
import "./ShiftRequestsAdmin.css";

export default function ShiftRequestsAdmin() {
  const { fbUser } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [requests, setRequests] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);

  const loadRequests = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "shiftRequests"), orderBy("createdAt", "desc"), limit(60)));
      const list = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const aCreated = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bCreated = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bCreated - aCreated;
        });

      setRequests(list);
      if (manual) showToast("Shift requests updated", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to load shift requests", "error");
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
  const visibleRequests = useMemo(
    () => filteredRequests.slice(0, visibleCount),
    [filteredRequests, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(20);
  }, [statusFilter]);

  async function updateRequestStatus(request, nextStatus) {
    setSavingId(request.id);

    try {
      await updateDoc(doc(db, "shiftRequests", request.id), {
        status: nextStatus,
        reviewedAt: serverTimestamp(),
        reviewedBy: fbUser?.uid || "",
        updatedAt: serverTimestamp(),
      });

      if (nextStatus === SHIFT_REQUEST_STATUS.open) {
        const eligibleSnap = await getDocs(
          query(
            collection(db, "users"),
            where("role", "in", ["staff", "manager"]),
            where("status", "==", "approved")
          )
        );

        const eligibleUids = eligibleSnap.docs
          .map((docSnap) => docSnap.id)
          .filter((uid) => uid !== request.requestorUid);

        await notifyUsers(db, eligibleUids, {
          title: "Open Shift Available",
          message: `${request.requestorName || "A staff member"} released a shift on ${
            request.shiftDate
          }.`,
          type: "info",
          link: "/staff/my-roster",
          metadata: { shiftRequestId: request.id, kind: "open-shift" },
        });
      }

      if (nextStatus === SHIFT_REQUEST_STATUS.rejected) {
        await notifyUsers(db, [request.requestorUid], {
          title: "Shift Request Rejected",
          message: `Your shift release request for ${request.shiftDate} was rejected.`,
          type: "warning",
          link: "/staff/my-roster",
          metadata: { shiftRequestId: request.id, kind: "shift-request" },
        });
      }

      showToast(`Shift request marked ${nextStatus}`, "success");
      await loadRequests();
    } catch (error) {
      console.error(error);
      showToast("Failed to update shift request", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function approveClaim(request) {
    if (!request.claimantUid || !request.shiftWeekKey || !request.shiftId) {
      showToast("This request is missing claim or shift data", "error");
      return;
    }

    setSavingId(request.id);

    try {
      const claimantSnap = await getDoc(doc(db, "users", request.claimantUid));
      const shiftSnap = await getDoc(
        doc(db, "rosterWeeks", request.shiftWeekKey, "shifts", request.shiftId)
      );

      if (!claimantSnap.exists() || !shiftSnap.exists()) {
        showToast("Shift or claimant record no longer exists", "error");
        return;
      }

      const claimant = claimantSnap.data();

      await updateDoc(doc(db, "rosterWeeks", request.shiftWeekKey, "shifts", request.shiftId), {
        uid: request.claimantUid,
        staffName:
          `${claimant.firstName || ""} ${claimant.lastName || ""}`.trim() ||
          claimant.email ||
          request.claimantUid,
        role: (claimant.role || "staff").toLowerCase(),
        department: (claimant.department || "shop").toLowerCase(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "shiftRequests", request.id), {
        status: SHIFT_REQUEST_STATUS.approved,
        reviewedAt: serverTimestamp(),
        reviewedBy: fbUser?.uid || "",
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await notifyUsers(db, [request.requestorUid, request.claimantUid], {
        title: "Shift Claim Approved",
        message: `The ${request.shiftDate} shift has been reassigned successfully.`,
        type: "success",
        link: "/staff/my-roster",
        metadata: { shiftRequestId: request.id, kind: "shift-request-approved" },
      });

      await pushUsers([request.requestorUid, request.claimantUid], {
        title: "Shift Claim Approved",
        message: `The ${request.shiftDate} shift has been reassigned successfully.`,
        link: "/staff/my-roster",
        metadata: { shiftRequestId: request.id, kind: "shift-request-approved" },
      });

      showToast("Shift claim approved", "success");
      await loadRequests();
    } catch (error) {
      console.error(error);
      showToast("Failed to approve shift claim", "error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mobile-app-wrapper shift-admin-page">
      <header className="app-header">
        <div className="header-text">
          <h1 className="main-title">Shift Requests</h1>
          <span className="subtitle">Review release requests and approve claims</span>
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

      <main className="scroll-content shift-admin-content">
        <section className="shift-admin-filter-bar">
          {["all", "pending", "open", "claimed", "approved", "rejected"].map((status) => (
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
            <span>Loading shift requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state-container">
            <p>No shift requests match this filter.</p>
          </div>
        ) : (
          <div className="shift-request-admin-list">
            {visibleRequests.map((request) => (
              <article key={request.id} className="shift-request-admin-card">
                <div className="shift-request-admin-top">
                  <div>
                    <h3>{request.requestorName || request.requestorUid}</h3>
                    <p>
                      {request.shiftDate} • {prettyTime(request.shiftStart)} -{" "}
                      {prettyTime(request.shiftEnd)}
                    </p>
                  </div>
                  <span className={`leave-status-pill ${request.status || "pending"}`}>
                    {getShiftRequestStatusLabel(request.status)}
                  </span>
                </div>

                <div className="shift-request-meta">
                  <span>Store: {request.storeLabel || request.storeId || "-"}</span>
                  {request.note ? <span>Reason: {request.note}</span> : null}
                  {request.claimantName ? <span>Claimed by: {request.claimantName}</span> : null}
                </div>

                <div className="shift-request-admin-actions">
                  {request.status === SHIFT_REQUEST_STATUS.pending && (
                    <>
                      <button
                        className="btn-secondary leave-review-btn"
                        disabled={savingId === request.id}
                        onClick={() => updateRequestStatus(request, SHIFT_REQUEST_STATUS.rejected)}
                        type="button"
                      >
                        Reject
                      </button>
                      <button
                        className="btn-brand leave-review-btn"
                        disabled={savingId === request.id}
                        onClick={() => updateRequestStatus(request, SHIFT_REQUEST_STATUS.open)}
                        type="button"
                      >
                        Open Shift
                      </button>
                    </>
                  )}

                  {request.status === SHIFT_REQUEST_STATUS.claimed && (
                    <>
                      <button
                        className="btn-secondary leave-review-btn"
                        disabled={savingId === request.id}
                        onClick={() => updateRequestStatus(request, SHIFT_REQUEST_STATUS.open)}
                        type="button"
                      >
                        Reopen
                      </button>
                      <button
                        className="btn-brand leave-review-btn"
                        disabled={savingId === request.id}
                        onClick={() => approveClaim(request)}
                        type="button"
                      >
                        {savingId === request.id ? "Saving..." : "Approve Claim"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
            {visibleCount < filteredRequests.length ? (
              <button className="pill-btn" type="button" onClick={() => setVisibleCount((prev) => prev + 20)}>
                Load more
              </button>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
