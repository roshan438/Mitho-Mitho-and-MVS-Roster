




import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import { useToast } from "../../context/ToastContext";
import getFirebaseErrorMessage from "../../utils/getFirebaseErrorMessage";
import "./Forgot.css";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const nav = useNavigate();

  async function onReset(e) {
    e.preventDefault();

    if (!email.trim()) {
      return showToast("Please enter your email address.", "warning", {
        title: "Missing email",
      });
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast("Password reset link sent to your email.", "success", {
        title: "Check your inbox",
        duration: 3200,
      });

      setTimeout(() => nav("/login"), 1800);
    } catch (err) {
      showToast(getFirebaseErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        <header className="auth-header">
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">
            Enter your email and we’ll send you a reset link.
          </p>
        </header>

        <main className="auth-card">
          <form className="auth-form" onSubmit={onReset}>
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>

            <button className="btn-brand" type="submit" disabled={loading}>
              {loading ? <div className="spinner-small"></div> : "Send Reset Link"}
            </button>
          </form>
        </main>

        <footer className="auth-footer">
          <p>
            Remembered your password? <Link to="/login" className="text-link">Back to Sign In</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}