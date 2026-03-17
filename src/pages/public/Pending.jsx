








import { Link } from "react-router-dom";
import { useAuthUser } from "../../auth/useAuthUser";
import "./Pending.css";

export default function Pending() {
  const { profile, status, role, profileComplete } = useAuthUser();

  const getStatusClass = () => {
    switch (status) {
      case "approved":
        return "status-approved";
      case "rejected":
        return "status-rejected";
      default:
        return "status-pending";
    }
  };

  return (
    <div className="pending-screen-wrapper">
      <div className="pending-card animate-slide-up">
        <header className="pending-header">
          <div className="header-text">
            <h1 className="status-title">Account Status</h1>
            <p className="welcome-msg">Welcome back, {profile?.firstName || "User"}</p>
          </div>
          <div className="status-badges">
            <span className="badge-role">{role || "Staff"}</span>
            <span className={`badge-status ${getStatusClass()}`}>
              {status?.toUpperCase() || "PENDING"}
            </span>
          </div>
        </header>

        <div className="content-section">
          {!profileComplete ? (
            <div className="status-notice alert-box">
              <div className="icon">⚠️</div>
              <div className="text">
                <p>Your onboarding profile is incomplete. Please complete your details before approval can continue.</p>
                <Link to="/complete-profile" className="action-link">
                  Complete Profile →
                </Link>
              </div>
            </div>
          ) : status === "approved" ? (
            <div className="status-notice success-box">
              <div className="icon">✅</div>
              <div className="text">
                <p><strong>Success!</strong> Your account is active. Use the menu to access your timesheets and roster.</p>
              </div>
            </div>
          ) : status === "rejected" ? (
            <div className="status-notice error-box">
              <div className="icon">❌</div>
              <div className="text">
                <p>Your application could not be approved at this time. Please reach out to management for details.</p>
              </div>
            </div>
          ) : (
            <div className="status-notice info-box">
              <div className="icon">⏳</div>
              <div className="text">
                <p>Your profile is currently under review. Once an admin verifies your details, your dashboard will unlock automatically.</p>
              </div>
            </div>
          )}
        </div>

        <div className="profile-preview-section">
          <h3 className="preview-heading">Submitted Details</h3>
          <div className="details-receipt">
            <div className="receipt-row">
              <span className="label">Full Name</span>
              <span className="value">{profile?.firstName} {profile?.lastName}</span>
            </div>
            <div className="receipt-row">
              <span className="label">Email Address</span>
              <span className="value">{profile?.email}</span>
            </div>
            <div className="receipt-row">
              <span className="label">Phone Number</span>
              <span className="value">{profile?.phone || "Not provided"}</span>
            </div>
            {profile?.hourlyRate && (
              <div className="receipt-row highlight">
                <span className="label">Base Rate</span>
                <span className="value">${profile.hourlyRate}/hr</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}