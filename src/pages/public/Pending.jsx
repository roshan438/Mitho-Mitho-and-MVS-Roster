// import { useAuthUser } from "../../auth/useAuthUser";
// import "./Pending.css";

// export default function Pending() {
//   const { profile, status, role } = useAuthUser();

//   return (
//     <div className="container pending">
//       <div className="card pending-card">
//         <h1 className="h1">Account status</h1>

//         <div className="spacer" />

//         <div className="row">
//           <span className="badge">Role: {role || "unknown"}</span>
//           <span className="badge">Status: {status || "unknown"}</span>
//         </div>

//         <div className="spacer" />

//         {status === "approved" ? (
//           <p className="p">
//             You’re approved. Use the navigation to open your dashboard.
//           </p>
//         ) : status === "rejected" ? (
//           <p className="p">
//             Your account was rejected. Please contact admin.
//           </p>
//         ) : (
//           <p className="p">
//             Your profile is waiting for admin approval. Once approved, your staff dashboard will unlock.
//           </p>
//         )}

//         <div className="spacer" />
//         <pre className="mini">
// {JSON.stringify(
//   {
//     name: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim(),
//     email: profile?.email,
//     phone: profile?.phone,
//     hourlyRate: profile?.hourlyRate,
//   },
//   null,
//   2
// )}
//         </pre>
//       </div>
//     </div>
//   );
// }






import { useAuthUser } from "../../auth/useAuthUser";
import "./Pending.css";

export default function Pending() {
  const { profile, status, role } = useAuthUser();

  // Helper to determine badge color based on status
  const getStatusClass = () => {
    switch (status) {
      case "approved": return "status-approved";
      case "rejected": return "status-rejected";
      default: return "status-pending";
    }
  };

  return (
    <div className="container pending-container">
      <div className="card pending-card">
        <header className="pending-header">
          <h1 className="dashboard-title">Account Status</h1>
          <p className="dashboard-date">Welcome back, {profile?.firstName || "User"}</p>
        </header>

        <div className="status-badges">
          <span className="badge-role">{role || "Staff"}</span>
          <span className={`badge-status ${getStatusClass()}`}>
            {status?.toUpperCase() || "PENDING"}
          </span>
        </div>

        <div className="content-section">
          {status === "approved" ? (
            <div className="notice success">
              <p><strong>Success!</strong> Your account is active. Use the menu to access your timesheets and roster.</p>
            </div>
          ) : status === "rejected" ? (
            <div className="notice alert">
              <p>Your application could not be approved at this time. Please reach out to management for details.</p>
            </div>
          ) : (
            <div className="notice info">
              <p>Your profile is currently under review. Once an admin verifies your details, your dashboard will unlock automatically.</p>
            </div>
          )}
        </div>

        <div className="profile-preview">
          <h3 className="preview-title">Submitted Details</h3>
          <div className="receipt-container">
            <div className="receipt-row">
              <span className="receipt-label">Name</span>
              <span className="receipt-value">{profile?.firstName} {profile?.lastName}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Email</span>
              <span className="receipt-value">{profile?.email}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Phone</span>
              <span className="receipt-value">{profile?.phone || "Not provided"}</span>
            </div>
            {profile?.hourlyRate && (
              <div className="receipt-row">
                <span className="receipt-label">Rate</span>
                <span className="receipt-value">${profile.hourlyRate}/hr</span>
              </div>
            )}
          </div>
        </div>

        {/* Debug view for developers, hide in production if desired */}
        <details className="debug-section">
          <summary>Raw Profile Data</summary>
          <pre className="mini">
            {JSON.stringify({ status, role, uid: profile?.uid }, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}