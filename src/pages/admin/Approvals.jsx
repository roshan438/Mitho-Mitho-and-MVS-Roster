import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useToast } from "../../context/ToastContext";
import "./Approvals.css";

const DEFAULT_FILTERS = {
  search: "",
};

const RATE_PRESETS = [24, 26, 28, 30];
const PAGE_SIZE = 12;

function formatCreatedAt(ts) {
  if (!ts?.toDate) return "Recently";
  return ts.toDate().toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Approvals() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchUsers = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(80)));
      const list = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          hourlyRateInput: String(docSnap.data()?.hourlyRate || ""),
        }))
        .filter((user) => user.role !== "admin" && user.profileComplete);

      setUsers(list);
      if (manual) showToast("Approvals refreshed", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to load approvals", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const queryText = filters.search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !queryText ||
        `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase().includes(queryText) ||
        String(user.email || "").toLowerCase().includes(queryText);
      const matchesStatus = String(user.status || "pending") === "pending";

      return matchesSearch && matchesStatus;
    });
  }, [filters, users]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleCount),
    [filteredUsers, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function updateRate(uid, val) {
    setUsers((prev) => prev.map((user) => (user.id === uid ? { ...user, hourlyRateInput: val } : user)));
  }

  async function updateUserStatus(user, status) {
    const nextRate = Number(user.hourlyRateInput);
    if (status === "approved" && (!nextRate || nextRate <= 0)) {
      showToast("Enter a valid hourly rate first", "warning");
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.id), {
        status,
        hourlyRate: status === "approved" ? nextRate : user.hourlyRate || null,
        updatedAt: serverTimestamp(),
      });
      showToast(`${user.firstName || "Staff"} ${status}`, "success");
      await fetchUsers(false);
    } catch (error) {
      console.error(error);
      showToast("Failed to update approval", "error");
    }
  }

  return (
    <div className="mobile-app-wrapper approvals-page">
      <header className="app-header approvals-header">
        <div className="header-text">
          <h1 className="main-title">Approvals</h1>
          <span className="subtitle">Review new signups and approve them inline</span>
        </div>
        <div className="approvals-header-actions">
          <button className={`refresh-circle ${loading ? "spinning" : ""}`} onClick={() => fetchUsers(true)} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </header>

      <main className="scroll-content approvals-content">
        <section className="approvals-toolbar">
          <div className="approvals-filter-grid">
            <input
              className="app-input"
              placeholder="Search staff or email"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
            />
            <div className="approvals-filter-note">Showing pending signup approvals only</div>
          </div>
        </section>

        {loading ? (
          <div className="loader-inline">
            <div className="spinner"></div>
            <span>Checking for signups...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="approvals-empty">
            <div className="approvals-empty-icon">Ready</div>
            <h2>No pending signups right now</h2>
            <p>New staff registrations will appear here when they need approval.</p>
          </div>
        ) : (
          <div className="approvals-list">
            {visibleUsers.map((user) => {
              const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || user.id;
              return (
                <article key={user.id} className="approval-card">
                  <div className="approval-card-top">
                    <div className="approval-identity">
                      <div className="avatar">{(user.firstName?.[0] || "U")}{(user.lastName?.[0] || "").toUpperCase()}</div>
                      <div>
                        <strong>{name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </div>
                    <div className={`approval-status-pill ${user.status || "pending"}`}>{user.status || "pending"}</div>
                  </div>

                  <div className="approval-detail-grid">
                    <div className="detail-box"><label>Applied</label><span>{formatCreatedAt(user.createdAt)}</span></div>
                    <div className="detail-box"><label>Department</label><span>{user.department || "Unassigned"}</span></div>
                    <div className="detail-box"><label>Phone</label><span>{user.phone || "-"}</span></div>
                    <div className="detail-box"><label>DOB</label><span>{user.dob || "-"}</span></div>
                    <div className="detail-box"><label>Address</label><span>{user.suburb || "-"} {user.postcode || ""}</span></div>
                    <div className="detail-box"><label>Emergency</label><span>{user.emergencyName || "-"}</span></div>
                  </div>

                  <div className="approval-rate-shell">
                    <div className="rate-input-wrapper">
                      <span className="currency">$</span>
                      <input
                        className="rate-input"
                        type="number"
                        placeholder="Hourly rate"
                        value={user.hourlyRateInput}
                        onChange={(e) => updateRate(user.id, e.target.value)}
                      />
                      <span className="per-hr">/hr</span>
                    </div>

                    <div className="approval-rate-presets">
                      {RATE_PRESETS.map((rate) => (
                        <button key={rate} type="button" className="rate-preset" onClick={() => updateRate(user.id, String(rate))}>
                          ${rate}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="approval-actions">
                    <button className="reject-btn" type="button" onClick={() => updateUserStatus(user, "rejected")}>
                      Reject
                    </button>
                    <button className="approve-btn" type="button" onClick={() => updateUserStatus(user, "approved")}>
                      Quick approve
                    </button>
                  </div>
                </article>
              );
            })}

            {visibleCount < filteredUsers.length ? (
              <button className="pill-btn approvals-load-more" type="button" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                Load more
              </button>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
